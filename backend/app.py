"""ClaimSaathi backend — student prototype (Flask + SQLite).

Run locally:
    pip install -r requirements.txt
    python app.py

Environment variables:
    CLAIMSATHI_DB                 path to the SQLite file
    CLAIMSATHI_ALLOWED_ORIGINS    comma-separated frontend origins allowed by CORS
    PORT                          port to listen on (default 5000)

This server stores fictional demo data only. It must never be used with
real medical records, bank details, identity numbers or police information.
"""

import os
import sqlite3
from datetime import date, datetime, timezone

from flask import Flask, g, jsonify, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("CLAIMSATHI_DB", os.path.join(BASE_DIR, "claimsaathi.db"))

DEFAULT_ORIGINS = (
    "http://127.0.0.1:5000,http://localhost:5000,"
    "http://127.0.0.1:8000,http://localhost:8000,"
    "http://127.0.0.1:5500,http://localhost:5500"
)
ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.environ.get("CLAIMSATHI_ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

MAX_AMOUNT = 500000

STATUS_LABELS = {
    "draft": "Draft",
    "submitted": "Submitted",
    "under_review": "Under review",
    "clarification_required": "Clarification required",
    "approved": "Approved for payment",
    "payment_recorded": "Payment recorded",
}

app = Flask(__name__)


# ----------------------------------------------------------------------
# Database helpers
# ----------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS claims (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    reference     TEXT NOT NULL UNIQUE,
    type          TEXT NOT NULL,
    expense_date  TEXT NOT NULL,
    amount        REAL NOT NULL,
    description   TEXT NOT NULL,
    document_name TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL,
    paid_amount   REAL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    at       TEXT NOT NULL,
    status   TEXT NOT NULL,
    note     TEXT NOT NULL DEFAULT '',
    actor    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counters (
    name  TEXT PRIMARY KEY,
    value INTEGER NOT NULL
);
"""


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def add_history(db, claim_id, status, note, actor):
    db.execute(
        "INSERT INTO history (claim_id, at, status, note, actor) VALUES (?, ?, ?, ?, ?)",
        (claim_id, now_iso(), status, note or "", actor),
    )


def next_reference(db):
    row = db.execute("SELECT value FROM counters WHERE name = 'claim_ref'").fetchone()
    value = row["value"] if row else 1001
    if row is None:
        db.execute("INSERT INTO counters (name, value) VALUES ('claim_ref', ?)", (value + 1,))
    else:
        db.execute("UPDATE counters SET value = ? WHERE name = 'claim_ref'", (value + 1,))
    return "CS-" + str(value)


# ----------------------------------------------------------------------
# Deterministic fictional seed data
# ----------------------------------------------------------------------
SEED_CLAIMS = [
    {
        "reference": "CS-1001",
        "type": "medical",
        "expense_date": "2025-01-14",
        "amount": 1450.00,
        "description": "Sample pharmacy and consultation bill (fictional).",
        "document_name": "sample-pharmacy-bill.pdf",
        "status": "payment_recorded",
        "paid_amount": 1450.00,
        "created_at": "2025-01-15T09:10:00+00:00",
        "updated_at": "2025-01-24T10:05:00+00:00",
        "history": [
            ("2025-01-15T09:10:00+00:00", "submitted", "Demo claim submitted.", "officer"),
            ("2025-01-17T10:20:00+00:00", "under_review", "Reviewer opened the claim.", "reviewer"),
            ("2025-01-20T15:30:00+00:00", "approved", "Sample documents look complete. Approved for payment.", "reviewer"),
            ("2025-01-24T10:05:00+00:00", "payment_recorded", "Fictional payment recorded. No money was sent.", "reviewer"),
        ],
    },
    {
        "reference": "CS-1002",
        "type": "travel",
        "expense_date": "2025-02-03",
        "amount": 3200.00,
        "description": "Sample duty travel fare and lodging receipt (fictional).",
        "document_name": "sample-travel-receipt.pdf",
        "status": "under_review",
        "paid_amount": None,
        "created_at": "2025-02-04T08:30:00+00:00",
        "updated_at": "2025-02-06T12:15:00+00:00",
        "history": [
            ("2025-02-04T08:30:00+00:00", "submitted", "Demo claim submitted.", "officer"),
            ("2025-02-06T12:15:00+00:00", "under_review", "Reviewer is checking the sample receipt.", "reviewer"),
        ],
    },
    {
        "reference": "CS-1003",
        "type": "medical",
        "expense_date": "2025-02-18",
        "amount": 780.00,
        "description": "Sample diagnostic test bill (fictional).",
        "document_name": "sample-test-bill.pdf",
        "status": "clarification_required",
        "paid_amount": None,
        "created_at": "2025-02-19T11:00:00+00:00",
        "updated_at": "2025-02-21T09:45:00+00:00",
        "history": [
            ("2025-02-19T11:00:00+00:00", "submitted", "Demo claim submitted.", "officer"),
            ("2025-02-20T14:20:00+00:00", "under_review", "Reviewer opened the claim.", "reviewer"),
            ("2025-02-21T09:45:00+00:00", "clarification_required",
             "Please add a sample document name that matches the bill.", "reviewer"),
        ],
    },
    {
        "reference": "CS-1004",
        "type": "travel",
        "expense_date": "2025-03-05",
        "amount": 2100.00,
        "description": "Sample local transport receipt (fictional).",
        "document_name": "sample-transport-receipt.pdf",
        "status": "submitted",
        "paid_amount": None,
        "created_at": "2025-03-06T07:50:00+00:00",
        "updated_at": "2025-03-06T07:50:00+00:00",
        "history": [
            ("2025-03-06T07:50:00+00:00", "submitted", "Demo claim submitted.", "officer"),
        ],
    },
    {
        "reference": "CS-1005",
        "type": "medical",
        "expense_date": "2025-03-12",
        "amount": 640.00,
        "description": "Sample medicine bill (fictional), still being checked.",
        "document_name": "",
        "status": "draft",
        "paid_amount": None,
        "created_at": "2025-03-12T16:05:00+00:00",
        "updated_at": "2025-03-12T16:05:00+00:00",
        "history": [
            ("2025-03-12T16:05:00+00:00", "draft", "Draft created.", "officer"),
        ],
    },
]


def seed_data(db):
    db.execute("DELETE FROM history")
    db.execute("DELETE FROM claims")
    db.execute("DELETE FROM counters")

    for item in SEED_CLAIMS:
        cursor = db.execute(
            "INSERT INTO claims (reference, type, expense_date, amount, description, "
            "document_name, status, paid_amount, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                item["reference"], item["type"], item["expense_date"], item["amount"],
                item["description"], item["document_name"], item["status"],
                item["paid_amount"], item["created_at"], item["updated_at"],
            ),
        )
        claim_id = cursor.lastrowid
        for at, status, note, actor in item["history"]:
            db.execute(
                "INSERT INTO history (claim_id, at, status, note, actor) VALUES (?, ?, ?, ?, ?)",
                (claim_id, at, status, note, actor),
            )

    db.execute("INSERT INTO counters (name, value) VALUES ('claim_ref', ?)", (1006,))
    db.commit()


def init_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.executescript(SCHEMA)
    count = connection.execute("SELECT COUNT(*) AS n FROM claims").fetchone()["n"]
    if count == 0:
        seed_data(connection)
    connection.close()


# ----------------------------------------------------------------------
# Serialisation
# ----------------------------------------------------------------------
def claim_to_dict(row, history_rows):
    return {
        "reference": row["reference"],
        "type": row["type"],
        "expense_date": row["expense_date"],
        "amount": row["amount"],
        "description": row["description"],
        "document_name": row["document_name"],
        "status": row["status"],
        "status_label": STATUS_LABELS.get(row["status"], row["status"]),
        "paid_amount": row["paid_amount"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "history": [
            {
                "at": h["at"],
                "status": h["status"],
                "status_label": STATUS_LABELS.get(h["status"], h["status"]),
                "note": h["note"],
                "actor": h["actor"],
            }
            for h in history_rows
        ],
    }


def history_for(db, claim_ids):
    result = {cid: [] for cid in claim_ids}
    if not claim_ids:
        return result
    placeholders = ",".join("?" * len(claim_ids))
    rows = db.execute(
        "SELECT * FROM history WHERE claim_id IN (%s) ORDER BY id ASC" % placeholders,
        list(claim_ids),
    ).fetchall()
    for row in rows:
        result.setdefault(row["claim_id"], []).append(row)
    return result


def fetch_claim(db, reference):
    row = db.execute("SELECT * FROM claims WHERE reference = ?", (reference,)).fetchone()
    if row is None:
        return None
    history_rows = db.execute(
        "SELECT * FROM history WHERE claim_id = ? ORDER BY id ASC", (row["id"],)
    ).fetchall()
    return claim_to_dict(row, history_rows)


# ----------------------------------------------------------------------
# Validation (server-side, mirroring the frontend)
# ----------------------------------------------------------------------
def validate_claim(data, require_document=False):
    errors = {}

    claim_type = data.get("type")
    if claim_type not in ("medical", "travel"):
        errors["type"] = "Choose either Medical or Duty Travel."

    expense_date = str(data.get("expense_date") or "").strip()
    try:
        parsed_date = datetime.strptime(expense_date, "%Y-%m-%d").date()
        if parsed_date > date.today():
            errors["expense_date"] = "Expense date cannot be in the future."
    except ValueError:
        errors["expense_date"] = "Enter a valid expense date."

    try:
        amount = float(data.get("amount"))
        if amount < 1 or amount > MAX_AMOUNT:
            errors["amount"] = "Enter an amount between 1 and 500000 rupees."
    except (TypeError, ValueError):
        errors["amount"] = "Enter the amount in rupees, for example 1250."

    description = str(data.get("description") or "").strip()
    if len(description) < 5:
        errors["description"] = "Add a short description of at least 5 characters."
    elif len(description) > 200:
        errors["description"] = "Keep the description under 200 characters."

    document_name = str(data.get("document_name") or "").strip()
    if len(document_name) > 120:
        errors["document_name"] = "Keep the sample document name under 120 characters."
    if require_document and not document_name:
        errors["document_name"] = "Add a sample document name before submitting."

    return errors


# ----------------------------------------------------------------------
# CORS (restricted to configured origins)
# ----------------------------------------------------------------------
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin and origin.rstrip("/") in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Vary"] = "Origin"
    return response


@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return ("", 204)


# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------
@app.get("/")
def index():
    return jsonify({
        "name": "ClaimSaathi backend (student prototype)",
        "note": "Fictional demo data only. Not an official portal.",
        "endpoints": [
            "GET /api/health",
            "GET /api/claims",
            "POST /api/claims",
            "GET /api/claims/<reference>",
            "PATCH /api/claims/<reference>",
            "POST /api/claims/<reference>/review",
            "POST /api/claims/<reference>/payment",
            "POST /api/reset",
        ],
    })


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "mode": "backend"})


@app.get("/api/claims")
def list_claims():
    db = get_db()
    where = []
    params = []

    query = (request.args.get("q") or "").strip()
    if query:
        where.append("reference LIKE ?")
        params.append("%" + query + "%")

    claim_type = request.args.get("type")
    if claim_type in ("medical", "travel"):
        where.append("type = ?")
        params.append(claim_type)

    status = request.args.get("status")
    if status in STATUS_LABELS:
        where.append("status = ?")
        params.append(status)

    sql = "SELECT * FROM claims"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY updated_at DESC, id DESC"

    rows = db.execute(sql, params).fetchall()
    grouped = history_for(db, [row["id"] for row in rows])
    return jsonify({"claims": [claim_to_dict(row, grouped.get(row["id"], [])) for row in rows]})


@app.get("/api/claims/<reference>")
def get_claim(reference):
    db = get_db()
    claim = fetch_claim(db, reference)
    if claim is None:
        return jsonify({"error": "Claim not found."}), 404
    return jsonify({"claim": claim})


@app.post("/api/claims")
def create_claim():
    db = get_db()
    data = request.get_json(silent=True) or {}
    submit = bool(data.get("submit"))

    errors = validate_claim(data, require_document=submit)
    if errors:
        return jsonify({"error": "Some fields need attention.", "errors": errors}), 400

    status = "submitted" if submit else "draft"
    reference = next_reference(db)
    timestamp = now_iso()

    cursor = db.execute(
        "INSERT INTO claims (reference, type, expense_date, amount, description, "
        "document_name, status, paid_amount, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
        (
            reference, data["type"], str(data["expense_date"]).strip(), float(data["amount"]),
            str(data["description"]).strip(), str(data.get("document_name") or "").strip(),
            status, timestamp, timestamp,
        ),
    )
    add_history(
        db, cursor.lastrowid, status,
        "Demo claim submitted." if submit else "Draft created.", "officer",
    )
    db.commit()
    return jsonify({"claim": fetch_claim(db, reference)}), 201


@app.patch("/api/claims/<reference>")
def update_claim(reference):
    db = get_db()
    row = db.execute("SELECT * FROM claims WHERE reference = ?", (reference,)).fetchone()
    if row is None:
        return jsonify({"error": "Claim not found."}), 404
    if row["status"] not in ("draft", "clarification_required"):
        return jsonify({"error": "Only drafts and claims needing clarification can be edited."}), 409

    data = request.get_json(silent=True) or {}
    submit = bool(data.get("submit"))
    errors = validate_claim(data, require_document=submit)

    note = str(data.get("note") or "").strip()
    if submit and row["status"] == "clarification_required":
        if not note:
            errors["note"] = "Add a short reply for the reviewer."
        elif len(note) > 500:
            errors["note"] = "Keep your reply under 500 characters."

    if errors:
        return jsonify({"error": "Some fields need attention.", "errors": errors}), 400

    new_status = "submitted" if submit else row["status"]
    timestamp = now_iso()
    db.execute(
        "UPDATE claims SET type = ?, expense_date = ?, amount = ?, description = ?, "
        "document_name = ?, status = ?, updated_at = ? WHERE id = ?",
        (
            data["type"], str(data["expense_date"]).strip(), float(data["amount"]),
            str(data["description"]).strip(), str(data.get("document_name") or "").strip(),
            new_status, timestamp, row["id"],
        ),
    )

    if submit:
        add_history(db, row["id"], "submitted", note or "Claim submitted for review.", "officer")
    else:
        add_history(db, row["id"], row["status"], "Draft details updated.", "officer")

    db.commit()
    return jsonify({"claim": fetch_claim(db, reference)})


REVIEW_RULES = {
    "start_review": ("under_review", ("submitted",), False),
    "request_clarification": ("clarification_required", ("submitted", "under_review"), True),
    "approve": ("approved", ("under_review",), False),
}


@app.post("/api/claims/<reference>/review")
def review_claim(reference):
    db = get_db()
    row = db.execute("SELECT * FROM claims WHERE reference = ?", (reference,)).fetchone()
    if row is None:
        return jsonify({"error": "Claim not found."}), 404

    data = request.get_json(silent=True) or {}
    action = data.get("action")
    if action not in REVIEW_RULES:
        return jsonify({"error": "Unknown reviewer action."}), 400

    new_status, allowed_from, note_required = REVIEW_RULES[action]
    if row["status"] not in allowed_from:
        return jsonify({"error": "This claim is not in a state that allows that action."}), 409

    note = str(data.get("note") or "").strip()
    if note_required and not note:
        return jsonify({
            "error": "Some fields need attention.",
            "errors": {"note": "Explain what the officer needs to clarify."},
        }), 400
    if len(note) > 500:
        return jsonify({
            "error": "Some fields need attention.",
            "errors": {"note": "Keep the note under 500 characters."},
        }), 400

    timestamp = now_iso()
    db.execute("UPDATE claims SET status = ?, updated_at = ? WHERE id = ?",
               (new_status, timestamp, row["id"]))
    add_history(db, row["id"], new_status, note or "Status updated by reviewer.", "reviewer")
    db.commit()
    return jsonify({"claim": fetch_claim(db, reference)})


@app.post("/api/claims/<reference>/payment")
def record_payment(reference):
    db = get_db()
    row = db.execute("SELECT * FROM claims WHERE reference = ?", (reference,)).fetchone()
    if row is None:
        return jsonify({"error": "Claim not found."}), 404
    if row["status"] != "approved":
        return jsonify({"error": "Only approved claims can have a payment recorded."}), 409

    data = request.get_json(silent=True) or {}
    try:
        amount = float(data.get("amount"))
    except (TypeError, ValueError):
        return jsonify({
            "error": "Some fields need attention.",
            "errors": {"amount": "Enter the paid amount in rupees."},
        }), 400

    if amount <= 0 or amount > MAX_AMOUNT:
        return jsonify({
            "error": "Some fields need attention.",
            "errors": {"amount": "Enter an amount between 1 and 500000 rupees."},
        }), 400

    note = str(data.get("note") or "").strip()[:500]
    timestamp = now_iso()
    db.execute(
        "UPDATE claims SET status = 'payment_recorded', paid_amount = ?, updated_at = ? WHERE id = ?",
        (amount, timestamp, row["id"]),
    )
    add_history(
        db, row["id"], "payment_recorded",
        note or "Fictional payment recorded. No money was sent.", "reviewer",
    )
    db.commit()
    return jsonify({"claim": fetch_claim(db, reference)})


@app.post("/api/reset")
def reset_demo():
    db = get_db()
    seed_data(db)
    return jsonify({"ok": True, "message": "Demo data reset to the fictional seed claims."})


# Make sure the database exists before the first request.
init_db()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=True)
/* ClaimSaathi data layer
 * ------------------------------------------------------------------
 * Two clearly separated modes:
 *   - "demo"    : localStorage in this browser only
 *   - "backend" : fetch() against the Flask API (API_BASE_URL)
 *
 * There is NO automatic fallback. If the backend is unreachable,
 * a ConnectionError is raised and the UI shows a clear message.
 * ------------------------------------------------------------------ */
window.Store = (function () {
  "use strict";

  var config = window.CLAIMSATHI_CONFIG || {};
  var API_BASE = String(config.API_BASE_URL || "").replace(/\/+$/, "");
  var MODE = API_BASE ? "backend" : "demo";

  var LS_CLAIMS = "claimsaathi.claims.v1";
  var LS_COUNTER = "claimsaathi.counter.v1";

  var STATUS_LABELS = {
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under review",
    clarification_required: "Clarification required",
    approved: "Approved for payment",
    payment_recorded: "Payment recorded",
  };

  var MAX_AMOUNT = 500000;

  /* ---------------- errors ---------------- */
  function ValidationError(errors) {
    this.name = "ValidationError";
    this.errors = errors || {};
    this.message = "Some details need attention.";
  }
  ValidationError.prototype = Object.create(Error.prototype);

  function ConnectionError(message) {
    this.name = "ConnectionError";
    this.message = message;
  }
  ConnectionError.prototype = Object.create(Error.prototype);

  function NotFoundError(message) {
    this.name = "NotFoundError";
    this.message = message;
  }
  NotFoundError.prototype = Object.create(Error.prototype);

  /* ---------------- deterministic seed data ---------------- */
  function seedClaims() {
    return [
      {
        reference: "CS-1001",
        type: "medical",
        expense_date: "2025-01-14",
        amount: 1450,
        description: "Sample pharmacy and consultation bill (fictional).",
        document_name: "sample-pharmacy-bill.pdf",
        status: "payment_recorded",
        status_label: STATUS_LABELS.payment_recorded,
        paid_amount: 1450,
        created_at: "2025-01-15T09:10:00+00:00",
        updated_at: "2025-01-24T10:05:00+00:00",
        history: [
          {
            at: "2025-01-15T09:10:00+00:00",
            status: "submitted",
            status_label: STATUS_LABELS.submitted,
            note: "Demo claim submitted.",
            actor: "officer",
          },
          {
            at: "2025-01-17T10:20:00+00:00",
            status: "under_review",
            status_label: STATUS_LABELS.under_review,
            note: "Reviewer opened the claim.",
            actor: "reviewer",
          },
          {
            at: "2025-01-20T15:30:00+00:00",
            status: "approved",
            status_label: STATUS_LABELS.approved,
            note: "Sample documents look complete. Approved for payment.",
            actor: "reviewer",
          },
          {
            at: "2025-01-24T10:05:00+00:00",
            status: "payment_recorded",
            status_label: STATUS_LABELS.payment_recorded,
            note: "Fictional payment recorded. No money was sent.",
            actor: "reviewer",
          },
        ],
      },
      {
        reference: "CS-1002",
        type: "travel",
        expense_date: "2025-02-03",
        amount: 3200,
        description: "Sample duty travel fare and lodging receipt (fictional).",
        document_name: "sample-travel-receipt.pdf",
        status: "under_review",
        status_label: STATUS_LABELS.under_review,
        paid_amount: null,
        created_at: "2025-02-04T08:30:00+00:00",
        updated_at: "2025-02-06T12:15:00+00:00",
        history: [
          {
            at: "2025-02-04T08:30:00+00:00",
            status: "submitted",
            status_label: STATUS_LABELS.submitted,
            note: "Demo claim submitted.",
            actor: "officer",
          },
          {
            at: "2025-02-06T12:15:00+00:00",
            status: "under_review",
            status_label: STATUS_LABELS.under_review,
            note: "Reviewer is checking the sample receipt.",
            actor: "reviewer",
          },
        ],
      },
      {
        reference: "CS-1003",
        type: "medical",
        expense_date: "2025-02-18",
        amount: 780,
        description: "Sample diagnostic test bill (fictional).",
        document_name: "sample-test-bill.pdf",
        status: "clarification_required",
        status_label: STATUS_LABELS.clarification_required,
        paid_amount: null,
        created_at: "2025-02-19T11:00:00+00:00",
        updated_at: "2025-02-21T09:45:00+00:00",
        history: [
          {
            at: "2025-02-19T11:00:00+00:00",
            status: "submitted",
            status_label: STATUS_LABELS.submitted,
            note: "Demo claim submitted.",
            actor: "officer",
          },
          {
            at: "2025-02-20T14:20:00+00:00",
            status: "under_review",
            status_label: STATUS_LABELS.under_review,
            note: "Reviewer opened the claim.",
            actor: "reviewer",
          },
          {
            at: "2025-02-21T09:45:00+00:00",
            status: "clarification_required",
            status_label: STATUS_LABELS.clarification_required,
            note: "Please add a sample document name that matches the bill.",
            actor: "reviewer",
          },
        ],
      },
      {
        reference: "CS-1004",
        type: "travel",
        expense_date: "2025-03-05",
        amount: 2100,
        description: "Sample local transport receipt (fictional).",
        document_name: "sample-transport-receipt.pdf",
        status: "submitted",
        status_label: STATUS_LABELS.submitted,
        paid_amount: null,
        created_at: "2025-03-06T07:50:00+00:00",
        updated_at: "2025-03-06T07:50:00+00:00",
        history: [
          {
            at: "2025-03-06T07:50:00+00:00",
            status: "submitted",
            status_label: STATUS_LABELS.submitted,
            note: "Demo claim submitted.",
            actor: "officer",
          },
        ],
      },
      {
        reference: "CS-1005",
        type: "medical",
        expense_date: "2025-03-12",
        amount: 640,
        description: "Sample medicine bill (fictional), still being checked.",
        document_name: "",
        status: "draft",
        status_label: STATUS_LABELS.draft,
        paid_amount: null,
        created_at: "2025-03-12T16:05:00+00:00",
        updated_at: "2025-03-12T16:05:00+00:00",
        history: [
          {
            at: "2025-03-12T16:05:00+00:00",
            status: "draft",
            status_label: STATUS_LABELS.draft,
            note: "Draft created.",
            actor: "officer",
          },
        ],
      },
    ];
  }

  /* ---------------- demo-mode storage ---------------- */
  function saveClaims(claims) {
    try {
      localStorage.setItem(LS_CLAIMS, JSON.stringify(claims));
    } catch (e) {
      /* storage full or blocked */
    }
  }

  function loadClaims() {
    var raw = null;
    try {
      raw = localStorage.getItem(LS_CLAIMS);
    } catch (e) {
      raw = null;
    }

    if (!raw) {
      var fresh = seedClaims();
      saveClaims(fresh);
      try {
        localStorage.setItem(LS_COUNTER, "1006");
      } catch (e) {}
      return fresh;
    }
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0)
        throw new Error("bad data");
      return parsed;
    } catch (e) {
      var fallback = seedClaims();
      saveClaims(fallback);
      try {
        localStorage.setItem(LS_COUNTER, "1006");
      } catch (err) {}
      return fallback;
    }
  }

  function nextReference() {
    var n = parseInt(localStorage.getItem(LS_COUNTER) || "1006", 10);
    if (!isFinite(n)) n = 1006;
    try {
      localStorage.setItem(LS_COUNTER, String(n + 1));
    } catch (e) {}
    return "CS-" + n;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  /* ---------------- shared validation (mirrors the backend) ---------------- */
  function validateClaim(data, requireDocument) {
    var errors = {};

    if (data.type !== "medical" && data.type !== "travel") {
      errors.type = "Choose Medical or Duty Travel.";
    }

    var dateStr = String(data.expense_date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      errors.expense_date = "Enter a valid expense date.";
    } else {
      var d = new Date(dateStr + "T00:00:00");
      if (isNaN(d.getTime())) {
        errors.expense_date = "Enter a valid expense date.";
      } else {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        if (d > today)
          errors.expense_date = "Expense date cannot be in the future.";
      }
    }

    var amount = Number(data.amount);
    if (
      data.amount === "" ||
      data.amount === null ||
      data.amount === undefined ||
      !isFinite(amount) ||
      amount < 1 ||
      amount > MAX_AMOUNT
    ) {
      errors.amount = "Enter an amount between 1 and 500000 rupees.";
    }

    var desc = String(data.description || "").trim();
    if (desc.length < 5)
      errors.description = "Add a short description of at least 5 characters.";
    else if (desc.length > 200)
      errors.description = "Keep the description under 200 characters.";

    var doc = String(data.document_name || "").trim();
    if (doc.length > 120)
      errors.document_name =
        "Keep the sample document name under 120 characters.";
    if (requireDocument && !doc)
      errors.document_name = "Add a sample document name before submitting.";

    return errors;
  }

  function hasErrors(errors) {
    return Object.keys(errors).length > 0;
  }

  /* ---------------- backend-mode request helper ---------------- */
  function request(path, options) {
    var url = API_BASE + path;
    var opts = Object.assign(
      {
        headers: { "Content-Type": "application/json" },
      },
      options || {},
    );

    return fetch(url, opts)
      .catch(function () {
        throw new ConnectionError(
          "Could not reach the backend at " +
            API_BASE +
            ". " +
            "Check that the Flask server is running and that this page's origin is allowed, then reload the page.",
        );
      })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!res.ok) {
              if (body && body.errors) throw new ValidationError(body.errors);
              throw new Error(
                (body && body.error) ||
                  "The server returned status " + res.status + ".",
              );
            }
            return body;
          });
      });
  }

  /* ---------------- public API ---------------- */

  function listClaims() {
    if (MODE === "backend") {
      return request("/api/claims").then(function (body) {
        return body.claims;
      });
    }
    var claims = loadClaims().slice();
    claims.sort(function (a, b) {
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    return Promise.resolve(claims);
  }

  function getClaim(reference) {
    if (MODE === "backend") {
      return request("/api/claims/" + encodeURIComponent(reference)).then(
        function (body) {
          return body.claim;
        },
      );
    }
    var claims = loadClaims();
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].reference === reference) return Promise.resolve(claims[i]);
    }
    return Promise.reject(
      new NotFoundError(
        "Claim " + reference + " was not found in this browser.",
      ),
    );
  }

  function createClaim(payload) {
    if (MODE === "backend") {
      return request("/api/claims", {
        method: "POST",
        body: JSON.stringify(payload),
      }).then(function (body) {
        return body.claim;
      });
    }

    var submit = !!payload.submit;
    var errors = validateClaim(payload, submit);
    if (hasErrors(errors)) return Promise.reject(new ValidationError(errors));

    var claims = loadClaims();
    var ts = nowISO();
    var status = submit ? "submitted" : "draft";

    var claim = {
      reference: nextReference(),
      type: payload.type,
      expense_date: String(payload.expense_date).trim(),
      amount: Number(payload.amount),
      description: String(payload.description).trim(),
      document_name: String(payload.document_name || "").trim(),
      status: status,
      status_label: STATUS_LABELS[status],
      paid_amount: null,
      created_at: ts,
      updated_at: ts,
      history: [
        {
          at: ts,
          status: status,
          status_label: STATUS_LABELS[status],
          note: submit ? "Demo claim submitted." : "Draft created.",
          actor: "officer",
        },
      ],
    };
    claims.push(claim);
    saveClaims(claims);
    return Promise.resolve(claim);
  }

  function updateClaim(reference, payload) {
    if (MODE === "backend") {
      return request("/api/claims/" + encodeURIComponent(reference), {
        method: "PATCH",
        body: JSON.stringify(payload),
      }).then(function (body) {
        return body.claim;
      });
    }

    var claims = loadClaims();
    var claim = null;
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].reference === reference) claim = claims[i];
    }
    if (!claim)
      return Promise.reject(
        new NotFoundError(
          "Claim " + reference + " was not found in this browser.",
        ),
      );
    if (claim.status !== "draft" && claim.status !== "clarification_required") {
      return Promise.reject(
        new Error(
          "Only drafts and claims needing clarification can be edited.",
        ),
      );
    }

    var submit = !!payload.submit;
    var errors = validateClaim(payload, submit);
    var note = String(payload.note || "").trim();

    if (submit && claim.status === "clarification_required") {
      if (!note) errors.note = "Add a short reply for the reviewer.";
      else if (note.length > 500)
        errors.note = "Keep your reply under 500 characters.";
    }
    if (hasErrors(errors)) return Promise.reject(new ValidationError(errors));

    claim.type = payload.type;
    claim.expense_date = String(payload.expense_date).trim();
    claim.amount = Number(payload.amount);
    claim.description = String(payload.description).trim();
    claim.document_name = String(payload.document_name || "").trim();
    claim.updated_at = nowISO();

    if (submit) {
      claim.status = "submitted";
      claim.history.push({
        at: claim.updated_at,
        status: "submitted",
        status_label: STATUS_LABELS.submitted,
        note: note || "Claim submitted for review.",
        actor: "officer",
      });
    } else {
      claim.history.push({
        at: claim.updated_at,
        status: claim.status,
        status_label: STATUS_LABELS[claim.status],
        note: "Draft details updated.",
        actor: "officer",
      });
    }
    saveClaims(claims);
    return Promise.resolve(claim);
  }

  var REVIEW_RULES = {
    start_review: {
      to: "under_review",
      from: ["submitted"],
      noteRequired: false,
    },
    request_clarification: {
      to: "clarification_required",
      from: ["submitted", "under_review"],
      noteRequired: true,
    },
    approve: { to: "approved", from: ["under_review"], noteRequired: false },
  };

  function reviewClaim(reference, action, note) {
    if (MODE === "backend") {
      return request(
        "/api/claims/" + encodeURIComponent(reference) + "/review",
        {
          method: "POST",
          body: JSON.stringify({ action: action, note: note }),
        },
      ).then(function (body) {
        return body.claim;
      });
    }

    var rule = REVIEW_RULES[action];
    if (!rule) return Promise.reject(new Error("Unknown reviewer action."));

    var claims = loadClaims();
    var claim = null;
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].reference === reference) claim = claims[i];
    }
    if (!claim)
      return Promise.reject(
        new NotFoundError(
          "Claim " + reference + " was not found in this browser.",
        ),
      );
    if (rule.from.indexOf(claim.status) === -1) {
      return Promise.reject(
        new Error("This claim is not in a state that allows that action."),
      );
    }

    var cleanNote = String(note || "").trim();
    if (rule.noteRequired && !cleanNote) {
      return Promise.reject(
        new ValidationError({
          note: "Explain what the officer needs to clarify.",
        }),
      );
    }
    if (cleanNote.length > 500) {
      return Promise.reject(
        new ValidationError({ note: "Keep the note under 500 characters." }),
      );
    }

    claim.status = rule.to;
    claim.status_label = STATUS_LABELS[rule.to];
    claim.updated_at = nowISO();
    claim.history.push({
      at: claim.updated_at,
      status: rule.to,
      status_label: STATUS_LABELS[rule.to],
      note: cleanNote || "Status updated by reviewer.",
      actor: "reviewer",
    });
    saveClaims(claims);
    return Promise.resolve(claim);
  }

  function recordPayment(reference, amount, note) {
    if (MODE === "backend") {
      return request(
        "/api/claims/" + encodeURIComponent(reference) + "/payment",
        {
          method: "POST",
          body: JSON.stringify({ amount: amount, note: note }),
        },
      ).then(function (body) {
        return body.claim;
      });
    }

    var claims = loadClaims();
    var claim = null;
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].reference === reference) claim = claims[i];
    }
    if (!claim)
      return Promise.reject(
        new NotFoundError(
          "Claim " + reference + " was not found in this browser.",
        ),
      );
    if (claim.status !== "approved") {
      return Promise.reject(
        new Error("Only approved claims can have a payment recorded."),
      );
    }

    var value = Number(amount);
    if (
      amount === "" ||
      amount === null ||
      amount === undefined ||
      !isFinite(value) ||
      value <= 0 ||
      value > MAX_AMOUNT
    ) {
      return Promise.reject(
        new ValidationError({ amount: "Enter the paid amount in rupees." }),
      );
    }

    claim.paid_amount = value;
    claim.status = "payment_recorded";
    claim.status_label = STATUS_LABELS.payment_recorded;
    claim.updated_at = nowISO();
    claim.history.push({
      at: claim.updated_at,
      status: "payment_recorded",
      status_label: STATUS_LABELS.payment_recorded,
      note:
        String(note || "").trim() ||
        "Fictional payment recorded. No money was sent.",
      actor: "reviewer",
    });
    saveClaims(claims);
    return Promise.resolve(claim);
  }

  function reset() {
    if (MODE === "backend") {
      return request("/api/reset", { method: "POST" }).then(function () {
        return true;
      });
    }
    saveClaims(seedClaims());
    try {
      localStorage.setItem(LS_COUNTER, "1006");
    } catch (e) {}
    return Promise.resolve(true);
  }

  return {
    mode: MODE,
    apiBase: API_BASE,
    statusLabels: STATUS_LABELS,
    listClaims: listClaims,
    getClaim: getClaim,
    createClaim: createClaim,
    updateClaim: updateClaim,
    reviewClaim: reviewClaim,
    recordPayment: recordPayment,
    reset: reset,
  };
})();

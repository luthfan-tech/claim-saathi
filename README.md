# ClaimSaathi

ClaimSaathi is a **student prototype** that helps police personnel practise organising
medical and duty-travel reimbursement claims.

> **Student prototype — fictional data only — no official claims or payments.**

It is not an official government portal, is not endorsed by any department, and uses
no official seals. Do not enter real medical records, bank details, identity numbers,
police credentials, duty destinations or operational information.

## What it does

- Officer side: Home, Add an Expense (3-step form), My Claims, Claim Details, Help.
- Reviewer side: a separate **Reviewer Demo** entry for simulated review actions.
- Demonstrates one complete journey:
  create a medical expense → submit → reviewer requests clarification →
  officer replies and resubmits → reviewer approves → fictional payment is recorded.

## Two explicit modes

|               | Demo mode                                          | Backend mode                                   |
| ------------- | -------------------------------------------------- | ---------------------------------------------- |
| Where it runs | Any static host (GitHub Pages)                     | Any host that can run Python                   |
| Storage       | `localStorage` in one browser                      | SQLite on the Flask server                     |
| Banner        | "Demo mode — data is stored in this browser only." | "Backend mode — connected to …"                |
| Set up by     | `API_BASE_URL = ""` in `js/config.js`              | `API_BASE_URL = "https://…"` in `js/config.js` |

The app **never switches modes automatically**. If the backend cannot be reached in
backend mode, you get a clear "Cannot reach the backend" message.

> Python cannot run on GitHub Pages. GitHub Pages can only host the **demo** version
> of the frontend. A backend must be hosted separately (see below).

## Folder structure

---

## How to run it in 60 seconds

```bash
# Terminal 1 — demo mode
cd claimsaathi/frontend && python3 -m http.server 8000
# open http://localhost:8000

# OR: Terminal 1 + 2 — backend mode
cd claimsaathi/backend && pip install -r requirements.txt && python app.py
# then set API_BASE_URL: "http://127.0.0.1:5000" in frontend/js/config.js
# and serve the frontend from a different port, e.g. 8000
```

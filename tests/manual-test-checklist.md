# ClaimSaathi — manual test checklist

Test in a real browser. Record the browser, screen size and zoom level used.

## A. Demo mode (GitHub Pages / `file://`)

- [ ] Page loads with the banner: "Demo mode — data is stored in this browser only."
- [ ] "Student prototype — fictional data only — no official claims or payments." is visible on every screen.
- [ ] Seed claims CS-1001 … CS-1005 appear on Home and My Claims.
- [ ] Reloading the page keeps any changes (localStorage).

## B. Mobile / small screen

- [ ] At 360px wide, nothing overflows horizontally.
- [ ] Claim cards stack and remain readable; buttons are at least ~48px tall.
- [ ] Form fields, checkboxes and radio buttons can be tapped comfortably.
- [ ] The navigation wraps and stays usable.

## C. Keyboard-only use

- [ ] Tab from the top reveals "Skip to main content"; pressing Enter jumps to `<main>`.
- [ ] Every link, button, input, select and textarea is reachable by Tab.
- [ ] Focus is always visible (outline on the header is gold, elsewhere teal).
- [ ] After navigating to a new screen, focus moves to the page heading.
- [ ] Radio groups can be changed with arrow keys.
- [ ] No control requires a mouse hover.

## D. Text size and zoom

- [ ] A−, A and A+ change the text size and the choice survives a reload.
- [ ] At 200% browser zoom, no content is clipped or hidden.

## E. Form validation (Add an Expense)

- [ ] Choosing Next with an empty date shows "Enter a valid expense date." and keeps other values.
- [ ] A future expense date shows "Expense date cannot be in the future."
- [ ] Amount 0 or 600000 shows "Enter an amount between 1 and 500000 rupees."
- [ ] A 3-character description shows a specific error.
- [ ] Errors are announced by the screen reader live region.
- [ ] After fixing an error the message disappears on the next step change.
- [ ] Save as draft keeps the entered data and creates a Draft claim.

## F. Happy-path journey (the main demonstration)

- [ ] Officer: Add an Expense → Medical → today's date → amount 1250 → description → Next.
- [ ] Step 2: tick a checklist item, type `sample-bill.pdf`, Next.
- [ ] Step 3: summary shows the entered values; choose "Submit demo claim".
- [ ] A new reference (e.g. CS-1006) is shown with status "Submitted".
- [ ] Reviewer Demo: open the new claim → "Mark as under review" → status becomes "Under review".
- [ ] "Request clarification" with an empty explanation is blocked with an inline error.
- [ ] Enter an explanation → status becomes "Clarification required" and the note is on the timeline.
- [ ] Officer: open the claim → "Reply and resubmit" → write a reply → Resubmit for review.
- [ ] Status returns to "Submitted" and the reply appears on the timeline.
- [ ] Reviewer: Mark as under review → Record approval → status "Approved for payment".
- [ ] Reviewer: Record a fictional payment with a different amount → status "Payment recorded".
- [ ] The detail page shows "Amount paid (fictional record)" separately from "Amount claimed".
- [ ] The timeline shows every dated step, oldest first, and nothing was overwritten.

## G. Payments and approvals are separate

- [ ] A claim at "Approved for payment" still shows no paid amount until payment is recorded.
- [ ] No status changes by itself after waiting or reloading.

## H. Print / Save as PDF

- [ ] "Print / Save as PDF" opens the browser print dialog.
- [ ] In the print preview the header, navigation and buttons are hidden and the claim details remain.

## I. Reset Demo

- [ ] Reset Demo asks for confirmation.
- [ ] Cancelling changes nothing.
- [ ] Confirming restores exactly CS-1001 … CS-1005 and the next new claim gets CS-1006.
- [ ] The success message is announced.

## J. Backend mode

- [ ] With `API_BASE_URL` set and Flask running, the banner reads "Backend mode — connected to …".
- [ ] Claims created in the browser are visible after reloading (SQLite persistence).
- [ ] Stopping the Flask server and reloading shows "Cannot reach the backend" — the app does NOT fall back to demo data.
- [ ] A request from an origin that is not in `CLAIMSATHI_ALLOWED_ORIGINS` fails clearly.

## K. Content and language

- [ ] "Reimbursement" is explained as "money returned for expenses you paid".
- [ ] "Illustrative workflow — not a verified departmental procedure." appears on claim details.
- [ ] "Sample checklist — actual departmental requirements must be confirmed." appears in Step 2.
- [ ] No invented helpline numbers, deadlines, scheme rules or pension eligibility appear anywhere.
- [ ] The reviewer role is described as a demonstration control, not authentication.
- [ ] Status is always readable as text, never colour alone.

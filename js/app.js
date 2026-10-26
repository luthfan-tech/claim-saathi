/* ClaimSaathi frontend views, router and accessibility helpers. */
(function () {
  "use strict";

  /* ================================================================
     Small DOM helpers — textContent only, no innerHTML for user data
     ================================================================ */
  function el(tag, props) {
    var node = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var val = props[key];
        if (val === null || val === undefined || val === false) return;
        if (key === "class") node.className = val;
        else if (key === "text") node.textContent = val;
        else if (key.indexOf("on") === 0 && typeof val === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), val);
        } else {
          node.setAttribute(key, val === true ? "" : val);
        }
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    children.forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      if (Array.isArray(child)) {
        append(node, child);
        return;
      }
      node.appendChild(
        typeof child === "object"
          ? child
          : document.createTextNode(String(child)),
      );
    });
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  var view = document.getElementById("view");
  var main = document.getElementById("main");

  /* ================================================================
     Formatting
     ================================================================ */
  var TYPE_LABELS = { medical: "Medical", travel: "Duty Travel" };
  var moneyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

  function money(value) {
    return moneyFormatter.format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return "Not set";
    var d = new Date(value.length === 10 ? value + "T00:00:00" : value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateTime(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function statusLabel(status) {
    return Store.statusLabels[status] || status;
  }

  function statusBadge(status) {
    return el("span", {
      class: "status status-" + status,
      text: statusLabel(status),
    });
  }

  /* ================================================================
     Live announcements + flash messages
     ================================================================ */
  var flashMessage = null;

  function setFlash(text, kind) {
    flashMessage = { text: text, kind: kind || "success" };
  }

  function announce(message, assertive) {
    var node = document.getElementById(assertive ? "alert" : "live");
    node.textContent = "";
    window.setTimeout(function () {
      node.textContent = message;
    }, 60);
  }

  function appendFlash(container) {
    if (!flashMessage) return;
    var kind = flashMessage.kind;
    var box = el(
      "div",
      { class: "notice notice-" + kind, role: "status" },
      el("strong", { text: kind === "error" ? "There is a problem" : "Done" }),
      el("span", { text: flashMessage.text }),
    );
    container.appendChild(box);
    flashMessage = null;
  }

  /* ================================================================
     Text size controls
     ================================================================ */
  var FONT_KEY = "claimsaathi.fontsize";
  var FONT_DEFAULT = 18;

  function applyFontSize(px) {
    px = Math.min(24, Math.max(16, px));
    document.documentElement.style.setProperty("--base-font-size", px + "px");
    try {
      localStorage.setItem(FONT_KEY, String(px));
    } catch (e) {}
  }

  function initFontControls() {
    var saved = parseInt(localStorage.getItem(FONT_KEY) || "", 10);
    applyFontSize(isFinite(saved) ? saved : FONT_DEFAULT);

    document
      .getElementById("font-smaller")
      .addEventListener("click", function () {
        applyFontSize(currentFontSize() - 2);
        announce("Text size reduced.");
      });
    document
      .getElementById("font-reset")
      .addEventListener("click", function () {
        applyFontSize(FONT_DEFAULT);
        announce("Default text size.");
      });
    document
      .getElementById("font-larger")
      .addEventListener("click", function () {
        applyFontSize(currentFontSize() + 2);
        announce("Text size increased.");
      });
  }

  function currentFontSize() {
    var raw = parseInt(localStorage.getItem(FONT_KEY) || "", 10);
    return isFinite(raw) ? raw : FONT_DEFAULT;
  }

  /* ================================================================
     Mode banner
     ================================================================ */
  function initModeBanner() {
    var banner = document.getElementById("mode-banner");
    if (Store.mode === "backend") {
      banner.textContent =
        "Backend mode — connected to " +
        Store.apiBase +
        ". Claims are saved in the Flask server's SQLite database.";
    } else {
      banner.textContent = "Demo mode — data is stored in this browser only.";
    }
  }

  /* ================================================================
     Field builders
     ================================================================ */
  function makeField(opts) {
    var wrap = el("div", { class: "field" });
    var errorId = "err-" + opts.errorKey;
    wrap.appendChild(el("label", { for: opts.id, text: opts.label }));

    var input;
    if (opts.tag === "textarea") {
      input = el("textarea", {
        id: opts.id,
        name: opts.id,
        rows: opts.rows || 3,
      });
      input.value = opts.value || "";
    } else {
      input = el("input", {
        id: opts.id,
        name: opts.id,
        type: opts.type || "text",
      });
      if (opts.type === "number") {
        input.setAttribute("min", opts.min !== undefined ? opts.min : 1);
        input.setAttribute("max", opts.max !== undefined ? opts.max : 500000);
        input.setAttribute("step", "0.01");
        input.setAttribute("inputmode", "decimal");
      }
      if (opts.value !== undefined && opts.value !== null)
        input.value = opts.value;
    }
    wrap.appendChild(input);

    var describedBy = [];
    if (opts.hint) {
      var hintId = opts.id + "-hint";
      wrap.appendChild(el("p", { class: "hint", id: hintId, text: opts.hint }));
      describedBy.push(hintId);
    }
    wrap.appendChild(el("p", { class: "field-error", id: errorId }));
    describedBy.push(errorId);
    input.setAttribute("aria-describedby", describedBy.join(" "));

    return { wrap: wrap, input: input };
  }

  function makeRadioGroup(opts) {
    var fs = el("fieldset", { class: "field" });
    fs.appendChild(el("legend", { text: opts.label }));
    var row = el("div", { class: "radio-row" });

    opts.options.forEach(function (option) {
      var id = opts.id + "-" + option.value;
      var input = el("input", {
        type: "radio",
        name: opts.id,
        id: id,
        value: option.value,
      });
      if (String(opts.value) === String(option.value)) input.checked = true;
      row.appendChild(
        el(
          "div",
          { class: "radio-option" },
          input,
          el("label", { for: id, text: option.label }),
        ),
      );
    });
    fs.appendChild(row);
    fs.appendChild(
      el("p", { class: "field-error", id: "err-" + opts.errorKey }),
    );
    return { wrap: fs, inputs: row.querySelectorAll("input") };
  }

  /* Show inline validation errors without destroying entered data. */
  function showFieldErrors(errors, root) {
    var scope = root || document;
    scope.querySelectorAll(".field-error").forEach(function (node) {
      node.textContent = "";
    });
    scope.querySelectorAll("[aria-invalid]").forEach(function (node) {
      node.removeAttribute("aria-invalid");
    });

    var firstField = null;
    Object.keys(errors).forEach(function (key) {
      var errorNode = document.getElementById("err-" + key);
      if (errorNode) errorNode.textContent = errors[key];

      var field = document.getElementById(key);
      if (field) {
        if (field.type === "radio") {
          var group = scope.querySelectorAll('input[name="' + key + '"]');
          Array.prototype.forEach.call(group, function (g) {
            g.setAttribute("aria-invalid", "true");
          });
          if (!firstField) firstField = group[0];
        } else {
          field.setAttribute("aria-invalid", "true");
          if (!firstField) firstField = field;
        }
      }
    });

    if (firstField) firstField.focus();
    announce(
      "Some details need attention. " +
        Object.keys(errors).length +
        " field(s) have errors.",
      true,
    );
  }

  /* ================================================================
     Shared claim rendering
     ================================================================ */
  function claimCard(claim, linkHref) {
    return el(
      "li",
      { class: "claim-card" },
      el(
        "div",
        { class: "claim-card-top" },
        el("p", { class: "claim-ref", text: claim.reference }),
        statusBadge(claim.status),
      ),
      el("p", {
        class: "claim-summary",
        text:
          (TYPE_LABELS[claim.type] || claim.type) +
          " • " +
          formatDate(claim.expense_date),
      }),
      el("p", {
        class: "claim-amount",
        text: money(claim.amount) + " claimed",
      }),
      el("a", {
        class: "btn btn-secondary",
        href: linkHref,
        text: "Open claim details",
      }),
    );
  }

  function summaryList(claim) {
    var dl = el("dl", { class: "summary" });
    function row(label, value) {
      dl.appendChild(
        el(
          "div",
          { class: "summary-row" },
          el("dt", { text: label }),
          el("dd", { text: value }),
        ),
      );
    }
    row("Claim reference", claim.reference);
    row("Expense type", TYPE_LABELS[claim.type] || claim.type);
    row("Expense date", formatDate(claim.expense_date));
    row("Amount claimed", money(claim.amount));
    if (claim.paid_amount !== null && claim.paid_amount !== undefined) {
      row("Amount paid (fictional record)", money(claim.paid_amount));
    }
    row("Sample document", claim.document_name || "Not provided");
    return dl;
  }

  function timelineNode(claim) {
    var ol = el("ol", { class: "timeline" });
    claim.history.forEach(function (entry) {
      var item = el(
        "li",
        { class: "timeline-item" },
        el("p", { class: "timeline-status", text: statusLabel(entry.status) }),
        el("p", {
          class: "timeline-meta",
          text:
            formatDateTime(entry.at) +
            " • " +
            (entry.actor === "reviewer" ? "Reviewer (simulated)" : "Officer"),
        }),
      );
      if (entry.note)
        item.appendChild(el("p", { class: "timeline-note", text: entry.note }));
      ol.appendChild(item);
    });
    return ol;
  }

  function latestReviewerNote(claim) {
    for (var i = claim.history.length - 1; i >= 0; i--) {
      if (claim.history[i].actor === "reviewer" && claim.history[i].note)
        return claim.history[i];
    }
    return null;
  }

  function nextActionText(claim) {
    switch (claim.status) {
      case "draft":
        return "This is a draft. Nothing has been sent for review. Submit it when you are ready.";
      case "submitted":
        return "No action is needed from you. A reviewer can pick this up in the Reviewer Demo.";
      case "under_review":
        return "No action is needed from you. A reviewer is looking at this claim.";
      case "clarification_required":
        return "A reviewer has asked a question. Read the note below, add your reply, and resubmit for review.";
      case "approved":
        return "Approved for payment. No payment has been recorded yet.";
      case "payment_recorded":
        return "A fictional payment has been recorded. This prototype does not send money.";
      default:
        return "Check the timeline below.";
    }
  }

  function detailHeader(claim, reviewerMode) {
    return el(
      "div",
      { class: "card" },
      el("p", { class: "claim-ref", text: "Claim " + claim.reference }),
      el("h1", {
        text: reviewerMode ? "Review this demo claim" : "Claim details",
      }),
      el("p", {}, "Status: ", statusBadge(claim.status)),
      el("p", {
        class: "hint",
        text: "Illustrative workflow — not a verified departmental procedure.",
      }),
    );
  }

  /* ================================================================
     Router
     ================================================================ */
  var firstRender = true;

  function route() {
    var hash = location.hash || "#/home";
    var parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);

    highlightNav(parts[0] || "home");

    var promise;
    try {
      if (parts.length === 0 || parts[0] === "home") promise = renderHome();
      else if (parts[0] === "add") promise = renderAdd();
      else if (parts[0] === "claims") promise = renderClaims();
      else if (parts[0] === "claim" && parts[1])
        promise = renderClaimDetail(decodeURIComponent(parts[1]));
      else if (parts[0] === "review" && parts[1])
        promise = renderReviewerDetail(decodeURIComponent(parts[1]));
      else if (parts[0] === "review") promise = renderReviewerList();
      else if (parts[0] === "help") promise = renderHelp();
      else promise = renderNotFound();
    } catch (err) {
      promise = renderFatal(err);
    }

    Promise.resolve(promise)
      .then(function () {
        if (!firstRender) {
          window.scrollTo(0, 0);
          var heading = view.querySelector("h1");
          if (heading) {
            heading.setAttribute("tabindex", "-1");
            heading.focus();
          }
        }
        firstRender = false;
      })
      .catch(renderFatal);
  }

  function highlightNav(routeName) {
    var key = routeName === "claim" ? "claims" : routeName;
    document
      .querySelectorAll(".main-nav a[data-route]")
      .forEach(function (link) {
        if (link.getAttribute("data-route") === key)
          link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
  }

  function go(hash) {
    location.hash = hash;
  }

  function setBusy(message) {
    clear(view);
    view.appendChild(
      el("div", { class: "card loading", role: "status", text: message }),
    );
  }

  function renderNotFound() {
    clear(view);
    view.appendChild(
      el(
        "div",
        { class: "card" },
        el("h1", { text: "Page not found" }),
        el("p", {
          text: "That page does not exist. Use the navigation above, or go back to the home page.",
        }),
        el("a", {
          class: "btn btn-primary",
          href: "#/home",
          text: "Go to Home",
        }),
      ),
    );
    return Promise.resolve();
  }

  function renderFatal(err) {
    clear(view);
    var isConnection = err && err.name === "ConnectionError";
    var box = el(
      "div",
      { class: "card" },
      el("h1", {
        text: isConnection
          ? "Cannot reach the backend"
          : "Something went wrong",
      }),
      el("p", {
        text: (err && err.message) || "An unexpected problem occurred.",
      }),
    );
    if (isConnection) {
      box.appendChild(
        el("p", {
          text:
            "This page is set to Backend mode, so it will not fall back to browser-only demo data. " +
            "Start the Flask server, check API_BASE_URL in js/config.js, then reload the page.",
        }),
      );
    }
    box.appendChild(
      el(
        "div",
        { class: "btn-row" },
        el("a", {
          class: "btn btn-primary",
          href: "#/home",
          text: "Go to Home",
        }),
      ),
    );
    view.appendChild(box);
    announce(
      isConnection ? "Cannot reach the backend." : "Something went wrong.",
      true,
    );
    return Promise.resolve();
  }

  /* ================================================================
     Home
     ================================================================ */
  function computeStats(claims) {
    var submittedClaims = claims.filter(function (c) {
      return c.status !== "draft";
    });
    var totalClaimed = submittedClaims.reduce(function (sum, c) {
      return sum + Number(c.amount);
    }, 0);
    var awaiting = claims.filter(function (c) {
      return c.status === "submitted" || c.status === "under_review";
    }).length;
    var needsAction = claims.filter(function (c) {
      return c.status === "draft" || c.status === "clarification_required";
    }).length;
    var paidTotal = claims.reduce(function (sum, c) {
      return sum + (Number(c.paid_amount) || 0);
    }, 0);
    var paidCount = claims.filter(function (c) {
      return c.status === "payment_recorded";
    }).length;
    return {
      totalClaimed: totalClaimed,
      submittedCount: submittedClaims.length,
      awaiting: awaiting,
      needsAction: needsAction,
      paidTotal: paidTotal,
      paidCount: paidCount,
    };
  }

  function statCard(label, value, note) {
    var card = el(
      "li",
      { class: "stat-card" },
      el("p", { class: "stat-label", text: label }),
      el("p", { class: "stat-value", text: value }),
    );
    if (note) card.appendChild(el("p", { class: "stat-note", text: note }));
    return card;
  }

  function renderHome() {
    setBusy("Loading your claims…");
    return Store.listClaims().then(function (claims) {
      var stats = computeStats(claims);
      var recent = claims.slice(0, 4);

      clear(view);
      appendFlash(view);

      view.appendChild(el("h1", { text: "Manage your expense claims" }));
      view.appendChild(
        el("p", {
          class: "lead",
          text:
            "This practice tool keeps your medical and duty-travel expense claims in one place. " +
            "Reimbursement means money returned for expenses you paid. Every claim here is fictional.",
        }),
      );

      view.appendChild(
        el(
          "div",
          { class: "btn-row" },
          el("a", {
            class: "btn btn-primary",
            href: "#/add",
            text: "Add an Expense",
          }),
          el("a", {
            class: "btn btn-secondary",
            href: "#/claims",
            text: "View My Claims",
          }),
        ),
      );

      view.appendChild(
        el(
          "ul",
          { class: "stat-grid" },
          statCard(
            "Total amount claimed",
            money(stats.totalClaimed),
            stats.submittedCount +
              " claim(s) submitted. Claimed amounts are requests, not guaranteed payments.",
          ),
          statCard(
            "Claims awaiting review",
            String(stats.awaiting),
            "Submitted or under review.",
          ),
          statCard(
            "Claims needing your action",
            String(stats.needsAction),
            "Drafts and clarification requests.",
          ),
          statCard(
            "Payments recorded",
            money(stats.paidTotal),
            stats.paidCount + " fictional payment(s).",
          ),
        ),
      );

      view.appendChild(el("h2", { text: "Recent claims" }));
      if (recent.length === 0) {
        view.appendChild(
          el(
            "div",
            { class: "notice notice-info" },
            el("strong", { text: "No claims yet" }),
            "Start by adding an expense. You can save a draft if you are not ready to submit.",
          ),
        );
      } else {
        var list = el("ul", { class: "claim-list" });
        recent.forEach(function (claim) {
          list.appendChild(
            claimCard(claim, "#/claim/" + encodeURIComponent(claim.reference)),
          );
        });
        view.appendChild(list);
      }

      var notice = el(
        "div",
        { class: "notice notice-info" },
        el("strong", { text: "About this tool" }),
        "ClaimSaathi is a student prototype. It cannot pay money, and nothing you do here is an official claim.",
      );
      view.appendChild(notice);
    });
  }

  /* ================================================================
     Add an Expense (3-step form)
     ================================================================ */
  var FORM_DRAFT_KEY = "claimsaathi.form.v1";

  function emptyFormData() {
    return {
      type: "medical",
      expense_date: "",
      amount: "",
      description: "",
      document_name: "",
      checklist: [],
    };
  }

  function loadFormDraft() {
    try {
      var raw = localStorage.getItem(FORM_DRAFT_KEY);
      if (!raw) return emptyFormData();
      var parsed = JSON.parse(raw);
      var base = emptyFormData();
      Object.keys(base).forEach(function (key) {
        if (parsed[key] !== undefined) base[key] = parsed[key];
      });
      return base;
    } catch (e) {
      return emptyFormData();
    }
  }

  function saveFormDraft(data) {
    try {
      localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function clearFormDraft() {
    try {
      localStorage.removeItem(FORM_DRAFT_KEY);
    } catch (e) {}
  }

  function validateStepOne(data) {
    var errors = {};
    if (data.type !== "medical" && data.type !== "travel")
      errors.type = "Choose Medical or Duty Travel.";

    var dateStr = String(data.expense_date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      errors.expense_date = "Enter a valid expense date.";
    } else {
      var d = new Date(dateStr + "T00:00:00");
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(d.getTime()))
        errors.expense_date = "Enter a valid expense date.";
      else if (d > today)
        errors.expense_date = "Expense date cannot be in the future.";
    }

    var amount = Number(data.amount);
    if (
      data.amount === "" ||
      !isFinite(amount) ||
      amount < 1 ||
      amount > 500000
    ) {
      errors.amount = "Enter an amount between 1 and 500000 rupees.";
    }

    var desc = String(data.description || "").trim();
    if (desc.length < 5)
      errors.description = "Add a short description of at least 5 characters.";
    else if (desc.length > 200)
      errors.description = "Keep the description under 200 characters.";

    return errors;
  }

  function renderAdd() {
    var data = loadFormDraft();
    var step = 1;
    var stepPanels = {};

    clear(view);
    appendFlash(view);

    view.appendChild(el("h1", { text: "Add an expense" }));
    view.appendChild(
      el("p", {
        class: "lead",
        text: "Three short steps. You can save a draft at any time and come back later.",
      }),
    );

    view.appendChild(
      el(
        "div",
        { class: "notice notice-warn" },
        el("strong", { text: "Fictional practice data only" }),
        "Do not enter real medical records, diagnoses, bank details, identity numbers, police credentials or travel destinations. " +
          "This prototype stores a document name only — it never uploads files.",
      ),
    );

    var stepsList = el("ol", { class: "steps", "aria-label": "Form progress" });
    ["Expense details", "Sample documents", "Review and submit"].forEach(
      function (label, index) {
        stepsList.appendChild(
          el("li", { "data-step": String(index + 1), text: label }),
        );
      },
    );
    view.appendChild(stepsList);

    var form = el("form", {
      id: "expense-form",
      novalidate: true,
      autocomplete: "off",
    });
    form.addEventListener("input", function () {
      collect();
    });
    form.addEventListener("change", function () {
      collect();
    });

    /* ---- Step 1 ---- */
    var step1 = el("section", {
      class: "card",
      "aria-label": "Step 1: Expense details",
    });
    step1.appendChild(el("h2", { text: "Step 1 of 3: Expense details" }));

    var typeGroup = makeRadioGroup({
      id: "type",
      label: "Expense type",
      errorKey: "type",
      value: data.type,
      options: [
        { value: "medical", label: "Medical" },
        { value: "travel", label: "Duty Travel" },
      ],
    });
    step1.appendChild(typeGroup.wrap);

    var dateField = makeField({
      id: "expense_date",
      label: "Expense date",
      type: "date",
      value: data.expense_date,
      errorKey: "expense_date",
      hint: "The date printed on your sample bill or receipt.",
    });
    step1.appendChild(dateField.wrap);

    var amountField = makeField({
      id: "amount",
      label: "Amount in INR",
      type: "number",
      value: data.amount,
      errorKey: "amount",
      hint: "For example 1250. This is a request, not a guaranteed payment.",
    });
    step1.appendChild(amountField.wrap);

    var descField = makeField({
      id: "description",
      label: "Short description",
      tag: "textarea",
      value: data.description,
      errorKey: "description",
      hint: "For example: Sample pharmacy bill. Do not include medical details.",
    });
    step1.appendChild(descField.wrap);

    var step1Buttons = el(
      "div",
      { class: "btn-row" },
      el("button", {
        type: "button",
        class: "btn btn-secondary",
        text: "Save as draft",
        onclick: saveDraft,
      }),
      el("button", {
        type: "button",
        class: "btn btn-primary",
        text: "Next: Sample documents",
        onclick: nextFromStep1,
      }),
    );
    step1.appendChild(step1Buttons);

    /* ---- Step 2 ---- */
    var step2 = el("section", {
      class: "card",
      "aria-label": "Step 2: Sample documents",
    });
    step2.appendChild(el("h2", { text: "Step 2 of 3: Sample documents" }));
    step2.appendChild(
      el(
        "div",
        { class: "notice notice-info" },
        el("strong", {
          text: "Sample checklist — actual departmental requirements must be confirmed.",
        }),
        "Tick anything you would normally keep. This checklist is not a rule, and it does not save anything official.",
      ),
    );

    var checklist = el("ul", { class: "checklist" });
    [
      "A sample bill or receipt (fictional)",
      "A sample prescription or referral note (fictional)",
      "A sample travel authorisation note (fictional)",
    ].forEach(function (label, index) {
      var id = "check-" + index;
      var input = el("input", {
        type: "checkbox",
        id: id,
        name: "checklist",
        value: label,
      });
      if ((data.checklist || []).indexOf(label) !== -1) input.checked = true;
      checklist.appendChild(
        el("li", {}, input, el("label", { for: id, text: label })),
      );
    });
    step2.appendChild(checklist);

    var docField = makeField({
      id: "document_name",
      label: "Sample document name or sample filename",
      value: data.document_name,
      errorKey: "document_name",
      hint: "Example: sample-pharmacy-bill.pdf. Type a name only — do not upload real documents.",
    });
    step2.appendChild(docField.wrap);

    step2.appendChild(
      el(
        "div",
        { class: "btn-row" },
        el("button", {
          type: "button",
          class: "btn btn-secondary",
          text: "Back",
          onclick: function () {
            goToStep(1);
          },
        }),
        el("button", {
          type: "button",
          class: "btn btn-secondary",
          text: "Save as draft",
          onclick: saveDraft,
        }),
        el("button", {
          type: "button",
          class: "btn btn-primary",
          text: "Next: Review",
          onclick: nextFromStep2,
        }),
      ),
    );

    /* ---- Step 3 ---- */
    var step3 = el("section", {
      class: "card",
      "aria-label": "Step 3: Review and submit",
    });
    step3.appendChild(el("h2", { text: "Step 3 of 3: Review and submit" }));
    var reviewArea = el("div", { id: "review-area" });
    step3.appendChild(reviewArea);
    step3.appendChild(
      el(
        "div",
        { class: "notice notice-info" },
        el("strong", { text: "This is not an official submission." }),
        "Submitting creates a fictional demo claim with a demo reference number. No department receives it.",
      ),
    );
    step3.appendChild(
      el(
        "div",
        { class: "btn-row" },
        el("button", {
          type: "button",
          class: "btn btn-secondary",
          text: "Back",
          onclick: function () {
            goToStep(2);
          },
        }),
        el("button", {
          type: "button",
          class: "btn btn-secondary",
          text: "Save as draft",
          onclick: saveDraft,
        }),
        el("button", {
          type: "submit",
          class: "btn btn-primary",
          text: "Submit demo claim",
        }),
      ),
    );

    stepPanels[1] = step1;
    stepPanels[2] = step2;
    stepPanels[3] = step3;
    form.appendChild(step1);
    form.appendChild(step2);
    form.appendChild(step3);
    view.appendChild(form);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitClaim(true);
    });

    /* ---- helpers ---- */
    function collect() {
      var formNode = document.getElementById("expense-form");
      if (!formNode) return;
      var fd = new FormData(formNode);
      if (fd.get("type")) data.type = String(fd.get("type"));
      data.expense_date = String(fd.get("expense_date") || "");
      data.amount = String(fd.get("amount") || "");
      data.description = String(fd.get("description") || "");
      data.document_name = String(fd.get("document_name") || "");
      data.checklist = fd.getAll("checklist").map(String);
      saveFormDraft(data);
    }

    function goToStep(next) {
      collect();
      step = next;
      Object.keys(stepPanels).forEach(function (key) {
        stepPanels[key].hidden = Number(key) !== step;
      });
      Array.prototype.forEach.call(stepsList.children, function (li, index) {
        if (index + 1 === step) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");
      });
      if (step === 3) buildReview();
      var heading = stepPanels[step].querySelector("h2");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
      }
    }

    function nextFromStep1() {
      collect();
      var errors = validateStepOne(data);
      if (Object.keys(errors).length) {
        showFieldErrors(errors, step1);
        return;
      }
      showFieldErrors({}, step1);
      goToStep(2);
      announce("Step 2 of 3: Sample documents.");
    }

    function nextFromStep2() {
      collect();
      if (String(data.document_name || "").trim().length > 120) {
        showFieldErrors(
          {
            document_name:
              "Keep the sample document name under 120 characters.",
          },
          step2,
        );
        return;
      }
      showFieldErrors({}, step2);
      goToStep(3);
      announce("Step 3 of 3: Review and submit.");
    }

    function buildReview() {
      clear(reviewArea);
      var dl = el("dl", { class: "summary" });
      function row(label, value) {
        dl.appendChild(
          el(
            "div",
            { class: "summary-row" },
            el("dt", { text: label }),
            el("dd", { text: value }),
          ),
        );
      }
      row("Expense type", TYPE_LABELS[data.type] || "Not chosen");
      row("Expense date", formatDate(data.expense_date));
      row("Amount claimed", money(data.amount));
      row("Short description", data.description || "Not provided");
      row("Sample document", data.document_name || "Not provided");
      row("Checklist items ticked", String((data.checklist || []).length));
      reviewArea.appendChild(dl);
    }

    function payload(submit) {
      return {
        type: data.type,
        expense_date: data.expense_date,
        amount: data.amount,
        description: data.description,
        document_name: data.document_name,
        submit: submit,
      };
    }

    function saveDraft() {
      collect();
      if (!String(data.description || "").trim()) {
        data.description = "Draft claim (description not filled yet).";
      }
      Store.createClaim(payload(false))
        .then(function (claim) {
          clearFormDraft();
          setFlash(
            "Draft saved as " +
              claim.reference +
              ". You can finish it from My Claims.",
            "success",
          );
          go("#/claim/" + encodeURIComponent(claim.reference));
        })
        .catch(handleFormError);
    }

    function submitClaim() {
      collect();
      var errors = validateStepOne(data);
      if (errors.type) {
        goToStep(1);
        showFieldErrors({ type: errors.type }, step1);
        return;
      }
      if (errors.expense_date || errors.amount || errors.description) {
        goToStep(1);
        showFieldErrors(errors, step1);
        return;
      }
      if (!String(data.document_name || "").trim()) {
        goToStep(2);
        showFieldErrors(
          { document_name: "Add a sample document name before submitting." },
          step2,
        );
        return;
      }

      Store.createClaim(payload(true))
        .then(function (claim) {
          clearFormDraft();
          setFlash(
            "Demo claim " +
              claim.reference +
              " was submitted for practice review. No official claim was made.",
            "success",
          );
          go("#/claim/" + encodeURIComponent(claim.reference));
        })
        .catch(handleFormError);
    }

    function handleFormError(err) {
      if (err && err.name === "ValidationError") {
        showFieldErrors(err.errors, form);
        return;
      }
      setFlash(
        (err && err.message) || "The claim could not be saved.",
        "error",
      );
      announce((err && err.message) || "The claim could not be saved.", true);
      appendFlash(view);
    }

    goToStep(1);
    return Promise.resolve();
  }

  /* ================================================================
     My Claims
     ================================================================ */
  function filterClaims(claims, filters) {
    var q = String(filters.q || "")
      .trim()
      .toLowerCase();
    return claims.filter(function (claim) {
      if (filters.type && claim.type !== filters.type) return false;
      if (filters.status && claim.status !== filters.status) return false;
      if (q && claim.reference.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function renderClaims() {
    setBusy("Loading your claims…");
    return Store.listClaims().then(function (claims) {
      clear(view);
      appendFlash(view);

      view.appendChild(el("h1", { text: "My claims" }));
      view.appendChild(
        el("p", {
          class: "lead",
          text: "Search by claim reference, or filter by expense type and status.",
        }),
      );

      var filters = { q: "", type: "", status: "" };

      var searchField = makeField({
        id: "filter-q",
        label: "Search by claim reference",
        type: "search",
        errorKey: "filter-q",
        hint: "For example CS-1001.",
      });
      var typeSelect = makeField({
        id: "filter-type",
        label: "Expense type",
        tag: "select",
        errorKey: "filter-type",
      });
      typeSelect.input.replaceWith(
        (function () {
          var select = el("select", { id: "filter-type", name: "filter-type" });
          [
            ["", "All types"],
            ["medical", "Medical"],
            ["travel", "Duty Travel"],
          ].forEach(function (pair) {
            select.appendChild(el("option", { value: pair[0], text: pair[1] }));
          });
          return select;
        })(),
      );

      var statusSelect = (function () {
        var select = el("select", {
          id: "filter-status",
          name: "filter-status",
        });
        select.appendChild(el("option", { value: "", text: "All statuses" }));
        Object.keys(Store.statusLabels).forEach(function (key) {
          select.appendChild(
            el("option", { value: key, text: Store.statusLabels[key] }),
          );
        });
        var wrap = el(
          "div",
          { class: "field" },
          el("label", { for: "filter-status", text: "Status" }),
          select,
        );
        return wrap;
      })();

      var filterBar = el(
        "div",
        { class: "filters", role: "search" },
        searchField.wrap,
        typeSelect.wrap,
        statusSelect,
      );
      view.appendChild(filterBar);

      var results = el("div", { id: "claims-results" });
      view.appendChild(results);

      function update() {
        filters.q = searchField.input.value;
        filters.type = document.getElementById("filter-type").value;
        filters.status = document.getElementById("filter-status").value;

        var matching = filterClaims(claims, filters);
        clear(results);

        var countText =
          claims.length === 0
            ? "No claims yet"
            : "Showing " +
              matching.length +
              " of " +
              claims.length +
              " claim(s)";
        results.appendChild(
          el("p", { class: "result-count", role: "status", text: countText }),
        );

        if (claims.length === 0) {
          results.appendChild(
            el(
              "div",
              { class: "notice notice-info" },
              el("strong", { text: "You have no claims yet" }),
              "Add an expense to create your first practice claim.",
            ),
          );
          results.appendChild(
            el(
              "div",
              { class: "btn-row" },
              el("a", {
                class: "btn btn-primary",
                href: "#/add",
                text: "Add an Expense",
              }),
            ),
          );
          return;
        }

        if (matching.length === 0) {
          results.appendChild(
            el(
              "div",
              { class: "notice notice-info" },
              el("strong", { text: "No claims match your search" }),
              "Try a different reference, type or status.",
            ),
          );
          results.appendChild(
            el(
              "div",
              { class: "btn-row" },
              el("button", {
                type: "button",
                class: "btn btn-secondary",
                text: "Clear filters",
                onclick: function () {
                  searchField.input.value = "";
                  document.getElementById("filter-type").value = "";
                  document.getElementById("filter-status").value = "";
                  update();
                },
              }),
            ),
          );
          return;
        }

        var list = el("ul", { class: "claim-list" });
        matching.forEach(function (claim) {
          list.appendChild(
            claimCard(claim, "#/claim/" + encodeURIComponent(claim.reference)),
          );
        });
        results.appendChild(list);
      }

      filterBar.addEventListener("input", update);
      filterBar.addEventListener("change", update);
      update();
    });
  }

  /* ================================================================
     Claim details (officer)
     ================================================================ */
  function renderClaimDetail(reference) {
    setBusy("Loading claim " + reference + "…");
    return Store.getClaim(reference)
      .then(function (claim) {
        clear(view);
        appendFlash(view);

        view.appendChild(detailHeader(claim, false));
        view.appendChild(
          el(
            "div",
            { class: "card" },
            el("h2", { text: "Claim summary" }),
            summaryList(claim),
          ),
        );

        var note = latestReviewerNote(claim);
        view.appendChild(
          el(
            "div",
            { class: "card" },
            el("h2", { text: "Latest reviewer note" }),
            note
              ? el(
                  "div",
                  {},
                  el("p", { text: note.note }),
                  el("p", {
                    class: "hint",
                    text:
                      "Recorded " +
                      formatDateTime(note.at) +
                      " by a simulated reviewer.",
                  }),
                )
              : el("p", { text: "No reviewer note has been added yet." }),
          ),
        );

        view.appendChild(
          el(
            "div",
            { class: "card" },
            el("h2", { text: "Next action" }),
            el("p", { text: nextActionText(claim) }),
            el("p", {
              class: "hint",
              text: "Statuses never change automatically. Nothing is marked paid unless a reviewer records it.",
            }),
          ),
        );

        if (
          claim.status === "draft" ||
          claim.status === "clarification_required"
        ) {
          view.appendChild(buildOfficerEditForm(claim));
        }

        view.appendChild(
          el(
            "div",
            { class: "card" },
            el("h2", { text: "Status timeline" }),
            timelineNode(claim),
          ),
        );

        view.appendChild(
          el(
            "div",
            { class: "btn-row no-print" },
            el("button", {
              type: "button",
              class: "btn btn-secondary",
              text: "Print / Save as PDF",
              onclick: function () {
                window.print();
              },
            }),
            el("a", {
              class: "btn btn-secondary",
              href: "#/claims",
              text: "Back to My Claims",
            }),
          ),
        );
      })
      .catch(renderFatal);
  }

  function buildOfficerEditForm(claim) {
    var isClarification = claim.status === "clarification_required";
    var card = el("div", { class: "card" });
    card.appendChild(
      el("h2", {
        text: isClarification ? "Reply and resubmit" : "Finish this draft",
      }),
    );

    var form = el("form", { novalidate: true, autocomplete: "off" });
    var typeGroup = makeRadioGroup({
      id: "edit-type",
      label: "Expense type",
      errorKey: "type",
      value: claim.type,
      options: [
        { value: "medical", label: "Medical" },
        { value: "travel", label: "Duty Travel" },
      ],
    });
    form.appendChild(typeGroup.wrap);

    var dateField = makeField({
      id: "edit-expense_date",
      label: "Expense date",
      type: "date",
      value: claim.expense_date,
      errorKey: "expense_date",
    });
    form.appendChild(dateField.wrap);

    var amountField = makeField({
      id: "edit-amount",
      label: "Amount in INR",
      type: "number",
      value: claim.amount,
      errorKey: "amount",
    });
    form.appendChild(amountField.wrap);

    var descField = makeField({
      id: "edit-description",
      label: "Short description",
      tag: "textarea",
      value: claim.description,
      errorKey: "description",
    });
    form.appendChild(descField.wrap);

    var docField = makeField({
      id: "edit-document_name",
      label: "Sample document name",
      value: claim.document_name,
      errorKey: "document_name",
      hint: "Type a name only. Do not upload real documents.",
    });
    form.appendChild(docField.wrap);

    var noteField = null;
    if (isClarification) {
      noteField = makeField({
        id: "edit-note",
        label: "Your reply to the reviewer",
        tag: "textarea",
        value: "",
        errorKey: "note",
        hint: "Explain briefly what you changed. Do not include medical or operational details.",
      });
      form.appendChild(noteField.wrap);
    }

    function collect() {
      return {
        type:
          (form.querySelector('input[name="edit-type"]:checked') || {}).value ||
          "",
        expense_date: document.getElementById("edit-expense_date").value,
        amount: document.getElementById("edit-amount").value,
        description: document.getElementById("edit-description").value,
        document_name: document.getElementById("edit-document_name").value,
        note: noteField ? document.getElementById("edit-note").value : "",
        submit: true,
      };
    }

    function handle(err) {
      if (err && err.name === "ValidationError") {
        showFieldErrors(err.errors, form);
        return;
      }
      setFlash(
        (err && err.message) || "The claim could not be updated.",
        "error",
      );
      announce((err && err.message) || "The claim could not be updated.", true);
      appendFlash(view);
    }

    form.appendChild(
      el(
        "div",
        { class: "btn-row" },
        el("button", {
          type: "button",
          class: "btn btn-primary",
          text: isClarification
            ? "Resubmit for review"
            : "Submit this draft for review",
          onclick: function () {
            var payload = collect();
            payload.submit = true;
            Store.updateClaim(claim.reference, payload)
              .then(function () {
                setFlash(
                  "Claim " +
                    claim.reference +
                    " was resubmitted for practice review.",
                  "success",
                );
                go("#/claim/" + encodeURIComponent(claim.reference));
              })
              .catch(handle);
          },
        }),
        el("button", {
          type: "button",
          class: "btn btn-secondary",
          text: "Save changes without submitting",
          onclick: function () {
            var payload = collect();
            payload.submit = false;
            Store.updateClaim(claim.reference, payload)
              .then(function () {
                setFlash(
                  "Your changes were saved. The claim is still a draft.",
                  "success",
                );
                go("#/claim/" + encodeURIComponent(claim.reference));
              })
              .catch(handle);
          },
        }),
      ),
    );

    form.addEventListener("submit", function (event) {
      event.preventDefault();
    });
    card.appendChild(form);
    return card;
  }

  /* ================================================================
     Reviewer demo
     ================================================================ */
  function renderReviewerList() {
    setBusy("Loading claims for review…");
    return Store.listClaims().then(function (claims) {
      var queue = claims.filter(function (c) {
        return c.status !== "draft";
      });

      clear(view);
      appendFlash(view);

      view.appendChild(el("h1", { text: "Reviewer Demo" }));
      view.appendChild(
        el(
          "div",
          { class: "notice notice-warn" },
          el("strong", { text: "Simulated reviewer role" }),
          "The role switch is a demonstration control only. It is not secure authentication and does not check who you are. " +
            "Reviewer actions here are simulated and are not official decisions.",
        ),
      );

      view.appendChild(
        el("p", {
          class: "lead",
          text:
            "Open a submitted fictional claim to move it through the practice workflow: " +
            "under review, clarification, approval, and a fictional payment.",
        }),
      );

      if (queue.length === 0) {
        view.appendChild(
          el(
            "div",
            { class: "notice notice-info" },
            el("strong", { text: "Nothing to review yet" }),
            "Submit a demo claim from the officer side first.",
          ),
        );
        return;
      }

      var list = el("ul", { class: "claim-list" });
      queue.forEach(function (claim) {
        list.appendChild(
          claimCard(claim, "#/review/" + encodeURIComponent(claim.reference)),
        );
      });
      view.appendChild(list);
    });
  }

  function renderReviewerDetail(reference) {
    setBusy("Loading claim " + reference + "…");
    return Store.getClaim(reference)
      .then(function (claim) {
        clear(view);
        appendFlash(view);

        view.appendChild(detailHeader(claim, true));
        view.appendChild(
          el(
            "div",
            { class: "notice notice-warn" },
            el("strong", { text: "Simulated reviewer actions" }),
            "Nothing on this page is an official decision. No money is released.",
          ),
        );

        view.appendChild(
          el(
            "div",
            { class: "card" },
            el("h2", { text: "Claim summary" }),
            summaryList(claim),
          ),
        );

        view.appendChild(buildReviewerActions(claim));

        view.appendChild(
          el(
            "div",
            { class: "card" },
            el("h2", { text: "Status timeline" }),
            timelineNode(claim),
          ),
        );

        view.appendChild(
          el(
            "div",
            { class: "btn-row no-print" },
            el("a", {
              class: "btn btn-secondary",
              href: "#/review",
              text: "Back to Reviewer Demo",
            }),
          ),
        );
      })
      .catch(renderFatal);
  }

  function buildReviewerActions(claim) {
    var card = el("div", { class: "card" });
    card.appendChild(el("h2", { text: "Reviewer actions" }));

    function handle(err) {
      if (err && err.name === "ValidationError") {
        showFieldErrors(err.errors, card);
        return;
      }
      setFlash(
        (err && err.message) || "The reviewer action could not be completed.",
        "error",
      );
      announce(
        (err && err.message) || "The reviewer action could not be completed.",
        true,
      );
      appendFlash(view);
    }

    function refresh(message) {
      setFlash(message, "success");
      go("#/review/" + encodeURIComponent(claim.reference));
    }

    var hasAction = false;

    if (claim.status === "submitted") {
      hasAction = true;
      card.appendChild(
        el(
          "div",
          { class: "btn-row" },
          el("button", {
            type: "button",
            class: "btn btn-primary",
            text: "Mark as under review",
            onclick: function () {
              Store.reviewClaim(
                claim.reference,
                "start_review",
                "Reviewer started reviewing this claim.",
              )
                .then(function () {
                  refresh(
                    "Claim " +
                      claim.reference +
                      " is now under review (simulated).",
                  );
                })
                .catch(handle);
            },
          }),
        ),
      );
    }

    if (claim.status === "submitted" || claim.status === "under_review") {
      hasAction = true;
      var clarifyField = makeField({
        id: "clarify-note",
        label: "Explanation for the officer (required)",
        tag: "textarea",
        value: "",
        errorKey: "note",
        hint: "Short and plain. Example: Please check the sample document name.",
      });
      var clarifyForm = el(
        "form",
        { novalidate: true },
        clarifyField.wrap,
        el("button", {
          type: "submit",
          class: "btn btn-secondary",
          text: "Request clarification",
        }),
      );
      clarifyForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var note = document.getElementById("clarify-note").value;
        Store.reviewClaim(claim.reference, "request_clarification", note)
          .then(function () {
            refresh(
              "Clarification requested on " + claim.reference + " (simulated).",
            );
          })
          .catch(handle);
      });
      card.appendChild(clarifyForm);
    }

    if (claim.status === "under_review") {
      hasAction = true;
      card.appendChild(
        el(
          "div",
          { class: "btn-row" },
          el("button", {
            type: "button",
            class: "btn btn-primary",
            text: "Record approval",
            onclick: function () {
              Store.reviewClaim(
                claim.reference,
                "approve",
                "Approved for payment (simulated).",
              )
                .then(function () {
                  refresh(
                    "Claim " +
                      claim.reference +
                      " is approved for payment (simulated).",
                  );
                })
                .catch(handle);
            },
          }),
        ),
      );
    }

    if (claim.status === "approved") {
      hasAction = true;
      var amountField = makeField({
        id: "paid-amount",
        label: "Amount paid in the fictional record (INR)",
        type: "number",
        value: claim.amount,
        errorKey: "amount",
        hint: "This may be different from the amount claimed. It is only a practice record.",
      });
      var paymentForm = el(
        "form",
        { novalidate: true },
        amountField.wrap,
        (function () {
          var noteField = makeField({
            id: "payment-note",
            label: "Payment note (optional)",
            value: "",
            errorKey: "payment-note",
          });
          paymentFormNote = noteField;
          return noteField.wrap;
        })(),
        el("button", {
          type: "submit",
          class: "btn btn-primary",
          text: "Record fictional payment",
        }),
      );
      var paymentFormNote = null;
      paymentForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var amount = document.getElementById("paid-amount").value;
        var note = document.getElementById("payment-note").value;
        Store.recordPayment(claim.reference, amount, note)
          .then(function () {
            refresh(
              "A fictional payment was recorded for " +
                claim.reference +
                ". No money was sent.",
            );
          })
          .catch(handle);
      });
      card.appendChild(paymentForm);
      card.appendChild(
        el("p", {
          class: "hint",
          text: "Approval and payment are separate steps. This prototype never sends money.",
        }),
      );
    }

    if (claim.status === "clarification_required") {
      hasAction = true;
      card.appendChild(
        el("p", {
          text: "Waiting for the officer to reply and resubmit. No reviewer action is available right now.",
        }),
      );
    }

    if (claim.status === "payment_recorded") {
      hasAction = true;
      card.appendChild(
        el("p", {
          text: "This claim has a recorded fictional payment. No further reviewer action is available.",
        }),
      );
    }

    if (claim.status === "draft") {
      hasAction = true;
      card.appendChild(
        el("p", {
          text: "Drafts are not visible to reviewers until the officer submits them.",
        }),
      );
    }

    if (!hasAction)
      card.appendChild(
        el("p", { text: "No actions are available for this status." }),
      );
    return card;
  }

  /* ================================================================
     Help
     ================================================================ */
  function renderHelp() {
    clear(view);
    appendFlash(view);

    view.appendChild(el("h1", { text: "Help" }));
    view.appendChild(
      el("p", {
        class: "lead",
        text: "Short answers about using this practice tool.",
      }),
    );

    var sections = [
      [
        "What does reimbursement mean?",
        "Reimbursement means money returned for expenses you paid yourself. In this prototype, no money is ever returned. " +
          "Amounts you type are practice numbers.",
      ],
      [
        "How do I add a demo expense?",
        "Choose Add an Expense. Fill in Step 1 (type, date, amount, description), then Step 2 (a sample document name), " +
          "then check everything in Step 3 and choose Submit demo claim. You can choose Save as draft at any point.",
      ],
      [
        "How do I check my progress?",
        "Open My Claims and select a claim. The status timeline shows every dated step. " +
          "The Next action box tells you what to do next, if anything.",
      ],
      [
        "How do I respond to a clarification request?",
        "Open the claim. It shows Clarification required and the reviewer's note. " +
          "Update the details if needed, write a short reply, then choose Resubmit for review.",
      ],
      [
        "What can this prototype not do?",
        "This website cannot release funds, guarantee reimbursement, provide emergency money, or change pension, housing, " +
          "or duty policies. It does not connect to any bank, payment gateway, or government system. " +
          "It does not store real documents. It is not an official portal and is not endorsed by any department.",
      ],
      [
        "Is the reviewer role secure?",
        "No. The Reviewer Demo entry is a demonstration control, not authentication. " +
          "Anyone using the same browser can open it. Never use this prototype for real sensitive data.",
      ],
    ];

    sections.forEach(function (pair) {
      view.appendChild(
        el(
          "div",
          { class: "card" },
          el("h2", { text: pair[0] }),
          el("p", { text: pair[1] }),
        ),
      );
    });

    var resetCard = el(
      "div",
      { class: "card" },
      el("h2", { text: "Reset demo data" }),
      el("p", {
        text:
          "This removes every claim in this " +
          (Store.mode === "backend" ? "server database" : "browser") +
          " and puts the fixed fictional seed claims back.",
      }),
      el(
        "div",
        { class: "btn-row" },
        el("button", {
          type: "button",
          class: "btn btn-danger",
          text: "Reset Demo",
          onclick: function () {
            var ok = window.confirm(
              "Reset all demo data?\n\nEvery claim in this " +
                (Store.mode === "backend" ? "server database" : "browser") +
                " will be replaced by the fictional seed claims. This cannot be undone.",
            );
            if (!ok) return;
            Store.reset()
              .then(function () {
                setFlash(
                  "Demo data has been reset to the fictional seed claims.",
                  "success",
                );
                go("#/home");
              })
              .catch(function (err) {
                setFlash(
                  (err && err.message) || "The demo data could not be reset.",
                  "error",
                );
                appendFlash(view);
                announce("The demo data could not be reset.", true);
              });
          },
        }),
      ),
    );
    view.appendChild(resetCard);
    return Promise.resolve();
  }

  /* ================================================================
     Startup
     ================================================================ */
  function start() {
    initFontControls();
    initModeBanner();

    if (!location.hash) {
      history.replaceState(null, "", "#/home");
    }
    window.addEventListener("hashchange", route);
    route();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

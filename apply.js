// Sandbox checkout for the $39/month founding membership. Replace with the live link before charging real cards.
const CHECKOUT_URL = "https://buy.stripe.com/test_bJeeVccpVaLIgvva9Cebu00";

const steps = [
  {
    id: "welcome",
    type: "welcome",
    title: "Welcome to Business Golf Club",
    help: "Tell us a little about yourself so we can match you with great people to play golf with in your city. The more honest you are, the better your foursomes will be.",
    button: "Apply to Join",
  },
  {
    id: "goals",
    number: 1,
    type: "multi",
    title: "What are you hoping to get out of Business Golf Club?",
    hint: "Select all that apply",
    options: [
      "Meet like-minded people",
      "Make new friends",
      "Build business relationships",
      "Meet potential clients or partners",
      "Meet other entrepreneurs / business owners",
      "Play more golf",
      "Explore new courses",
      "Expand my local network",
      "Other",
    ],
  },
  {
    id: "gender",
    number: 2,
    type: "single",
    title: "What is your gender?",
    options: ["Male", "Female"],
  },
  {
    id: "contact",
    number: 3,
    type: "contact",
    title: "Contact information",
    help: "Please enter your contact information. We use this to send invitations and details for your rounds. Please make sure your email and phone number are accurate.",
    fields: [
      ["firstName", "First name", "text"],
      ["lastName", "Last name", "text"],
      ["email", "Email", "email"],
      ["phone", "Phone number", "tel"],
      ["company", "Company", "text"],
      ["title", "Job title", "text"],
    ],
  },
  {
    id: "area",
    number: 4,
    type: "single",
    title: "What area of Greater Phoenix are you based in?",
    options: [
      "Scottsdale",
      "Phoenix",
      "Paradise Valley",
      "Tempe",
      "Mesa",
      "Chandler",
      "Gilbert",
      "Glendale / Peoria",
      "Other Greater Phoenix",
      "Outside Greater Phoenix",
    ],
  },
  {
    id: "drive",
    number: 5,
    type: "single",
    title: "How far are you willing to drive for a round?",
    options: [
      "Up to 20 minutes",
      "Up to 30 minutes",
      "Up to 45 minutes",
      "Up to 60 minutes",
      "Flexible",
    ],
  },
  {
    id: "industry",
    number: 6,
    type: "single",
    title: "What is your primary industry?",
    options: [
      "Technology / Software",
      "Professional Services",
      "Finance / Investing",
      "Real Estate / Construction",
      "Ecommerce / Consumer",
      "Marketing / Media",
      "Healthcare",
      "Hospitality / Food & Beverage",
      "Manufacturing / Industrial",
      "Sales",
      "Other",
    ],
  },
  {
    id: "work",
    number: 7,
    type: "text",
    title: "Tell us briefly what you do.",
    help: "Example: “I own a 12-person digital marketing agency serving home-service businesses.”",
    placeholder: "A sentence or two is plenty.",
  },
  {
    id: "stage",
    number: 8,
    type: "single",
    cards: true,
    title: "What stage is your business in?",
    help: "This is so we can match you with people that run businesses of a similar size.",
    options: [
      "Pre-Launch or Ideation",
      "Early stage (launch but <$100k rev)",
      "Growth stage ($100k-$1M revenue)",
      "Established ($1M+ revenue)",
      "At Scale ($10M+ Revenue)",
    ],
  },
  {
    id: "size",
    number: 9,
    type: "single",
    title: "How big is your company?",
    help: "If you are between roles or this does not apply cleanly, pick the closest fit.",
    options: ["Just me", "2–5", "6–20", "21–50", "51–200", "200+"],
  },
  {
    id: "schedule",
    number: 10,
    type: "schedule",
    title: "When and how do you like to play?",
    groups: [
      {
        key: "rounds",
        label: "What type of rounds are you interested in?",
        mode: "single",
        options: ["9 holes", "18 holes", "Both"],
      },
      {
        key: "days",
        label: "What days are you usually available to play?",
        mode: "multi",
        pills: true,
        options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      },
      {
        key: "times",
        label: "What times usually work best?",
        mode: "multi",
        pills: true,
        options: ["Early morning", "Morning", "Midday", "Afternoon", "Twilight / after work"],
      },
    ],
  },
  {
    id: "fees",
    number: 11,
    type: "multi",
    title: "What green-fee range are you generally comfortable with?",
    hint: "Select all that apply",
    options: ["Under $50", "$50–$100", "$100–$150", "$150–$250", "$250+", "Depends on the course"],
  },
  {
    id: "interests",
    number: 12,
    type: "multi",
    title: "What are you interested in outside of work and golf?",
    hint: "Select all that apply",
    options: [
      "Fitness",
      "Travel",
      "Investing",
      "Sports",
      "Cars",
      "Food / restaurants",
      "Wine / spirits",
      "Technology",
      "Outdoors",
      "Music",
      "Family",
      "Reading",
      "Gaming",
      "Real estate",
      "Other",
    ],
  },
  {
    id: "commitment",
    number: 13,
    type: "single",
    title: "Are you willing to commit to playing 1–2 golf rounds with other business owners each month?",
    options: [
      "Yes — I'd love to be an active member.",
      "No, and because I can't commit to being an active member I won't apply right now.",
    ],
  },
  {
    id: "payment",
    type: "payment",
  },
  {
    id: "not-ready",
    type: "done",
    title: "Thanks for telling us.",
    help: "Business Golf Club works best when members can play a couple of times a month. When your schedule opens up, you can apply again.",
  },
];

const answers = {};
let index = 0;
let saveTimer = 0;

const SESSION_KEY = "bgc-session";
let sessionId = localStorage.getItem(SESSION_KEY);
if (!sessionId) {
  sessionId = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, sessionId);
}

const app = document.getElementById("app");
const bar = document.querySelector("#progress span");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function questionSteps() {
  return steps.filter((step) => step.number);
}

function render() {
  const step = steps[index];
  const total = questionSteps().length;
  bar.style.width = step.number ? `${(step.number / total) * 100}%` : step.type === "welcome" ? "0%" : "100%";

  const back = index > 0 && step.type !== "done"
    ? `<button class="back" type="button" data-back>Back</button>`
    : "";

  app.innerHTML = `${back}<section class="step${step.cards ? " cards-step" : ""}">${body(step)}</section>`;
  const field = app.querySelector("input, textarea");
  if (field) field.focus();
}

function body(step) {
  if (step.type === "welcome") {
    return `
      <h1>${escapeHtml(step.title)}</h1>
      <p class="help">${escapeHtml(step.help)}</p>
      ${actions(step.button)}
    `;
  }

  if (step.type === "payment") {
    return `
      <h1>Click below to finalize your payment and secure your spot in Business Golf Club.</h1>
      <p class="help">Please use the same email for payment as the one you used on this form. After you join, we’ll match you with a small group in Greater Phoenix and send the course and tee time. The button will take you to our secure Stripe checkout page. Cancel anytime.</p>
      <div class="actions"><a class="pay" id="pay" href="#">Complete Payment →</a></div>
    `;
  }

  if (step.type === "done") {
    return `
      <h1>${escapeHtml(step.title)}</h1>
      <p class="help">${escapeHtml(step.help)}</p>
      <div class="actions"><a class="pay" href="index.html">Back to the club</a></div>
    `;
  }

  const kicker = step.number ? `<p class="kicker">Question ${step.number} of ${questionSteps().length}</p>` : "";
  const help = step.help ? `<p class="help">${escapeHtml(step.help)}</p>` : "";
  const hint = step.hint ? `<p class="help">${escapeHtml(step.hint)}</p>` : "";

  if (step.type === "single" || step.type === "multi") {
    const selected = new Set(asList(answers[step.id]));
    const choices = step.options.map((option) => {
      const on = selected.has(option) ? " selected" : "";
      return `<button class="choice${on}" type="button" data-choice="${escapeHtml(option)}">${escapeHtml(option)}</button>`;
    }).join("");
    const wrap = step.cards ? "cards" : "choices";
    const next = step.type === "multi" || step.cards ? actions("Next") : "";
    return `${kicker}<h1>${escapeHtml(step.title)}</h1>${hint}${help}<div class="${wrap}">${choices}</div>${next}<p class="error" hidden></p>`;
  }

  if (step.type === "contact") {
    const fields = step.fields.map(([key, label, type]) => {
      const value = answers[key] || "";
      return `<label>${escapeHtml(label)}<input name="${key}" type="${type}" value="${escapeHtml(value)}" autocomplete="on" /></label>`;
    }).join("");
    return `${kicker}<h1>${escapeHtml(step.title)}</h1>${help}<div class="fields">${fields}</div>${actions("Next")}<p class="error" hidden></p>`;
  }

  if (step.type === "text") {
    const value = answers[step.id] || "";
    return `${kicker}<h1>${escapeHtml(step.title)}</h1>${help}<div class="fields"><textarea name="work" placeholder="${escapeHtml(step.placeholder)}">${escapeHtml(value)}</textarea></div>${actions("Next")}<p class="error" hidden></p>`;
  }

  if (step.type === "schedule") {
    const groups = step.groups.map((group) => {
      const selected = new Set(asList(answers[group.key]));
      const choices = group.options.map((option) => {
        const on = selected.has(option) ? " selected" : "";
        return `<button class="choice${on}" type="button" data-group="${group.key}" data-mode="${group.mode}" data-choice="${escapeHtml(option)}">${escapeHtml(option)}</button>`;
      }).join("");
      const wrap = group.pills ? "pills" : "choices";
      return `<div><h2>${escapeHtml(group.label)}</h2><div class="${wrap}">${choices}</div></div>`;
    }).join("");
    return `${kicker}<h1>${escapeHtml(step.title)}</h1><div class="groups">${groups}</div>${actions("Next")}<p class="error" hidden></p>`;
  }

  return "";
}

function actions(label) {
  return `<div class="actions"><button type="button" data-next>${escapeHtml(label)}</button><span class="hint">press Enter ↵</span></div>`;
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value) return [value];
  return [];
}

function showError(message) {
  const error = app.querySelector(".error");
  if (!error) return;
  error.hidden = false;
  error.textContent = message;
}

function choiceClick(button) {
  const step = steps[index];
  const option = button.dataset.choice;
  if (button.dataset.group) {
    const key = button.dataset.group;
    if (button.dataset.mode === "single") {
      answers[key] = option;
    } else {
      const selected = new Set(asList(answers[key]));
      if (selected.has(option)) selected.delete(option);
      else selected.add(option);
      answers[key] = [...selected];
    }
    render();
    persist();
    return;
  }

  if (step.type === "single" && step.cards) {
    answers[step.id] = option;
    render();
    persist();
    return;
  }

  if (step.type === "single") {
    answers[step.id] = option;
    goNext();
    return;
  }

  const selected = new Set(asList(answers[step.id]));
  if (selected.has(option)) selected.delete(option);
  else selected.add(option);
  answers[step.id] = [...selected];
  render();
  persist();
}

function readFields() {
  app.querySelectorAll("input, textarea").forEach((field) => {
    const key = field.name === "work" ? "work" : field.name;
    answers[key] = field.value.trim();
  });
}

function valid() {
  const step = steps[index];
  if (step.type === "welcome" || step.type === "payment" || step.type === "done") return true;
  if (step.type === "multi") {
    if (asList(answers[step.id]).length === 0) {
      showError("Select at least one.");
      return false;
    }
    return true;
  }
  if (step.type === "contact") {
    readFields();
    for (const [key, label] of step.fields) {
      if (!answers[key]) {
        showError(`Enter your ${label.toLowerCase()}.`);
        return false;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)) {
      showError("Enter a valid email address.");
      return false;
    }
    const digits = answers.phone.replace(/\D/g, "");
    if (digits.length < 10) {
      showError("Enter a phone number with at least 10 digits.");
      return false;
    }
    return true;
  }
  if (step.type === "text") {
    readFields();
    if (!answers.work) {
      showError("Tell us a little about what you do.");
      return false;
    }
    return true;
  }
  if (step.type === "schedule") {
    if (!answers.rounds) {
      showError("Choose 9 holes, 18 holes, or both.");
      return false;
    }
    if (asList(answers.days).length === 0 || asList(answers.times).length === 0) {
      showError("Select at least one day and one time.");
      return false;
    }
    return true;
  }
  if (step.cards && !answers[step.id]) {
    showError("Choose the stage that fits.");
    return false;
  }
  return true;
}

function goNext() {
  const step = steps[index];
  if (!valid()) {
    persist();
    return;
  }
  if (step.id === "commitment" && String(answers.commitment).startsWith("No")) {
    index = steps.findIndex((item) => item.id === "not-ready");
    render();
    persist();
    return;
  }
  index += 1;
  if (steps[index] && steps[index].id === "payment") saveApplication();
  render();
  persist();
  if (steps[index] && steps[index].id === "payment") wirePayment();
}

function snapshot() {
  readFields();
  const step = steps[index];
  const stepNumber = step.number || (step.id === "payment" || step.id === "not-ready" ? 14 : 0);
  return {
    sessionId,
    stepId: step.id,
    stepNumber,
    completed: step.id === "payment" || step.id === "not-ready",
    answers,
  };
}

function persist() {
  const body = JSON.stringify(snapshot());
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon && navigator.sendBeacon("/api/application", blob)) return;
  fetch("/api/application", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 400);
}

function saveApplication() {
  const payload = { ...answers, submittedAt: new Date().toISOString() };
  localStorage.setItem("bgc-application", JSON.stringify(payload));
}

function wirePayment() {
  const pay = document.getElementById("pay");
  if (!pay) return;
  pay.addEventListener("click", (event) => {
    if (!CHECKOUT_URL) {
      event.preventDefault();
      return;
    }
    const email = encodeURIComponent(answers.email || "");
    const reference = encodeURIComponent(sessionId);
    const join = CHECKOUT_URL.includes("?") ? "&" : "?";
    pay.href = `${CHECKOUT_URL}${join}prefilled_email=${email}&client_reference_id=${reference}`;
  });
}

app.addEventListener("click", (event) => {
  const choice = event.target.closest("[data-choice]");
  if (choice) {
    choiceClick(choice);
    return;
  }
  if (event.target.closest("[data-next]")) goNext();
  if (event.target.closest("[data-back]")) {
    if (steps[index].id === "not-ready") {
      index = steps.findIndex((item) => item.id === "commitment");
    } else if (index > 0) {
      index -= 1;
    }
    render();
    persist();
  }
});

app.addEventListener("input", persistSoon);
window.addEventListener("pagehide", persist);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  if (event.target.tagName === "TEXTAREA") return;
  const step = steps[index];
  if (!step || step.type === "payment" || step.type === "done" || (step.type === "single" && !step.cards)) return;
  event.preventDefault();
  goNext();
});

const returnedFromCheckout = new URLSearchParams(location.search).get("paid") === "1";
if (returnedFromCheckout) {
  bar.style.width = "100%";
  app.innerHTML = `<section class="step">
    <h1>You're in.</h1>
    <p class="welcome">Welcome to Business Golf Club.</p>
    <p class="help">Your membership is active, and we have everything we need to start matching you for upcoming rounds.</p>
    <p class="next-label">What happens next:</p>
    <p class="help">We'll review your preferences and reach out when we have a round that fits your schedule, location, budget, and golf preferences.</p>
    <p class="help">You'll receive the course, tee time, and your group details before each round.</p>
    <p class="help">Your first round is coming soon.</p>
    <p class="help">Questions? Email us anytime at <a href="mailto:hello@businessgolf.club">hello@businessgolf.club</a>.</p>
    <div class="actions"><a class="pay" href="index.html">Back to the club</a></div>
  </section>`;
} else {
  render();
  persist();
}

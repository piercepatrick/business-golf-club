const MAX_BODY = 32000;

const STEP_IDS = new Set([
  "welcome",
  "goals",
  "gender",
  "contact",
  "area",
  "drive",
  "industry",
  "work",
  "stage",
  "size",
  "schedule",
  "fees",
  "interests",
  "commitment",
  "payment",
  "not-ready",
]);

const ANSWER_KEYS = [
  "goals",
  "gender",
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "title",
  "area",
  "drive",
  "industry",
  "work",
  "stage",
  "size",
  "rounds",
  "days",
  "times",
  "fees",
  "interests",
  "commitment",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/application") {
      if (request.method === "POST") return saveApplication(request, env);
      return new Response("Method not allowed", { status: 405 });
    }
    return env.ASSETS.fetch(request);
  },
};

async function saveApplication(request, env) {
  let body;
  try {
    const text = await request.text();
    if (!text || text.length > MAX_BODY) return json({ error: "Invalid application" }, 400);
    body = JSON.parse(text);
  } catch {
    return json({ error: "Invalid application" }, 400);
  }

  if (!isUuid(body.sessionId) || !STEP_IDS.has(body.stepId)) {
    return json({ error: "Invalid application" }, 400);
  }

  const stepNumber = clampNumber(body.stepNumber, 0, 14);
  const key = `session:${body.sessionId}`;
  const existing = await env.APPLICATIONS.get(key, "json");
  const now = new Date().toISOString();
  const previousFurthest = existing?.furthestNumber || 0;
  const furthestNumber = Math.max(previousFurthest, stepNumber);
  const furthestStep = furthestNumber > previousFurthest || !existing?.furthestStep
    ? body.stepId
    : existing.furthestStep;
  const completed = Boolean(existing?.completed || body.completed);
  const record = {
    sessionId: body.sessionId,
    stepId: body.stepId,
    stepNumber,
    furthestStep,
    furthestNumber,
    completed,
    outcome: completed ? (body.stepId === "not-ready" || existing?.outcome === "not-ready" ? "not-ready" : "payment") : "",
    answers: sanitizeAnswers(body.answers),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (existing?.completed && existing.outcome) record.outcome = existing.outcome;
  if (completed && body.stepId === "not-ready") record.outcome = "not-ready";
  if (completed && body.stepId === "payment") record.outcome = "payment";

  await env.APPLICATIONS.put(key, JSON.stringify(record));
  await updateFunnel(env, existing, record, now);
  return new Response(null, { status: 204 });
}

async function updateFunnel(env, existing, record, now) {
  const funnel = (await env.APPLICATIONS.get("funnel", "json")) || {
    byFurthestStep: {},
    finishedPayment: 0,
    notReady: 0,
  };

  const nextStep = record.furthestStep;
  if (!existing) {
    addCount(funnel.byFurthestStep, nextStep, 1);
  } else if (existing.furthestStep !== nextStep) {
    addCount(funnel.byFurthestStep, existing.furthestStep, -1);
    addCount(funnel.byFurthestStep, nextStep, 1);
  }

  if (!existing?.completed && record.completed) {
    if (record.outcome === "not-ready") funnel.notReady += 1;
    else funnel.finishedPayment += 1;
  }

  funnel.updatedAt = now;
  await env.APPLICATIONS.put("funnel", JSON.stringify(funnel));
}

function addCount(counts, step, delta) {
  const next = (counts[step] || 0) + delta;
  if (next <= 0) delete counts[step];
  else counts[step] = next;
}

function sanitizeAnswers(value) {
  const source = value && typeof value === "object" ? value : {};
  const answers = {};
  for (const key of ANSWER_KEYS) {
    const item = source[key];
    if (typeof item === "string") answers[key] = item.slice(0, 2000);
    else if (Array.isArray(item)) {
      answers[key] = item
        .filter((entry) => typeof entry === "string")
        .slice(0, 30)
        .map((entry) => entry.slice(0, 200));
    }
  }
  return answers;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

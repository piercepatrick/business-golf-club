import { handleAdmin } from "./admin.js";
import { handleStripeWebhook } from "./stripe.js";

const MAX_BODY = 32000;

const STEP_IDS = new Set([
  "welcome",
  "goals",
  "gender",
  "age",
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

const LIST_KEYS = ["goals", "days", "times", "fees", "interests"];

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS applications (
  session_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  step_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  furthest_step TEXT NOT NULL,
  furthest_number INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  goals TEXT NOT NULL DEFAULT '[]',
  gender TEXT NOT NULL DEFAULT '',
  age TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  drive TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  work TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  rounds TEXT NOT NULL DEFAULT '',
  days TEXT NOT NULL DEFAULT '[]',
  times TEXT NOT NULL DEFAULT '[]',
  fees TEXT NOT NULL DEFAULT '[]',
  interests TEXT NOT NULL DEFAULT '[]',
  commitment TEXT NOT NULL DEFAULT ''
)`;

let schemaReady = false;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/application") {
      if (request.method === "POST") return saveApplication(request, env);
      if (request.method === "GET") return applicationStatus(url, env);
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname === "/api/stripe/webhook") {
      if (request.method === "POST") return handleStripeWebhook(request, env, ensureSchema);
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      return handleAdmin(request, env, ensureSchema);
    }
    return env.ASSETS.fetch(request);
  },
};

async function applicationStatus(url, env) {
  const sessionId = url.searchParams.get("session") || "";
  if (!isUuid(sessionId)) return json({ error: "Invalid application" }, 400);
  await ensureSchema(env);
  const row = await env.DB.prepare(
    "SELECT paid FROM applications WHERE session_id = ?"
  ).bind(sessionId).first();
  return json({ paid: Number(row?.paid) === 1 });
}

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

  await ensureSchema(env);

  const answers = sanitizeAnswers(body.answers);
  const existing = await env.DB.prepare(
    `SELECT created_at, furthest_number, furthest_step, completed, outcome, status
     FROM applications WHERE session_id = ?`
  ).bind(body.sessionId).first();

  const now = new Date().toISOString();
  const stepNumber = clampNumber(body.stepNumber, 0, 15);
  const previousFurthest = existing?.furthest_number || 0;
  const furthestNumber = Math.max(previousFurthest, stepNumber);
  const furthestStep = furthestNumber > previousFurthest || !existing?.furthest_step
    ? body.stepId
    : existing.furthest_step;
  const completed = existing?.completed === 1 || body.completed ? 1 : 0;
  let outcome = existing?.outcome || "";
  if (completed && body.stepId === "not-ready") outcome = "not-ready";
  else if (body.checkoutStarted || existing?.outcome === "checkout") outcome = "checkout";
  else if (completed && body.stepId === "payment") outcome = "payment";

  await env.DB.prepare(
    `INSERT INTO applications (
      session_id, created_at, updated_at, step_id, step_number, furthest_step, furthest_number,
      completed, outcome, status,
      goals, gender, age, first_name, last_name, email, phone, company, title,
      area, drive, industry, work, stage, size, rounds, days, times, fees, interests, commitment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      updated_at = excluded.updated_at,
      step_id = excluded.step_id,
      step_number = excluded.step_number,
      furthest_step = excluded.furthest_step,
      furthest_number = excluded.furthest_number,
      completed = excluded.completed,
      outcome = CASE WHEN applications.outcome = 'checkout' THEN 'checkout' ELSE excluded.outcome END,
      goals = CASE WHEN excluded.goals != '[]' THEN excluded.goals ELSE applications.goals END,
      gender = CASE WHEN excluded.gender != '' THEN excluded.gender ELSE applications.gender END,
      age = CASE WHEN excluded.age != '' THEN excluded.age ELSE applications.age END,
      first_name = CASE WHEN excluded.first_name != '' THEN excluded.first_name ELSE applications.first_name END,
      last_name = CASE WHEN excluded.last_name != '' THEN excluded.last_name ELSE applications.last_name END,
      email = CASE WHEN excluded.email != '' THEN excluded.email ELSE applications.email END,
      phone = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE applications.phone END,
      company = CASE WHEN excluded.company != '' THEN excluded.company ELSE applications.company END,
      title = CASE WHEN excluded.title != '' THEN excluded.title ELSE applications.title END,
      area = CASE WHEN excluded.area != '' THEN excluded.area ELSE applications.area END,
      drive = CASE WHEN excluded.drive != '' THEN excluded.drive ELSE applications.drive END,
      industry = CASE WHEN excluded.industry != '' THEN excluded.industry ELSE applications.industry END,
      work = CASE WHEN excluded.work != '' THEN excluded.work ELSE applications.work END,
      stage = CASE WHEN excluded.stage != '' THEN excluded.stage ELSE applications.stage END,
      size = CASE WHEN excluded.size != '' THEN excluded.size ELSE applications.size END,
      rounds = CASE WHEN excluded.rounds != '' THEN excluded.rounds ELSE applications.rounds END,
      days = CASE WHEN excluded.days != '[]' THEN excluded.days ELSE applications.days END,
      times = CASE WHEN excluded.times != '[]' THEN excluded.times ELSE applications.times END,
      fees = CASE WHEN excluded.fees != '[]' THEN excluded.fees ELSE applications.fees END,
      interests = CASE WHEN excluded.interests != '[]' THEN excluded.interests ELSE applications.interests END,
      commitment = CASE WHEN excluded.commitment != '' THEN excluded.commitment ELSE applications.commitment END`
  ).bind(
    body.sessionId,
    existing?.created_at || now,
    now,
    body.stepId,
    stepNumber,
    furthestStep,
    furthestNumber,
    completed,
    outcome,
    existing?.status || "new",
    listValue(answers, "goals"),
    textValue(answers, "gender"),
    textValue(answers, "age"),
    textValue(answers, "firstName"),
    textValue(answers, "lastName"),
    textValue(answers, "email"),
    textValue(answers, "phone"),
    textValue(answers, "company"),
    textValue(answers, "title"),
    textValue(answers, "area"),
    textValue(answers, "drive"),
    textValue(answers, "industry"),
    textValue(answers, "work"),
    textValue(answers, "stage"),
    textValue(answers, "size"),
    textValue(answers, "rounds"),
    listValue(answers, "days"),
    listValue(answers, "times"),
    listValue(answers, "fees"),
    listValue(answers, "interests"),
    textValue(answers, "commitment"),
  ).run();

  return new Response(null, { status: 204 });
}

async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(CREATE_TABLE),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS applications_area_idx ON applications (area)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS applications_status_idx ON applications (status)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS applications_completed_idx ON applications (completed)"),
  ]);
  await addColumn(env, "ALTER TABLE applications ADD COLUMN paid INTEGER NOT NULL DEFAULT 0");
  await addColumn(env, "ALTER TABLE applications ADD COLUMN stripe_customer_id TEXT NOT NULL DEFAULT ''");
  await addColumn(env, "ALTER TABLE applications ADD COLUMN age TEXT NOT NULL DEFAULT ''");
  schemaReady = true;
}

async function addColumn(env, sql) {
  try {
    await env.DB.prepare(sql).run();
  } catch (error) {
    if (!String(error).toLowerCase().includes("duplicate column")) throw error;
  }
}

function sanitizeAnswers(value) {
  const source = value && typeof value === "object" ? value : {};
  const answers = {};
  for (const key of ["gender", "age", "firstName", "lastName", "email", "phone", "company", "title", "area", "drive", "industry", "work", "stage", "size", "rounds", "commitment"]) {
    const item = source[key];
    if (typeof item === "string") answers[key] = item.slice(0, 2000);
  }
  for (const key of LIST_KEYS) {
    const item = source[key];
    if (Array.isArray(item)) {
      answers[key] = item
        .filter((entry) => typeof entry === "string")
        .slice(0, 30)
        .map((entry) => entry.slice(0, 200));
    }
  }
  return answers;
}

function textValue(answers, key) {
  return answers[key] || "";
}

function listValue(answers, key) {
  return JSON.stringify(answers[key] || []);
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

const STATUSES = ["new", "contacted", "grouped"];
const PROGRESS = ["all", "open", "payment", "paid", "not-ready"];

const STEP_LABELS = {
  welcome: "Welcome",
  goals: "Goals",
  gender: "Gender",
  contact: "Contact",
  area: "Area",
  drive: "Drive time",
  industry: "Industry",
  work: "What they do",
  stage: "Business stage",
  size: "Company size",
  schedule: "Schedule",
  fees: "Green fees",
  interests: "Interests",
  commitment: "Commitment",
  payment: "Payment",
  "not-ready": "Not ready",
};

export async function handleAdmin(request, env, ensureSchema) {
  if (!env.ADMIN_PASSWORD) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  if (url.pathname === "/admin/login" && request.method === "POST") return login(request, env);
  if (url.pathname === "/admin/logout") return logout();
  if (!(await authorized(request, env))) return loginPage(request, false);

  if (url.pathname === "/admin/status" && request.method === "POST") {
    return updateStatus(request, env, ensureSchema);
  }
  if (url.pathname === "/admin") return tablePage(request, env, ensureSchema);
  return new Response("Not found", { status: 404 });
}

async function tablePage(request, env, ensureSchema) {
  await ensureSchema(env);
  const url = new URL(request.url);
  const progress = PROGRESS.includes(url.searchParams.get("progress")) ? url.searchParams.get("progress") : "all";
  const status = STATUSES.includes(url.searchParams.get("status")) ? url.searchParams.get("status") : "all";
  const area = (url.searchParams.get("area") || "all").slice(0, 80);

  const where = [];
  const binds = [];
  if (progress === "open") where.push("completed = 0");
  if (progress === "payment") where.push("outcome = 'payment' AND paid = 0");
  if (progress === "paid") where.push("paid = 1");
  if (progress === "not-ready") where.push("outcome = 'not-ready'");
  if (status !== "all") {
    where.push("status = ?");
    binds.push(status);
  }
  if (area !== "all") {
    where.push("area = ?");
    binds.push(area);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await env.DB.prepare(
    `SELECT * FROM applications ${clause} ORDER BY updated_at DESC`
  ).bind(...binds).all();
  const areas = await env.DB.prepare(
    "SELECT DISTINCT area FROM applications WHERE area != '' ORDER BY area"
  ).all();

  const body = (rows.results || []).map((row) => renderRow(row, { progress, status, area })).join("");
  const html = layout("Applications", `
    <form class="filters" method="get" action="/admin">
      <label>Progress ${select("progress", progress, [
        ["all", "Everyone"],
        ["open", "Still filling out"],
        ["payment", "Reached payment"],
        ["paid", "Paid"],
        ["not-ready", "Not ready"],
      ])}</label>
      <label>Status ${select("status", status, [["all", "Any status"], ...STATUSES.map((item) => [item, item])])}</label>
      <label>Area ${select("area", area, [["all", "Any area"], ...(areas.results || []).map((item) => [item.area, item.area])])}</label>
      <button type="submit">Show</button>
      <a href="/admin/logout">Log out</a>
    </form>
    <p class="count">${rows.results?.length || 0} ${(rows.results?.length || 0) === 1 ? "person" : "people"}</p>
    <div class="wrap">
      <table>
        <thead><tr>
          <th>Name</th><th>Email</th><th>Phone</th><th>Paid</th><th>Status</th><th>Progress</th>
          <th>Area</th><th>Days</th><th>Times</th><th>Drive</th><th>Rounds</th>
          <th>Company</th><th>Title</th><th>Gender</th><th>Industry</th><th>Stage</th><th>Size</th>
          <th>Commitment</th><th>Goals</th><th>Green fees</th><th>Interests</th><th>What they do</th><th>Updated</th>
        </tr></thead>
        <tbody>${body || `<tr><td colspan="23">No applications yet.</td></tr>`}</tbody>
      </table>
    </div>
  `);
  return htmlResponse(html);
}

function renderRow(row, filters) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || "—";
  const progress = Number(row.paid) === 1
    ? "Paid"
    : row.outcome === "not-ready"
      ? "Not ready"
      : row.completed
        ? "Reached payment"
        : `Stopped at ${STEP_LABELS[row.furthest_step] || row.furthest_step}`;
  const back = `/admin?progress=${encodeURIComponent(filters.progress)}&status=${encodeURIComponent(filters.status)}&area=${encodeURIComponent(filters.area)}`;
  const statusField = `<form method="post" action="/admin/status">
    <input type="hidden" name="session_id" value="${escapeHtml(row.session_id)}" />
    <input type="hidden" name="back" value="${escapeHtml(back)}" />
    ${select("status", row.status, STATUSES.map((item) => [item, item]), true)}
  </form>`;
  const cells = [
    name,
    row.email,
    row.phone,
    Number(row.paid) === 1 ? "Yes" : "No",
    statusField,
    progress,
    row.area,
    listText(row.days),
    listText(row.times),
    row.drive,
    row.rounds,
    row.company,
    row.title,
    row.gender,
    row.industry,
    row.stage,
    row.size,
    row.commitment,
    listText(row.goals),
    listText(row.fees),
    listText(row.interests),
    row.work,
    formatWhen(row.updated_at),
  ];
  return `<tr>${cells.map((cell, index) => `<td>${index === 4 ? cell : escapeHtml(cell || "")}</td>`).join("")}</tr>`;
}

async function updateStatus(request, env, ensureSchema) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  await ensureSchema(env);
  const form = await request.formData();
  const sessionId = String(form.get("session_id") || "");
  const status = String(form.get("status") || "");
  const back = safeBack(String(form.get("back") || "/admin"));
  if (!isUuid(sessionId) || !STATUSES.includes(status)) return new Response("Bad request", { status: 400 });
  await env.DB.prepare("UPDATE applications SET status = ? WHERE session_id = ?").bind(status, sessionId).run();
  return Response.redirect(new URL(back, request.url), 303);
}

async function login(request, env) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const password = String(form.get("password") || "");
  if (!safeEqual(password, env.ADMIN_PASSWORD)) return loginPage(request, true);
  const token = await sign(env.ADMIN_PASSWORD);
  return new Response(null, {
    status: 303,
    headers: {
      location: "/admin",
      "set-cookie": `bgc_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=2592000`,
    },
  });
}

function logout() {
  return new Response(null, {
    status: 303,
    headers: {
      location: "/admin",
      "set-cookie": "bgc_admin=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0",
    },
  });
}

function loginPage(request, failed) {
  const html = layout("Log in", `
    <form class="login" method="post" action="/admin/login">
      <h1>Applications</h1>
      <p>This page shows membership responses. It is not linked from the public site.</p>
      ${failed ? `<p class="error">That password is wrong.</p>` : ""}
      <label>Password <input type="password" name="password" autofocus required /></label>
      <button type="submit">View responses</button>
    </form>
  `);
  return htmlResponse(html, failed ? 401 : 200);
}

async function authorized(request, env) {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("bgc_admin="))?.slice("bgc_admin=".length);
  if (!token) return false;
  return safeEqual(token, await sign(env.ADMIN_PASSWORD));
}

async function sign(password) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("bgc-admin"));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function select(name, current, options, submitOnChange) {
  const choices = options.map(([value, label]) => {
    const selected = value === current ? " selected" : "";
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");
  const change = submitOnChange ? ` onchange="this.form.submit()"` : "";
  return `<select name="${escapeHtml(name)}"${change}>${choices}</select>`;
}

function listText(value) {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch {
    return String(value);
  }
  return String(value);
}

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "";
  return date.toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function safeBack(value) {
  if (!value.startsWith("/admin")) return "/admin";
  if (value.startsWith("//")) return "/admin";
  return value;
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

function safeEqual(left, right) {
  const a = String(left);
  const b = String(right);
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Business Golf Club</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #1c1c1c; background: #f7f4ee; }
    header { background: #040033; color: #fff; padding: 16px 20px; }
    header a { color: #fff; font-weight: 650; text-decoration: none; }
    main { padding: 16px 20px 40px; }
    .filters, .login { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; }
    .login { max-width: 28rem; flex-direction: column; align-items: stretch; }
    label { display: grid; gap: 4px; font-size: 13px; }
    select, input, button { font: inherit; padding: 8px 10px; border: 1px solid #d9d3c7; border-radius: 8px; background: #fff; }
    button { background: #040033; color: #fff; border-color: #040033; cursor: pointer; }
    a { color: #3c2f86; }
    .count { color: #666; font-size: 13px; }
    .error { color: #8a1f1f; }
    .wrap { overflow: auto; border: 1px solid #e4ddd0; border-radius: 12px; background: #fff; }
    table { border-collapse: collapse; min-width: 2200px; font-size: 13px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; white-space: nowrap; }
    td:nth-child(22) { white-space: normal; min-width: 16rem; }
    th { position: sticky; top: 0; background: #f3efe6; }
    td:first-child, th:first-child { position: sticky; left: 0; background: #fff; }
    th:first-child { background: #f3efe6; z-index: 1; }
    select { padding: 4px 8px; }
  </style>
</head>
<body>
  <header><a href="/admin">Business Golf Club</a></header>
  <main>${body}</main>
</body>
</html>`;
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

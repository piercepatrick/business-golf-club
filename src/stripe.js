const META_PIXEL_ID = "2623107684803251";
// Trial checkouts report amount_total 0. Purchase value is the recurring price.
const FOUNDING_RECURRING_USD = 29;

export async function handleStripeWebhook(request, env, ensureSchema) {
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("Webhook is not configured", { status: 500 });
  const body = await request.text();
  const valid = await verifySignature(body, request.headers.get("stripe-signature") || "", env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    if (session?.mode === "subscription" && isSettled(session)) {
      await ensureSchema(env);
      const applicant = await markPaid(env, session);
      await sendMetaPurchase(env, event, session, applicant);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "content-type": "application/json" },
  });
}

function isSettled(session) {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

async function markPaid(env, session) {
  const customer = typeof session.customer === "string" ? session.customer : "";
  const reference = session.client_reference_id || "";
  const email = session.customer_details?.email || session.customer_email || "";
  const now = new Date().toISOString();
  if (isUuid(reference)) {
    const row = await env.DB.prepare(
      "SELECT first_name, last_name, email, phone FROM applications WHERE session_id = ?"
    ).bind(reference).first();
    await env.DB.prepare(
      "UPDATE applications SET paid = 1, stripe_customer_id = ?, updated_at = ? WHERE session_id = ?"
    ).bind(customer, now, reference).run();
    return row;
  }
  if (email) {
    const row = await env.DB.prepare(
      "SELECT first_name, last_name, email, phone FROM applications WHERE lower(email) = lower(?)"
    ).bind(email).first();
    await env.DB.prepare(
      "UPDATE applications SET paid = 1, stripe_customer_id = ?, updated_at = ? WHERE lower(email) = lower(?)"
    ).bind(customer, now, email).run();
    return row;
  }
  return null;
}

async function sendMetaPurchase(env, event, session, applicant) {
  const token = env.META_CAPI_ACCESS_TOKEN;
  if (!token || !session.id) return;

  const stripeEmail = session.customer_details?.email || session.customer_email || "";
  const stripeName = splitName(session.customer_details?.name || "");
  const email = firstText(applicant?.email, stripeEmail);
  const firstName = firstText(applicant?.first_name, stripeName.first);
  const lastName = firstText(applicant?.last_name, stripeName.last);
  const phone = firstText(applicant?.phone, session.customer_details?.phone);
  const userData = {};
  const em = await hashField(email.toLowerCase());
  const fn = await hashField(firstName.toLowerCase());
  const ln = await hashField(lastName.toLowerCase());
  const ph = await hashField(phone.replace(/\D/g, ""));
  if (em) userData.em = [em];
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];
  if (ph) userData.ph = [ph];

  const response = await fetch(`https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      data: [{
        event_name: "Purchase",
        event_time: Number(event.created) || Math.floor(Date.now() / 1000),
        event_id: session.id,
        action_source: "website",
        event_source_url: `https://businessgolf.club/apply.html?paid=1&session_id=${encodeURIComponent(session.id)}`,
        user_data: userData,
        custom_data: {
          currency: String(session.currency || "usd").toUpperCase(),
          value: purchaseValue(session),
        },
      }],
    }),
  });
  if (!response.ok) {
    console.error("Meta Purchase failed", session.id, response.status);
    throw new Error("Meta Purchase failed");
  }
}

function purchaseValue(session) {
  const total = Number(session.amount_total);
  if (Number.isFinite(total) && total > 0) return Math.round(total) / 100;
  return FOUNDING_RECURRING_USD;
}

function splitName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

async function hashField(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(body, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
  }));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return safeEqual(expected, signature);
}

function safeEqual(left, right) {
  const a = String(left);
  const b = String(right);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

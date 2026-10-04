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

  if (event.type === "checkout.session.completed" && event.data?.object?.mode === "subscription") {
    await ensureSchema(env);
    const session = event.data.object;
    const customer = typeof session.customer === "string" ? session.customer : "";
    const reference = session.client_reference_id || "";
    const email = session.customer_details?.email || session.customer_email || "";
    const now = new Date().toISOString();
    if (isUuid(reference)) {
      await env.DB.prepare(
        "UPDATE applications SET paid = 1, stripe_customer_id = ?, updated_at = ? WHERE session_id = ?"
      ).bind(customer, now, reference).run();
    } else if (email) {
      await env.DB.prepare(
        "UPDATE applications SET paid = 1, stripe_customer_id = ?, updated_at = ? WHERE lower(email) = lower(?)"
      ).bind(customer, now, email).run();
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "content-type": "application/json" },
  });
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

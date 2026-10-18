// POST /functions/v1/submit-booking — guest appointment REQUEST (not a confirmed appointment).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, readJson, hashKey, clientIp } from "../_shared/http.ts";
import { validateBooking, looksLikeBot, SERVICE_LABELS, escapeHtml, oneLine } from "../_shared/validate.ts";
import { sendEmail, type SendResult } from "../_shared/email.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeRef = () => "NSY-" + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => ALPHABET[b % ALPHABET.length]).join("");
const TIME_LABEL: Record<string, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", flexible: "Flexible" };
const METHOD_LABEL: Record<string, string> = { email: "Email", phone: "Phone call", whatsapp: "WhatsApp" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false });

  const raw = await readJson(req);
  if (raw === null) return json(req, 400, { ok: false, errors: { _: "Invalid request." } });

  // Rate limit before doing any work (per IP; salted hash, raw IP is never stored).
  const ipKey = await hashKey("ip-booking", clientIp(req));
  const { data: allowed, error: rlErr } = await db.rpc("rate_limit_hit", { p_key: ipKey, p_window_seconds: 3600, p_max: 8 });
  if (rlErr) { console.error("rate limit error", rlErr.message); return json(req, 500, { ok: false }); }
  if (!allowed) return json(req, 429, { ok: false });

  // Bots get a harmless, fake-looking success so they do not adapt. Nothing is stored or sent.
  if (looksLikeBot(raw)) return json(req, 200, { ok: true, reference: makeRef() });

  const { errors, value: v, ok } = validateBooking(raw);
  if (!ok) return json(req, 400, { ok: false, errors });

  // Same request submitted twice (retry, double-click): return the original reference, no second booking or email.
  const dupKey = await db.from("bookings").select("reference").eq("idempotency_key", v.idempotencyKey).maybeSingle();
  if (dupKey.data) return json(req, 200, { ok: true, reference: dupKey.data.reference });

  const emailKey = await hashKey("em-booking", v.email.toLowerCase());
  const { data: emailAllowed } = await db.rpc("rate_limit_hit", { p_key: emailKey, p_window_seconds: 3600, p_max: 6 });
  if (!emailAllowed) return json(req, 429, { ok: false });

  // Find an existing customer: same email, or same phone AND same name. Otherwise create one.
  let customerId: string | null = null;
  const byEmail = await db.from("customers").select("id").eq("email_norm", v.email.toLowerCase()).is("anonymised_at", null).order("created_at").limit(1);
  if (byEmail.data?.length) customerId = byEmail.data[0].id;
  if (!customerId) {
    const phoneNorm = v.phone.replace(/\D/g, "");
    const byPhone = await db.from("customers").select("id, full_name").eq("phone_norm", phoneNorm).is("anonymised_at", null).limit(5);
    const hit = byPhone.data?.find((c) => c.full_name.toLowerCase() === v.name.toLowerCase());
    if (hit) customerId = hit.id;
  }
  if (!customerId) {
    const ins = await db.from("customers").insert({ full_name: v.name, email: v.email, phone: v.phone, preferred_contact: v.contactMethod }).select("id").single();
    if (ins.error) { console.error("customer insert", ins.error.message); return json(req, 500, { ok: false }); }
    customerId = ins.data.id;
  } else {
    await db.from("customers").update({ preferred_contact: v.contactMethod }).eq("id", customerId);
  }

  // Accidental duplicate: same customer, service and date already waiting as "new" in the last 24h.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const dup = await db.from("bookings").select("reference").eq("customer_id", customerId).eq("service", v.service)
    .eq("preferred_date", v.date).eq("status", "new").gte("created_at", since).limit(1);
  if (dup.data?.length) return json(req, 200, { ok: true, reference: dup.data[0].reference });

  // Insert the booking (retry if a random reference collides).
  const nowIso = new Date().toISOString();
  let booking: { id: string; reference: string } | null = null;
  for (let i = 0; i < 4 && !booking; i++) {
    const ins = await db.from("bookings").insert({
      reference: makeRef(), customer_id: customerId, service: v.service, preferred_date: v.date, preferred_time: v.time,
      message: v.message || null, idempotency_key: v.idempotencyKey, terms_accepted_at: nowIso, boundaries_acknowledged_at: nowIso,
    }).select("id, reference").single();
    if (!ins.error) booking = ins.data;
    else if (ins.error.code === "23505" && ins.error.message.includes("idempotency")) {
      const again = await db.from("bookings").select("reference").eq("idempotency_key", v.idempotencyKey).single();
      if (again.data) return json(req, 200, { ok: true, reference: again.data.reference });
    } else if (ins.error.code !== "23505") { console.error("booking insert", ins.error.message); return json(req, 500, { ok: false }); }
  }
  if (!booking) return json(req, 500, { ok: false });

  // Stored. Now notify; record exactly what the provider says. A failed email never fails the booking.
  const svc = SERVICE_LABELS[v.service];
  const adminTo = Deno.env.get("NOTIFY_EMAIL_TO");
  const adminUrl = Deno.env.get("ADMIN_URL") ?? "";
  const rows: [string, string][] = [["Reference", booking.reference], ["Service", svc], ["Name", v.name], ["Email", v.email], ["Phone", v.phone],
    ["Contact by", METHOD_LABEL[v.contactMethod]], ["Preferred date", v.date], ["Preferred time", TIME_LABEL[v.time]], ["Note", v.message || "—"]];
  const adminHtml = `<h2>New booking request ${escapeHtml(booking.reference)}</h2><table cellpadding="6">${rows.map(([k, val]) => `<tr><td><b>${k}</b></td><td>${escapeHtml(val).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>` +
    (adminUrl ? `<p><a href="${escapeHtml(adminUrl)}">Open admin</a></p>` : "") + `<p>This is a request, not a confirmed appointment.</p>`;
  const adminText = rows.map(([k, val]) => `${k}: ${val}`).join("\n") + (adminUrl ? `\n\nAdmin: ${adminUrl}` : "");
  const custHtml = `<p>Hello ${escapeHtml(v.name.split(" ")[0])},</p><p>Thank you — we have received your request for <b>${escapeHtml(svc)}</b> (preferred: ${escapeHtml(v.date)}, ${escapeHtml(TIME_LABEL[v.time].toLowerCase())}).</p>` +
    `<p>Your reference is <b>${escapeHtml(booking.reference)}</b>. <b>This is not yet a confirmed appointment.</b> We will contact you by ${escapeHtml(METHOD_LABEL[v.contactMethod].toLowerCase())} to confirm a time or suggest another.</p><p>NSEYIN</p>`;
  const custText = `Hello ${v.name.split(" ")[0]},\n\nThank you — we have received your request for ${svc} (preferred: ${v.date}, ${TIME_LABEL[v.time].toLowerCase()}).\n\nYour reference is ${booking.reference}. This is not yet a confirmed appointment. We will contact you by ${METHOD_LABEL[v.contactMethod].toLowerCase()} to confirm a time or suggest another.\n\nNSEYIN`;

  const results = await Promise.all([
    adminTo ? sendEmail({ to: adminTo, subject: oneLine(`New booking request ${booking.reference} — ${svc}`), html: adminHtml, text: adminText, replyTo: v.email })
            : Promise.resolve<SendResult>({ status: "skipped", error: "NOTIFY_EMAIL_TO not configured" }),
    sendEmail({ to: v.email, subject: `We received your request (${booking.reference})`, html: custHtml, text: custText }),
  ]);
  await db.from("notification_log").insert([
    { booking_id: booking.id, kind: "admin_new_booking", status: results[0].status, provider_id: results[0].id ?? null, error: results[0].error ?? null },
    { booking_id: booking.id, kind: "customer_ack", status: results[1].status, provider_id: results[1].id ?? null, error: results[1].error ?? null },
  ]);

  return json(req, 200, { ok: true, reference: booking.reference });
});

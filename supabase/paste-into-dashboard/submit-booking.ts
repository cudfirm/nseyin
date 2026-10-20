// NSEYIN — submit-booking. ONE FILE: copy ALL of this into the Supabase function editor.
import { createClient } from "npm:@supabase/supabase-js@2";

// ---- validate.ts ----
// Pure validation — no Deno or network APIs, so it can be unit-tested in Node.
const SERVICES = ["deep-tissue", "swedish", "sports", "shiatsu", "unsure"] as const;
const TIMES = ["morning", "afternoon", "evening", "flexible"] as const;
const DURATIONS = ["30", "60", "custom"] as const;
const LOCATIONS = ["workspace", "home", "suite"] as const;
const CONTACT_METHODS = ["email", "phone", "whatsapp"] as const;
const SERVICE_LABELS: Record<string, string> = {
  "deep-tissue": "Deep Tissue Massage", swedish: "Swedish Massage", sports: "Sports Massage",
  shiatsu: "Shiatsu Massage", unsure: "Not sure yet — advise",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:]{2,}$/;
// deno-lint-ignore no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const DURATION_LABELS: Record<string, string> = { "30": "30 minutes", "60": "1 hour", custom: "Custom length (to be agreed)" };
const LOCATION_LABELS: Record<string, string> = { workspace: "At the NSEYIN workspace (Boundary, Ajegunle)", home: "Home service", suite: "Private suite" };
const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(CONTROL, "").replace(/\r\n?/g, "\n").trim().slice(0, max) : "";
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, " ").trim();

function lagosToday(now = Date.now()): string {
  return new Date(now + 60 * 60 * 1000).toISOString().slice(0, 10); // Africa/Lagos is UTC+1, no DST
}
function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z"); return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
}

type Errors = Record<string, string>;

function validateBooking(b: any, now = Date.now()) {
  const errors: Errors = {};
  const body = b && typeof b === "object" ? b : {};
  const v = {
    idempotencyKey: typeof body.idempotencyKey === "string" && UUID.test(body.idempotencyKey) ? body.idempotencyKey.toLowerCase() : "",
    service: clean(body.service, 20),
    name: oneLine(clean(body.name, 100)),
    email: oneLine(clean(body.email, 160)),
    phone: oneLine(clean(body.phone, 30)),
    duration: clean(body.duration, 8),
    location: clean(body.location, 12),
    contactMethod: clean(body.contactMethod, 12),
    date: clean(body.date, 10),
    time: clean(body.time, 12),
    message: clean(body.message, 600),
  };
  if (!v.idempotencyKey) errors.idempotencyKey = "Invalid request. Please reload the page and try again.";
  if (!(SERVICES as readonly string[]).includes(v.service)) errors.service = "Please choose a service.";
  if (!(DURATIONS as readonly string[]).includes(v.duration)) errors.duration = "Please choose how long you would like.";
  if (!(LOCATIONS as readonly string[]).includes(v.location)) errors.location = "Please choose where you would like the session.";
  if (v.name.length < 2) errors.name = "Please enter your full name.";
  if (!EMAIL.test(v.email)) errors.email = "Please enter a valid email address.";
  const digits = v.phone.replace(/\D/g, "");
  if (!/^[+\d][\d\s\-()]*$/.test(v.phone) || digits.length < 7 || digits.length > 15) errors.phone = "Please enter a phone number with 7–15 digits.";
  if (!(CONTACT_METHODS as readonly string[]).includes(v.contactMethod)) errors.contactMethod = "Please choose how we should reach you.";
  const today = lagosToday(now);
  if (!isRealDate(v.date)) errors.date = "Please choose a valid date.";
  else if (v.date < today) errors.date = "Please choose today or a future date.";
  else if (v.date > addDays(today, 125)) errors.date = "Please choose a date within the next 4 months.";
  if (!(TIMES as readonly string[]).includes(v.time)) errors.time = "Please choose a preferred time of day.";
  if (typeof body.message === "string" && body.message.length > 600) errors.message = "Please keep your note under 600 characters.";
  if (body.acceptedTerms !== true) errors.terms = "Please accept the booking terms.";
  if (body.acknowledgedBoundaries !== true) errors.boundaries = "Please confirm you have read the boundaries and consent policy.";
  return { errors, value: v, ok: Object.keys(errors).length === 0 };
}

function validateContact(b: any) {
  const errors: Errors = {};
  const body = b && typeof b === "object" ? b : {};
  const v = {
    idempotencyKey: typeof body.idempotencyKey === "string" && UUID.test(body.idempotencyKey) ? body.idempotencyKey.toLowerCase() : "",
    name: oneLine(clean(body.name, 100)), email: oneLine(clean(body.email, 160)), message: clean(body.message, 1500),
  };
  if (!v.idempotencyKey) errors.idempotencyKey = "Invalid request. Please reload the page and try again.";
  if (v.name.length < 2) errors.name = "Please enter your name.";
  if (!EMAIL.test(v.email)) errors.email = "Please enter a valid email address.";
  if (v.message.length < 10) errors.message = "Please write a short message (at least 10 characters).";
  if (typeof body.message === "string" && body.message.length > 1500) errors.message = "Please keep your message under 1500 characters.";
  return { errors, value: v, ok: Object.keys(errors).length === 0 };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Bots fill the hidden field or submit impossibly fast. */
const looksLikeBot = (body: any, minMs = 4000): boolean =>
  (typeof body?.website === "string" && body.website.trim() !== "") ||
  (typeof body?.elapsedMs === "number" && body.elapsedMs < minMs);

// ---- http.ts ----
function corsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("Origin") ?? "";
  const h: Record<string, string> = { "Vary": "Origin", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin; // default: no cross-origin access
  return h;
}
function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
async function readJson(req: Request, maxBytes = 16_000): Promise<unknown | null> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try { return JSON.parse(text); } catch { return null; }
}
async function hashKey(prefix: string, value: string): Promise<string> {
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + value));
  return prefix + ":" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ?? "unknown";
}

// ---- email.ts ----
// Sends via Resend (https://resend.com). Reports exactly what the provider returned; never pretends.
type SendResult = { status: "sent" | "failed" | "skipped"; id?: string; error?: string };

async function sendEmail(opts: { to: string; subject: string; html: string; text: string; replyTo?: string }): Promise<SendResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!key || !from) return { status: "skipped", error: "RESEND_API_KEY or EMAIL_FROM not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html, text: opts.text, reply_to: opts.replyTo }),
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body?.id) return { status: "sent", id: String(body.id) };
    return { status: "failed", error: `HTTP ${res.status}: ${String(body?.message ?? "").slice(0, 200)}` };
  } catch (e) {
    return { status: "failed", error: String((e as Error).message ?? e).slice(0, 200) };
  }
}

// ---- main ----
// POST /functions/v1/submit-booking — guest appointment REQUEST (not a confirmed appointment).





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
      reference: makeRef(), customer_id: customerId, service: v.service, duration: v.duration, session_location: v.location, preferred_date: v.date, preferred_time: v.time,
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
  const rows: [string, string][] = [["Reference", booking.reference], ["Service", svc], ["Length", DURATION_LABELS[v.duration]], ["Where", LOCATION_LABELS[v.location]], ["Name", v.name], ["Email", v.email], ["Phone", v.phone],
    ["Contact by", METHOD_LABEL[v.contactMethod]], ["Preferred date", v.date], ["Preferred time", TIME_LABEL[v.time]], ["Note", v.message || "—"]];
  const adminHtml = `<h2>New booking request ${escapeHtml(booking.reference)}</h2><table cellpadding="6">${rows.map(([k, val]) => `<tr><td><b>${k}</b></td><td>${escapeHtml(val).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>` +
    (adminUrl ? `<p><a href="${escapeHtml(adminUrl)}">Open admin</a></p>` : "") + `<p>This is a request, not a confirmed appointment.</p>`;
  const adminText = rows.map(([k, val]) => `${k}: ${val}`).join("\n") + (adminUrl ? `\n\nAdmin: ${adminUrl}` : "");
  const custHtml = `<p>Hello ${escapeHtml(v.name.split(" ")[0])},</p><p>Thank you — we have received your request for <b>${escapeHtml(svc)}</b>, ${escapeHtml(DURATION_LABELS[v.duration].toLowerCase())}, ${escapeHtml(LOCATION_LABELS[v.location].toLowerCase())} (preferred: ${escapeHtml(v.date)}, ${escapeHtml(TIME_LABEL[v.time].toLowerCase())}).</p>` +
    `<p>Your reference is <b>${escapeHtml(booking.reference)}</b>. <b>This is not yet a confirmed appointment.</b> We will contact you by ${escapeHtml(METHOD_LABEL[v.contactMethod].toLowerCase())} to confirm a time or suggest another.</p><p>NSEYIN</p>`;
  const custText = `Hello ${v.name.split(" ")[0]},\n\nThank you — we have received your request for ${svc}, ${DURATION_LABELS[v.duration].toLowerCase()}, ${LOCATION_LABELS[v.location].toLowerCase()} (preferred: ${v.date}, ${TIME_LABEL[v.time].toLowerCase()}).\n\nYour reference is ${booking.reference}. This is not yet a confirmed appointment. We will contact you by ${METHOD_LABEL[v.contactMethod].toLowerCase()} to confirm a time or suggest another.\n\nNSEYIN`;

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

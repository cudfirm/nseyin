// POST /functions/v1/submit-contact — general enquiry from the contact form.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, readJson, hashKey, clientIp } from "../_shared/http.ts";
import { validateContact, looksLikeBot, escapeHtml, oneLine } from "../_shared/validate.ts";
import { sendEmail } from "../_shared/email.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false });
  const raw = await readJson(req);
  if (raw === null) return json(req, 400, { ok: false, errors: { _: "Invalid request." } });

  const { data: allowed, error: rlErr } = await db.rpc("rate_limit_hit", { p_key: await hashKey("ip-contact", clientIp(req)), p_window_seconds: 3600, p_max: 6 });
  if (rlErr) { console.error("rate limit error", rlErr.message); return json(req, 500, { ok: false }); }
  if (!allowed) return json(req, 429, { ok: false });
  if (looksLikeBot(raw)) return json(req, 200, { ok: true });

  const { errors, value: v, ok } = validateContact(raw);
  if (!ok) return json(req, 400, { ok: false, errors });

  const existing = await db.from("contact_messages").select("id").eq("idempotency_key", v.idempotencyKey).maybeSingle();
  if (existing.data) return json(req, 200, { ok: true });

  const ins = await db.from("contact_messages").insert({ name: v.name, email: v.email, message: v.message, idempotency_key: v.idempotencyKey }).select("id").single();
  if (ins.error) { console.error("contact insert", ins.error.message); return json(req, 500, { ok: false }); }

  const to = Deno.env.get("NOTIFY_EMAIL_TO");
  const r = to ? await sendEmail({ to, subject: oneLine(`New website message from ${v.name}`), replyTo: v.email,
      html: `<p><b>${escapeHtml(v.name)}</b> (${escapeHtml(v.email)}) wrote:</p><p>${escapeHtml(v.message).replace(/\n/g, "<br>")}</p>`,
      text: `${v.name} (${v.email}) wrote:\n\n${v.message}` }) : { status: "skipped" as const, error: "NOTIFY_EMAIL_TO not configured" };
  await db.from("notification_log").insert({ contact_message_id: ins.data.id, kind: "admin_new_contact", status: r.status, provider_id: r.id ?? null, error: r.error ?? null });
  return json(req, 200, { ok: true });
});

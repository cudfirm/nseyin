import { store, rl } from "./mock_supabase.ts";
Deno.env.set("SUPABASE_URL", "http://x"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "k"); Deno.env.set("ALLOWED_ORIGINS", "https://site.test");
Deno.env.set("RESEND_API_KEY", "re_test"); Deno.env.set("EMAIL_FROM", "NSEYIN <hello@site.test>"); Deno.env.set("NOTIFY_EMAIL_TO", "owner@site.test"); Deno.env.set("RATE_LIMIT_SALT", "salt");
const sent: any[] = []; let emailMode: "ok" | "fail" = "ok";
globalThis.fetch = ((url: string, init: any) => { const b = JSON.parse(init.body); sent.push({ url, ...b });
  return Promise.resolve(emailMode === "ok" ? new Response(JSON.stringify({ id: "msg_" + sent.length }), { status: 200 }) : new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 })); }) as any;
let handler: (r: Request) => Promise<Response>;
(Deno as any).serve = (h: any) => { handler = h; return {}; };
await import("../supabase/functions/submit-booking/index.ts");
const booking = handler!;
await import("../supabase/functions/submit-contact/index.ts");
const contact = handler!;
let pass = 0, fail = 0; const t = (n: string, c: boolean, x: any = "") => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : "  " + JSON.stringify(x))); };
const lagos = (n: number) => new Date(Date.now() + 36e5 + n * 864e5).toISOString().slice(0, 10);
const good = () => ({ idempotencyKey: crypto.randomUUID(), service: "swedish", duration: "60", location: "home", name: "Ada Obi", email: "ada@example.com", phone: "+234 801 234 5678", contactMethod: "email", date: lagos(3), time: "evening", message: "Light pressure please", acceptedTerms: true, acknowledgedBoundaries: true, website: "", elapsedMs: 30000 });
const post = (fn: any, body: any, ip = "1.1.1.1", origin = "https://site.test") => fn(new Request("http://f/", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip, Origin: origin }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const j = async (r: Response) => ({ s: r.status, b: await r.json(), h: r.headers });

let r = await j(await post(booking, good()));
t("valid booking -> 200 ok with reference", r.s === 200 && r.b.ok && /^NSY-[A-Z2-9]{6}$/.test(r.b.reference), r);
t("booking stored", store.bookings.length === 1 && store.customers.length === 1);
t("terms/boundaries timestamps stored", !!store.bookings[0].terms_accepted_at && !!store.bookings[0].boundaries_acknowledged_at);
t("length and place stored", store.bookings[0].duration === "60" && store.bookings[0].session_location === "home");
t("both emails mention length and place", sent[0].text.includes("1 hour") && sent[0].text.includes("Home service") && sent[1].text.includes("home service"));
t("two emails sent (admin + customer)", sent.length === 2 && sent[0].to[0] === "owner@site.test" && sent[1].to[0] === "ada@example.com");
t("admin email says request not confirmed", sent[0].text.length > 0 && sent[0].html.includes("not a confirmed appointment"));
t("customer email says not confirmed", sent[1].text.includes("not yet a confirmed appointment"));
t("notification_log records provider ids", store.notification_log.length === 2 && store.notification_log.every((n) => n.status === "sent" && n.provider_id?.startsWith("msg_")), store.notification_log);
t("CORS allows listed origin", r.h.get("Access-Control-Allow-Origin") === "https://site.test");
const other = await j(await post(booking, good(), "9.9.9.9", "https://evil.test"));
t("CORS withheld for other origin", other.h.get("Access-Control-Allow-Origin") === null);

// idempotency: exact same key
store.bookings.length = 0; store.customers.length = 0; sent.length = 0; store.notification_log.length = 0;
const g = good(); const a = await j(await post(booking, g, "2.2.2.2")); const b = await j(await post(booking, g, "2.2.2.2"));
t("same idempotency key returns same reference", a.b.reference === b.b.reference && store.bookings.length === 1, { a, b });
t("no second email on retry", sent.length === 2);
// accidental duplicate with new key
const c2 = await j(await post(booking, good(), "2.2.2.2"));
t("same customer+service+date within 24h not duplicated", c2.b.reference === a.b.reference && store.bookings.length === 1, c2);
t("repeat customer reuses customer id", store.customers.length === 1);
// different service same customer -> new booking, same customer
const c3 = await j(await post(booking, { ...good(), service: "sports" }, "2.2.2.2"));
t("different service creates new booking for same customer", store.bookings.length === 2 && store.customers.length === 1 && c3.b.reference !== a.b.reference);
// email case-insensitive match
await post(booking, { ...good(), email: "ADA@Example.com", service: "shiatsu" }, "2.2.2.2");
t("email match is case-insensitive", store.customers.length === 1);
// same phone different name -> new customer
await post(booking, { ...good(), email: "other@example.com", name: "Someone Else", service: "deep-tissue" }, "3.3.3.3");
t("same phone but different name+email -> separate customer", store.customers.length === 2);

// validation
const inv = await j(await post(booking, { ...good(), email: "nope" }, "4.4.4.4"));
t("invalid input -> 400 with field errors", inv.s === 400 && inv.b.errors.email, inv);
const n0 = store.bookings.length;
const hp = await j(await post(booking, { ...good(), website: "http://spam" }, "5.5.5.5"));
t("honeypot: fake success, nothing stored", hp.s === 200 && store.bookings.length === n0);
const fast = await j(await post(booking, { ...good(), elapsedMs: 500 }, "5.5.5.5"));
t("too fast: fake success, nothing stored", fast.s === 200 && store.bookings.length === n0);
t("bad JSON -> 400", (await j(await post(booking, "{not json", "6.6.6.6"))).s === 400);
t("oversized body -> 400", (await j(await post(booking, "x".repeat(20000), "6.6.6.6"))).s === 400);
t("GET -> 405", (await booking(new Request("http://f/", { method: "GET" }))).status === 405);
const pre = await booking(new Request("http://f/", { method: "OPTIONS", headers: { Origin: "https://site.test" } }));
t("OPTIONS preflight 204", pre.status === 204 && pre.headers.get("Access-Control-Allow-Origin") === "https://site.test");

// rate limit: 8/hour per IP
const codes: number[] = []; for (let i = 0; i < 10; i++) codes.push((await post(booking, { ...good(), email: `u${i}@example.com` }, "7.7.7.7")).status);
t("IP rate limit: 429 after 8 requests", codes.slice(0, 8).every((c) => c === 200) && codes[8] === 429 && codes[9] === 429, codes);
t("raw IP never stored in rate-limit keys", Object.keys(rl).every((k) => !k.includes("7.7.7.7")));
// per-email limit
const ec: number[] = []; for (let i = 0; i < 9; i++) ec.push((await post(booking, { ...good(), service: i % 2 ? "sports" : "swedish", date: lagos(i + 1) }, `8.8.8.${i}`)).status);
t("per-email limit blocks 7th+ in an hour", ec.includes(429), ec);

// email provider failure must not fail the booking, and must be logged honestly
emailMode = "fail"; store.notification_log.length = 0;
const f = await j(await post(booking, { ...good(), email: "fail@example.com", name: "Fay Ilure", phone: "08011111111" }, "10.0.0.1"));
t("email failure: booking still accepted", f.s === 200 && f.b.ok);
t("email failure logged as failed with reason", store.notification_log.length === 2 && store.notification_log.every((n) => n.status === "failed" && /403/.test(n.error)), store.notification_log);
emailMode = "ok";
// HTML injection in name/message is escaped in admin email
sent.length = 0;
await post(booking, { ...good(), email: "xss@example.com", phone: "08022222222", name: "<img src=x onerror=alert(1)> Eve", message: "<script>alert(1)</script>" }, "10.0.0.2");
t("user content HTML-escaped in emails", !sent[0].html.includes("<script>") && !sent[0].html.includes("<img") && sent[0].html.includes("&lt;script&gt;"));
// missing email config -> skipped, not "sent"
Deno.env.delete("RESEND_API_KEY"); store.notification_log.length = 0;
await post(booking, { ...good(), email: "noemail@example.com", name: "No Mail", phone: "08033333333" }, "10.0.0.3");
t("no email config: logged as skipped, not sent", store.notification_log.every((n) => n.status === "skipped"), store.notification_log);
Deno.env.set("RESEND_API_KEY", "re_test");

// contact function
const cg = () => ({ idempotencyKey: crypto.randomUUID(), name: "Ben", email: "ben@example.com", message: "Do you offer Shiatsu on weekends?", website: "", elapsedMs: 20000 });
sent.length = 0; const cr = await j(await post(contact, cg(), "11.0.0.1"));
t("contact: stored + owner emailed", cr.s === 200 && store.contact_messages.length === 1 && sent.length === 1 && sent[0].reply_to === "ben@example.com", { cr, sent });
const cg2 = cg(); await post(contact, cg2, "11.0.0.2"); const before = store.contact_messages.length; await post(contact, cg2, "11.0.0.2");
t("contact: idempotent retry", store.contact_messages.length === before);
t("contact: invalid -> 400", (await j(await post(contact, { ...cg(), message: "hi" }, "11.0.0.3"))).s === 400);
t("contact: honeypot ignored", (await post(contact, { ...cg(), website: "x" }, "11.0.0.4")).status === 200);
console.log(`\n${pass} passed, ${fail} failed`); Deno.exit(fail ? 1 : 0);

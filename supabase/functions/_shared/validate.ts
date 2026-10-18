// Pure validation — no Deno or network APIs, so it can be unit-tested in Node.
export const SERVICES = ["deep-tissue", "swedish", "sports", "shiatsu", "unsure"] as const;
export const TIMES = ["morning", "afternoon", "evening", "flexible"] as const;
export const CONTACT_METHODS = ["email", "phone", "whatsapp"] as const;
export const SERVICE_LABELS: Record<string, string> = {
  "deep-tissue": "Deep Tissue Massage", swedish: "Swedish Massage", sports: "Sports Massage",
  shiatsu: "Shiatsu Massage", unsure: "Not sure yet — advise",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:]{2,}$/;
// deno-lint-ignore no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(CONTROL, "").replace(/\r\n?/g, "\n").trim().slice(0, max) : "";
export const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, " ").trim();

export function lagosToday(now = Date.now()): string {
  return new Date(now + 60 * 60 * 1000).toISOString().slice(0, 10); // Africa/Lagos is UTC+1, no DST
}
function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z"); return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
}

export type Errors = Record<string, string>;

export function validateBooking(b: any, now = Date.now()) {
  const errors: Errors = {};
  const body = b && typeof b === "object" ? b : {};
  const v = {
    idempotencyKey: typeof body.idempotencyKey === "string" && UUID.test(body.idempotencyKey) ? body.idempotencyKey.toLowerCase() : "",
    service: clean(body.service, 20),
    name: oneLine(clean(body.name, 100)),
    email: oneLine(clean(body.email, 160)),
    phone: oneLine(clean(body.phone, 30)),
    contactMethod: clean(body.contactMethod, 12),
    date: clean(body.date, 10),
    time: clean(body.time, 12),
    message: clean(body.message, 600),
  };
  if (!v.idempotencyKey) errors.idempotencyKey = "Invalid request. Please reload the page and try again.";
  if (!(SERVICES as readonly string[]).includes(v.service)) errors.service = "Please choose a service.";
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

export function validateContact(b: any) {
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

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Bots fill the hidden field or submit impossibly fast. */
export const looksLikeBot = (body: any, minMs = 4000): boolean =>
  (typeof body?.website === "string" && body.website.trim() !== "") ||
  (typeof body?.elapsedMs === "number" && body.elapsedMs < minMs);

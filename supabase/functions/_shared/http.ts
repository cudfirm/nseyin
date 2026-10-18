export function corsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("Origin") ?? "";
  const h: Record<string, string> = { "Vary": "Origin", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin; // default: no cross-origin access
  return h;
}
export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
export async function readJson(req: Request, maxBytes = 16_000): Promise<unknown | null> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try { return JSON.parse(text); } catch { return null; }
}
export async function hashKey(prefix: string, value: string): Promise<string> {
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + value));
  return prefix + ":" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ?? "unknown";
}

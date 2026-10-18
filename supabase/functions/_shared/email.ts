// Sends via Resend (https://resend.com). Reports exactly what the provider returned; never pretends.
export type SendResult = { status: "sent" | "failed" | "skipped"; id?: string; error?: string };

export async function sendEmail(opts: { to: string; subject: string; html: string; text: string; replyTo?: string }): Promise<SendResult> {
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

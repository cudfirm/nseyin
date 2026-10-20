// Minimal in-memory stand-in for the supabase-js query builder (only what the functions use).
export const store: Record<string, any[]> = { customers: [], bookings: [], notification_log: [], contact_messages: [], booking_events: [] };
export const rl: Record<string, number> = {};
const uniq: Record<string, string[]> = { bookings: ["reference", "idempotency_key"], contact_messages: ["idempotency_key"] };
export function createClient() {
  return {
    rpc: (fn: string, a: any) => Promise.resolve(fn === "rate_limit_hit" ? { data: (rl[a.p_key] = (rl[a.p_key] ?? 0) + 1) <= a.p_max, error: null } : { data: null, error: { message: "unknown rpc" } }),
    from(table: string) {
      const filters: ((r: any) => boolean)[] = []; let op = "select", payload: any = null, lim = 1e9, single: null | "one" | "maybe" = null, wantRows = false;
      const q: any = {
        select() { wantRows = true; return q; }, insert(p: any) { op = "insert"; payload = p; return q; }, update(p: any) { op = "update"; payload = p; return q; },
        eq(c: string, v: any) { filters.push((r) => r[c] === v); return q; }, is(c: string, v: any) { filters.push((r) => (r[c] ?? null) === v); return q; },
        gte(c: string, v: any) { filters.push((r) => r[c] >= v); return q; }, order() { return q; }, limit(n: number) { lim = n; return q; },
        maybeSingle() { single = "maybe"; return q; }, single() { single = "one"; return q; },
        then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); },
      };
      function run() {
        const rows = store[table];
        if (op === "insert") {
          const items = Array.isArray(payload) ? payload : [payload]; const out: any[] = [];
          for (const it of items) {
            const row: any = { id: crypto.randomUUID(), created_at: new Date().toISOString(), status: table === "bookings" ? "new" : undefined, anonymised_at: null, ...it };
            if (table === "customers") { row.email_norm = row.email?.trim().toLowerCase() ?? null; row.phone_norm = (row.phone ?? "").replace(/\D/g, ""); }
            for (const u of uniq[table] ?? []) if (row[u] != null && rows.some((r) => r[u] === row[u])) return { data: null, error: { code: "23505", message: `duplicate key value violates unique constraint "${table}_${u}_key"` } };
            rows.push(row); out.push(row);
          }
          return fin(out);
        }
        const m = rows.filter((r) => filters.every((f) => f(r)));
        if (op === "update") { m.forEach((r) => Object.assign(r, payload)); return fin(m); }
        return fin(m.slice(0, lim));
      }
      function fin(d: any[]) {
        if (single === "one") return d.length === 1 ? { data: d[0], error: null } : { data: null, error: { message: "no single row" } };
        if (single === "maybe") return { data: d[0] ?? null, error: null };
        return { data: d, error: null };
      }
      return q;
    },
  };
}

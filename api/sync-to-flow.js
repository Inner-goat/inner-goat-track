import { sql } from "@vercel/postgres";

// Schiebt Leads aus der Tracking-DB in GOAT Flow (gleicher Ingest-Schritt wie der
// Echtzeit-Hook in lead.js). Selbstheilend: idempotent in GOAT Flow, daher gefahrlos
// wiederholbar. Läuft per Vercel-Cron UND manuell triggerbar.
// Auth: Authorization: Bearer ${INGEST_API_KEY}  (oder CRON_SECRET, von Vercel-Cron gesetzt).
// Optional ?days=N begrenzt auf die letzten N Tage (sonst alle).
export default async function handler(req, res) {
  const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const ok = auth && (auth === process.env.INGEST_API_KEY || auth === process.env.CRON_SECRET);
  if (!ok) return res.status(401).json({ error: "unauthorized" });

  const url = process.env.GOATFLOW_INGEST_URL;
  const key = process.env.INGEST_API_KEY;
  if (!url || !key) return res.status(503).json({ error: "not_configured" });

  const days = parseInt(req.query?.days, 10);
  let rows;
  try {
    rows = Number.isFinite(days)
      ? (await sql`SELECT email, name, source FROM leads WHERE ts > now() - (${days} || ' days')::interval ORDER BY ts ASC`).rows
      : (await sql`SELECT email, name, source FROM leads ORDER BY ts ASC`).rows;
  } catch (e) {
    return res.status(500).json({ error: "db" });
  }

  let ingested = 0, enrolled = 0, failed = 0;
  for (const l of rows) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ email: l.email, name: l.name || "", campaign: (l.source || "ideen").toLowerCase() }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) { ingested++; if (j.enrolled) enrolled++; } else failed++;
    } catch {
      failed++;
    }
  }
  res.json({ ok: true, total: rows.length, ingested, enrolled, failed });
}

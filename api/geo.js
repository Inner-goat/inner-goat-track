import { sql } from "@vercel/postgres";

// POST /api/geo  {sid, lat, lng, acc}  → hängt GPS-Koordinaten an einen Scan an.
// Wird von der Zwischenseite (/r/:id) aufgerufen, wenn der Nutzer "Standort erlauben" tippt.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const { sid, lat, lng, acc } = req.body || {};
  const id = parseInt(sid, 10);
  if (!id || typeof lat !== "number" || typeof lng !== "number") return res.status(400).json({ error: "bad" });
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.status(400).json({ error: "range" });
  try {
    await sql`UPDATE scans SET lat=${lat}, lng=${lng}, acc=${acc ? Math.round(acc) : null} WHERE id=${id}`;
  } catch (e) {
    return res.status(500).json({ error: "db" });
  }
  res.json({ ok: true });
}

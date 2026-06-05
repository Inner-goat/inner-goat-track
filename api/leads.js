import { sql } from "@vercel/postgres";
import { auth } from "./_lib.js";

// GET /api/leads?key=PW         → JSON (count + Liste)
// GET /api/leads?key=PW&csv=1   → CSV-Download
export default async function handler(req, res) {
  if (!auth(req, res)) return;
  const rows = (await sql`SELECT email, source, answer, to_char(ts,'YYYY-MM-DD HH24:MI') ts FROM leads ORDER BY id DESC`).rows;
  if (req.query.csv) {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["email,source,answer,ts", ...rows.map(r => [r.email, r.source, r.answer, r.ts].map(esc).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=inner-goat-leads.csv");
    return res.send(csv);
  }
  res.json({ count: rows.length, leads: rows });
}

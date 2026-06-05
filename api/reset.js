import { sql } from "@vercel/postgres";
import { auth } from "./_lib.js";

// GET /api/reset?key=PW  → löscht ALLE Scans (Links/Ziele bleiben erhalten).
// Praktisch, um den Zähler vor der Kampagne (oder nach Tests) auf 0 zu setzen.
export default async function handler(req, res) {
  if (!auth(req, res)) return;
  const before = (await sql`SELECT COUNT(*)::int c FROM scans`).rows[0].c;
  await sql`TRUNCATE TABLE scans RESTART IDENTITY`;
  let leads = null;
  if (req.query.leads === "1") {                 // nur auf ausdrücklichen Wunsch
    leads = (await sql`SELECT COUNT(*)::int c FROM leads`).rows[0].c;
    await sql`TRUNCATE TABLE leads RESTART IDENTITY`;
  }
  res.json({ ok: true, deleted: before, leadsDeleted: leads, message: "Scans gelöscht." + (leads !== null ? ` ${leads} Leads gelöscht.` : "") });
}

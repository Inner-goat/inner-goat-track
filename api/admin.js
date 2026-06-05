import { sql } from "@vercel/postgres";
import { auth } from "./_lib.js";

// GET  /api/admin?key=PW           → list links
// POST /api/admin?key=PW {id,destination} → update a destination
export default async function handler(req, res) {
  if (!auth(req, res)) return;
  if (req.method === "POST") {
    const { id, destination } = req.body || {};
    if (id) await sql`UPDATE links SET destination=${destination} WHERE id=${id}`;
    return res.json({ ok: true });
  }
  const links = (await sql`SELECT id, name, cta, destination FROM links ORDER BY id`).rows;
  res.json({ links });
}

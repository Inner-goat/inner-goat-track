import { sql } from "@vercel/postgres";
import { auth, SEED } from "./_lib.js";

// GET /api/setup?key=PW  → create tables + seed the 8 links (run once)
export default async function handler(req, res) {
  // Zugang per ADMIN_PASSWORD ODER CRON_SECRET (beides starke Secrets) —
  // erlaubt Migrationen auch ohne Klartext-Admin-Passwort.
  const key = (req.query && req.query.key) || "";
  const cron = process.env.CRON_SECRET || "";
  const viaCron = cron.length > 0 && key === cron;
  if (!viaCron && !auth(req, res)) return;
  await sql`CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY, name TEXT, cta TEXT, destination TEXT, created TIMESTAMPTZ DEFAULT now())`;
  // Trennung Sticker ↔ Kampagne + welche Lead-Quelle ein Link speist.
  await sql`ALTER TABLE links ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'sticker'`;
  await sql`ALTER TABLE links ADD COLUMN IF NOT EXISTS campaign TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS scans (
    id BIGSERIAL PRIMARY KEY, link_id TEXT, ts TIMESTAMPTZ,
    country TEXT, city TEXT, region TEXT, device TEXT, os TEXT, browser TEXT,
    lang TEXT, referer TEXT, ua TEXT, is_bot BOOLEAN DEFAULT false, visit_hash TEXT)`;
  // Falls die Tabelle aus einer früheren Version stammt: Spalten nachrüsten.
  await sql`ALTER TABLE scans ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE scans ADD COLUMN IF NOT EXISTS visit_hash TEXT`;
  await sql`ALTER TABLE scans ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`;
  await sql`ALTER TABLE scans ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`;
  await sql`ALTER TABLE scans ADD COLUMN IF NOT EXISTS acc INT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_scans_link ON scans(link_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_scans_hash ON scans(visit_hash)`;
  // Lead-Capture (Klickpfad-Funnels "Ideenliste" + "KI-App-Bauplan")
  await sql`CREATE TABLE IF NOT EXISTS leads (
    id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE, source TEXT, answer TEXT, ts TIMESTAMPTZ DEFAULT now())`;
  // Spalten nachrüsten: Name (Funnel fragt jetzt Vorname) + Followup-Tracking (Mail 2).
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS name TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_sent BOOLEAN DEFAULT false`;
  for (const [id, name, cta, dest, type, campaign] of SEED) {
    await sql`INSERT INTO links (id, name, cta, destination, type, campaign)
              VALUES (${id}, ${name}, ${cta}, ${dest}, ${type || 'sticker'}, ${campaign || null})
              ON CONFLICT (id) DO UPDATE SET
                name=EXCLUDED.name, cta=EXCLUDED.cta, destination=EXCLUDED.destination,
                type=EXCLUDED.type, campaign=EXCLUDED.campaign`;
  }
  // DB deklarativ an den SEED angleichen: Links entfernen, die nicht (mehr) im SEED stehen.
  const ids = SEED.map(s => s[0]);
  const { rowCount: removed } = await sql`DELETE FROM links WHERE id <> ALL(${ids}::text[])`;
  res.json({ ok: true, message: `Setup fertig. ${SEED.length} aktive Links, ${removed} alte entfernt.`, next: "/dashboard und /admin öffnen (Passwort = ADMIN_PASSWORD)." });
}

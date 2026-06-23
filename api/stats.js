import { sql } from "@vercel/postgres";
import { auth } from "./_lib.js";

// GET /api/stats?key=PW  → aggregated JSON for the dashboard
export default async function handler(req, res) {
  if (!auth(req, res)) return;
  const r = async (q) => (await q).rows;
  // Alle Auswertungen zählen nur echte Scans (is_bot=false). Link-Vorschauen
  // & Crawler werden ignoriert, aber separat als "bots" ausgewiesen.
  const total = (await sql`SELECT COUNT(*)::int c FROM scans WHERE is_bot=false`).rows[0].c;
  const unique = (await sql`SELECT COUNT(DISTINCT visit_hash)::int c FROM scans WHERE is_bot=false AND visit_hash IS NOT NULL`).rows[0].c;
  const bots = (await sql`SELECT COUNT(*)::int c FROM scans WHERE is_bot=true`).rows[0].c;
  const links = await r(sql`
    SELECT l.id, l.name, l.cta, l.destination, l.type, l.campaign, COUNT(s.id)::int n
    FROM links l LEFT JOIN scans s ON s.link_id = l.id AND s.is_bot=false
    GROUP BY l.id, l.name, l.cta, l.destination, l.type, l.campaign ORDER BY n DESC`);
  // ── Trennung Sticker ↔ Kampagnen ──────────────────────────────
  const stickers = links.filter(l => (l.type || 'sticker') === 'sticker');
  const leadsBySource = await r(sql`SELECT source k, COUNT(*)::int n FROM leads GROUP BY source`);
  const leadMap = Object.fromEntries(leadsBySource.map(x => [x.k, x.n]));
  const totalLeads = (await sql`SELECT COUNT(*)::int c FROM leads`).rows[0].c;
  // Kampagnen = alle Lead-Quellen ∪ alle Links mit campaign-Feld.
  // So erscheint jede Kampagne, sobald sie Leads ODER einen Tracking-Link hat.
  const campLink = Object.fromEntries(links.filter(l => l.campaign).map(l => [l.campaign, l]));
  const NAMES = { ideen: "Ideenliste", ki: "Hör auf, teure App-Abos zu zahlen",
                  skills: "25 Claude Skills, die dein Team ersetzen",
                  empfehlung: "Nie wieder nur von Empfehlungen leben" };
  const campIds = [...new Set([...Object.keys(campLink), ...leadsBySource.map(x => x.k)])].filter(Boolean);
  const campaigns = campIds.map(id => {
    const l = campLink[id];
    const scans = l ? l.n : 0;
    const leads = leadMap[id] || 0;
    return { id, name: (l && l.name) || NAMES[id] || id, scans, leads,
             conv: scans ? Math.round((leads / scans) * 100) : 0 };
  }).sort((a, b) => b.leads - a.leads);
  const byCta = await r(sql`SELECT l.cta k, COUNT(*)::int n FROM scans s JOIN links l ON l.id=s.link_id WHERE s.is_bot=false GROUP BY l.cta ORDER BY n DESC`);
  const byDevice = await r(sql`SELECT device k, COUNT(*)::int n FROM scans WHERE is_bot=false GROUP BY device ORDER BY n DESC`);
  const byOs = await r(sql`SELECT os k, COUNT(*)::int n FROM scans WHERE is_bot=false GROUP BY os ORDER BY n DESC`);
  const byBrowser = await r(sql`SELECT browser k, COUNT(*)::int n FROM scans WHERE is_bot=false GROUP BY browser ORDER BY n DESC`);
  const byCountry = await r(sql`SELECT country k, COUNT(*)::int n FROM scans WHERE is_bot=false AND country<>'' GROUP BY country ORDER BY n DESC LIMIT 12`);
  const byCity = await r(sql`SELECT city k, COUNT(*)::int n FROM scans WHERE is_bot=false AND city<>'' GROUP BY city ORDER BY n DESC LIMIT 12`);
  const byDay = await r(sql`SELECT to_char(ts AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') k, COUNT(*)::int n FROM scans WHERE is_bot=false GROUP BY k ORDER BY k`);
  const recent = await r(sql`
    SELECT to_char(s.ts AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD HH24:MI') ts, l.name, s.device, s.os, s.browser, s.country, s.city, s.lat, s.lng, s.acc
    FROM scans s JOIN links l ON l.id=s.link_id WHERE s.is_bot=false ORDER BY s.id DESC LIMIT 50`);
  const gps = (await sql`SELECT COUNT(*)::int c FROM scans WHERE is_bot=false AND lat IS NOT NULL`).rows[0].c;
  res.json({ total, unique, bots, gps, totalLeads, links, stickers, campaigns, byCta, byDevice, byOs, byBrowser, byCountry, byCity, byDay, recent });
}

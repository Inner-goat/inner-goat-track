import { sql } from "@vercel/postgres";

const FROM = "Inner GOAT <info@inner-goat.com>";
const ACADEMY = "https://inner-goat.com/inner-goat-academy/";

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Mail 2 für die KI-Kampagne: vom Bauplan zum Call / zur Academy.
function followupHtml(name) {
  const hi = (name && name.trim()) ? `Hey ${esc(name.trim())},` : "Hey,";
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0E0E0E">
    <div style="background:#FF5F00;padding:22px 24px;border-radius:14px 14px 0 0">
      <div style="font-weight:800;font-size:14px">INNER GOAT 🐐</div>
      <div style="font-weight:800;font-size:22px;margin-top:4px">Bock, das wirklich zu bauen?</div>
    </div>
    <div style="padding:24px;background:#fafafa;border-radius:0 0 14px 14px">
      <p>${hi}</p>
      <p>hast du in den <b>KI-App-Bauplan</b> reingeschaut? Dann kennst du jetzt den Stack und die 5 Schritte.</p>
      <p>Der ehrliche Teil: Das Schwierige ist nicht der Code — den macht die KI. Das Schwierige ist,
         <b>zu wissen, was man baut und in welcher Reihenfolge</b>. Genau da setzt die
         <a href="${ACADEMY}" style="color:#FF5F00;font-weight:700">Inner GOAT Academy</a> an —
         ich zeig dir Schritt für Schritt, wie du deine erste eigene App baust und live schaltest.</p>
      <p style="text-align:center;margin:26px 0">
        <a href="${ACADEMY}" style="background:#FF5F00;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:12px;display:inline-block">
          → Inner GOAT Academy ansehen</a>
      </p>
      <p>Oder du willst erst kurz quatschen, ob das zu dir passt? <b>Antworte einfach auf diese Mail</b> —
         ich meld mich für einen kurzen Call. 🐐</p>
      <p style="margin-top:24px">Trust your goat,<br><b>Marco · Inner GOAT</b></p>
      <p style="font-size:12px;color:#888;margin-top:20px">inner-goat.com · from founders to founders</p>
    </div>
  </div>`;
}

async function sendMail(to, name) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [to], reply_to: "info@inner-goat.com",
      subject: "Deine erste eigene App — so geht's weiter 🐐", html: followupHtml(name)
    })
  });
  return r.ok;
}

// GET /api/cron/followup  — von Vercel Cron täglich aufgerufen.
// Schickt allen KI-Leads, die seit >=1 Tag angemeldet sind und noch keine
// Folge-Mail bekommen haben, die Academy-/Call-Mail. Schutz via CRON_SECRET.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers["authorization"] || "";
  const keyParam = (req.query && req.query.key) || "";
  if (secret && auth !== `Bearer ${secret}` && keyParam !== secret) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "no_resend_key" });

  let leads = [];
  try {
    const { rows } = await sql`
      SELECT email, name FROM leads
      WHERE source = 'ki'
        AND COALESCE(followup_sent, false) = false
        AND ts < now() - interval '1 day'
      ORDER BY id ASC
      LIMIT 100`;
    leads = rows;
  } catch (e) {
    return res.status(500).json({ error: "db", detail: String(e.message || e) });
  }

  let sent = 0;
  for (const l of leads) {
    try {
      const ok = await sendMail(l.email, l.name);
      if (ok) {
        await sql`UPDATE leads SET followup_sent = true WHERE email = ${l.email}`;
        sent++;
      }
    } catch (e) { /* einzelne Mail darf den Lauf nicht abbrechen */ }
  }
  res.json({ ok: true, candidates: leads.length, sent });
}

import { sql } from "@vercel/postgres";

const BASE = "https://inner-goat-track.vercel.app";
const FROM = "Inner GOAT <info@inner-goat.com>";

// HTML-Escaping, damit ein Name nie Markup in die Mail einschleusen kann.
function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function hi(name) { const n = (name || "").trim(); return n ? `Hey ${esc(n)},` : "Hey,"; }

// ── Kampagnen-Konfiguration ─────────────────────────────────────────
// Pro Quelle (source) ein Lead-Magnet: PDF + Mail-Text. Neue Kampagne =
// einfach neuen Eintrag ergänzen.
const CAMPAIGNS = {
  // Sticker / Website "Ideenliste"
  ideen: {
    pdf: `${BASE}/goat-ideen-priorisierung.pdf`,
    filename: "GOAT_Ideen-Priorisierung.pdf",
    subject: "Deine GOAT Ideen-Priorisierung 🐐",
    title: "Deine Ideen-Priorisierung ist da.",
    body: (name) => `
      <p>${hi(name)}</p>
      <p>deine Ideenliste ist unendlich – deine Zeit nicht. Hier ist die <b>1-Seiten-Matrix</b>,
         mit der du in 5 Minuten weißt, welche Idee zuerst dran ist:</p>`,
    cta: { label: "📄 GOAT Ideen-Priorisierung öffnen", url: `${BASE}/goat-ideen-priorisierung.pdf` },
    outro: `<p>Und wenn du aus Ideen <b>Ergebnisse</b> machen willst: Genau dafür sind die
            <a href="https://inner-goat.com/storytelling-app/" style="color:#FF5F00;font-weight:700">Storytelling Cards</a>.</p>`
  },
  // Instagram "Hör auf, teure App-Abos zu zahlen" → KI-App-Bauplan
  ki: {
    pdf: `${BASE}/goat-ki-bauplan.pdf`,
    filename: "GOAT_KI-App-Bauplan.pdf",
    subject: "Dein GOAT KI-App-Bauplan 🐐",
    title: "Dein KI-App-Bauplan ist da.",
    body: (name) => `
      <p>${hi(name)}</p>
      <p>du willst eigene Apps &amp; Tools mit KI bauen – statt jeden Monat für teure Abos zu zahlen?
         Hier ist das <b>Schritt-für-Schritt-Rezept</b>, mit dem du deine erste eigene Web-Seite baust
         und live schaltest – 5 Seiten, zum direkten Nachbauen:</p>`,
    cta: { label: "📄 GOAT KI-App-Bauplan öffnen", url: `${BASE}/goat-ki-bauplan.pdf` },
    outro: `<p>Schau in Ruhe rein. Wenn du danach Lust hast, deine erste eigene App wirklich zu bauen,
            findest du den ganzen Weg in der <a href="https://inner-goat.com/inner-goat-academy/" style="color:#FF5F00;font-weight:700">Inner GOAT Academy</a> –
            oder antworte einfach auf diese Mail.</p>`
  },
  // Instagram "Die 25 Claude Skills, die dein Marketing-Team ersetzen"
  skills: {
    pdf: `${BASE}/goat-claude-skills.pdf`,
    filename: "GOAT_Claude-Skills.pdf",
    subject: "Deine 25 Claude Skills 🐐",
    title: "Deine 25 Claude Skills sind da.",
    body: (name) => `
      <p>${hi(name)}</p>
      <p>du willst Marketing-Arbeit an Claude abgeben – statt alles selbst zu machen?
         Hier sind die <b>25 Skills, die dein Marketing-Team ersetzen</b> – plus die
         Schritt-für-Schritt-Anleitung, wie du sie in Cowork einsetzt und eigene baust (6 Seiten):</p>`,
    cta: { label: "📄 Die 25 Claude Skills öffnen", url: `${BASE}/goat-claude-skills.pdf` },
    outro: `<p>Mein Tipp: Nimm dir nicht alle 25 auf einmal vor – sondern die 3, die dir am meisten Zeit fressen.
            Wenn du dir dein eigenes Skill-Team bauen willst, zeig ich dir alles in der
            <a href="https://inner-goat.com/inner-goat-academy/" style="color:#FF5F00;font-weight:700">Inner GOAT Academy</a> –
            oder antworte einfach auf diese Mail.</p>`
  }
};

function emailHtml(c, name) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0E0E0E">
    <div style="background:#FF5F00;padding:22px 24px;border-radius:14px 14px 0 0">
      <div style="font-weight:800;font-size:14px">INNER GOAT 🐐</div>
      <div style="font-weight:800;font-size:22px;margin-top:4px">${c.title}</div>
    </div>
    <div style="padding:24px;background:#fafafa;border-radius:0 0 14px 14px">
      ${c.body(name)}
      <p style="text-align:center;margin:26px 0">
        <a href="${c.cta.url}" style="background:#FF5F00;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:12px;display:inline-block">
          ${c.cta.label}</a>
      </p>
      ${c.outro}
      <p style="margin-top:24px">Trust your goat,<br><b>Marco · Inner GOAT</b></p>
      <p style="font-size:12px;color:#888;margin-top:20px">inner-goat.com · from founders to founders</p>
    </div>
  </div>`;
}

// Schickt die Lead-Magnet-Mail über Resend. Nur aktiv, wenn RESEND_API_KEY gesetzt ist.
async function sendMail(to, c, name) {
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: "no_key" };
  let attachments;
  try {
    const buf = Buffer.from(await (await fetch(c.pdf)).arrayBuffer());
    attachments = [{ filename: c.filename, content: buf.toString("base64") }];
  } catch { /* Anhang optional – Link ist im Mailtext */ }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [to], reply_to: "info@inner-goat.com",
      subject: c.subject, html: emailHtml(c, name), attachments
    })
  });
  return { sent: r.ok, status: r.status };
}

// POST /api/lead  {email, name, source, answer}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const { email, name, source, answer } = req.body || {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }
  const mail = email.toLowerCase().slice(0, 200);
  const nm = (name || "").trim().slice(0, 80);
  const src = (source || "ideen").slice(0, 40);
  const campaign = CAMPAIGNS[src] || CAMPAIGNS.ideen;
  try {
    await sql`INSERT INTO leads (email, name, source, answer, ts)
              VALUES (${mail}, ${nm}, ${src}, ${answer || ""}, now())
              ON CONFLICT (email) DO UPDATE SET
                name = COALESCE(NULLIF(EXCLUDED.name,''), leads.name),
                source = EXCLUDED.source, answer = EXCLUDED.answer`;
  } catch (e) {
    return res.status(500).json({ error: "db" });
  }
  let mailResult = { sent: false };
  try { mailResult = await sendMail(mail, campaign, nm); } catch (e) { /* Lead ist gespeichert, Mail nicht blockierend */ }
  res.json({ ok: true, mailed: mailResult.sent });
}

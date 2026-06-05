import { sql } from "@vercel/postgres";

const PDF_URL = "https://inner-goat-track.vercel.app/goat-ideen-priorisierung.pdf";
const FROM = "Inner GOAT <info@inner-goat.com>";

function emailHtml() {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0E0E0E">
    <div style="background:#FF5F00;padding:22px 24px;border-radius:14px 14px 0 0">
      <div style="font-weight:800;font-size:14px">INNER GOAT 🐐</div>
      <div style="font-weight:800;font-size:22px;margin-top:4px">Deine Ideen-Priorisierung ist da.</div>
    </div>
    <div style="padding:24px;background:#fafafa;border-radius:0 0 14px 14px">
      <p>Hey,</p>
      <p>deine Ideenliste ist unendlich – deine Zeit nicht. Hier ist die <b>1-Seiten-Matrix</b>,
         mit der du in 5 Minuten weißt, welche Idee zuerst dran ist:</p>
      <p style="text-align:center;margin:26px 0">
        <a href="${PDF_URL}" style="background:#FF5F00;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:12px;display:inline-block">
          📄 GOAT Ideen-Priorisierung öffnen</a>
      </p>
      <p>Und wenn du aus Ideen <b>Ergebnisse</b> machen willst: Genau dafür sind die
         <a href="https://inner-goat.com/storytelling-app/" style="color:#FF5F00;font-weight:700">Storytelling Cards</a>.</p>
      <p style="margin-top:24px">Trust your goat,<br><b>Marco · Inner GOAT</b></p>
      <p style="font-size:12px;color:#888;margin-top:20px">inner-goat.com · from founders to founders</p>
    </div>
  </div>`;
}

// Schickt die Lead-Magnet-Mail über Resend. Nur aktiv, wenn RESEND_API_KEY gesetzt ist.
async function sendMail(to) {
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: "no_key" };
  let attachments;
  try {
    const buf = Buffer.from(await (await fetch(PDF_URL)).arrayBuffer());
    attachments = [{ filename: "GOAT_Ideen-Priorisierung.pdf", content: buf.toString("base64") }];
  } catch { /* Anhang optional – Link ist im Mailtext */ }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [to], reply_to: "info@inner-goat.com",
      subject: "Deine GOAT Ideen-Priorisierung 🐐",
      html: emailHtml(), attachments
    })
  });
  return { sent: r.ok, status: r.status };
}

// POST /api/lead  {email, source, answer}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const { email, source, answer } = req.body || {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }
  const mail = email.toLowerCase().slice(0, 200);
  try {
    await sql`INSERT INTO leads (email, source, answer, ts)
              VALUES (${mail}, ${source || "ideen"}, ${answer || ""}, now())
              ON CONFLICT (email) DO UPDATE SET source=EXCLUDED.source, answer=EXCLUDED.answer`;
  } catch (e) {
    return res.status(500).json({ error: "db" });
  }
  let mailResult = { sent: false };
  try { mailResult = await sendMail(mail); } catch (e) { /* Lead ist gespeichert, Mail nicht blockierend */ }
  res.json({ ok: true, mailed: mailResult.sent });
}

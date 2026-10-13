import { sql } from "@vercel/postgres";
import { evaluate } from "./_beamtencheck.js";

const BASE = "https://inner-goat-track.vercel.app";
const FROM = "Inner GOAT <info@inner-goat.com>";
// Standard-Antwortadresse. Beim Umzug des Beamten-Checks auf Lucas nur die
// replyTo/from-Zeile in der Kampagne "beamtencheck" tauschen.
const REPLY_TO = "info@inner-goat.com";

// Kampagnenfelder dürfen Funktionen sein: f(name, ctx). ctx ist bei
// beamtencheck das Auswertungsobjekt aus evaluate().
const val = (v, name, ctx) => (typeof v === "function" ? v(name, ctx) : v);

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
         Hier sind die <b>25 Skills, die dein Marketing-Team ersetzen</b> – jeder mit
         fertigem Prompt zum direkten Kopieren (12 Seiten, 7 Kategorien):</p>`,
    cta: { label: "📄 Die 25 Claude Skills öffnen", url: `${BASE}/goat-claude-skills.pdf` },
    outro: `<p>Mein Tipp: Nimm dir nicht alle 25 auf einmal vor – sondern die 3, die dir am meisten Zeit fressen.
            Wenn du dir dein eigenes Skill-Team bauen willst, zeig ich dir alles in der
            <a href="https://inner-goat.com/inner-goat-academy/" style="color:#FF5F00;font-weight:700">Inner GOAT Academy</a> –
            oder antworte einfach auf diese Mail.</p>`
  },
  // Instagram/LinkedIn "Nie wieder nur von Empfehlungen leben" → Empfehlungs-Skript
  empfehlung: {
    pdf: `${BASE}/goat-empfehlungs-skript.pdf`,
    filename: "GOAT_Empfehlungs-Skript.pdf",
    subject: "Dein Empfehlungs-Skript ist da 🐐",
    title: "Dein Empfehlungs-Skript ist da.",
    body: (name) => `
      <p>${hi(name)}</p>
      <p>du willst Kunden, die <b>von selbst</b> kommen – ohne Kaltakquise und ohne auf Zufalls-Empfehlungen zu warten?
         Hier ist das Skript: die exakten Fragen, Vorlagen &amp; dein Erinnerungs-Rhythmus, mit denen aus Zufall ein System wird:</p>`,
    cta: { label: "📄 Empfehlungs-Skript öffnen", url: `${BASE}/goat-empfehlungs-skript.pdf` },
    outro: `<p>Mein Tipp: Lies <b>Seite 3</b> zuerst – die „Von 1 bis 10"-Frage änderst du heute noch.
            Und wenn du den ganzen Weg willst (deine Story, Personal Branding, Sales), zeig ich ihn dir in der
            <a href="https://inner-goat.com/inner-goat-academy/" style="color:#FF5F00;font-weight:700">Inner GOAT Academy</a> –
            oder antworte einfach auf diese Mail.</p>`
  },
  // Sticker "Dein bestes Argument bist du" → kostenloses Beratungsgespräch (kein PDF)
  beratung: {
    subject: "Deine Gratis-Beratung bei Inner GOAT 🐐",
    title: "Deine Gratis-Beratung ist reserviert.",
    body: (name) => `
      <p>${hi(name)}</p>
      <p>stark, dass du dein bestes Argument schärfen willst. <b>Nel &amp; ich melden uns
         innerhalb von 24 Stunden</b> bei dir, um einen Termin auszumachen.</p>
      <p><b>Kurz zur Einordnung:</b> Wir haben zusammen <b>11+ Jahre Erfahrung</b> in Storytelling,
         Sales &amp; Personal Branding. Normalerweise kostet so ein Gespräch richtig Geld —
         aber weil wir junge Gründer*innen unterstützen wollen, machen wir das <b>kostenlos</b>.
         Und ganz wichtig: Wir <b>verkaufen dir nichts</b>. Es geht nur um dich und dein Argument.</p>`,
    cta: { label: "🐐 Inner GOAT Academy ansehen", url: "https://inner-goat.com/inner-goat-academy/" },
    outro: `<p>Bis gleich — ich freu mich auf dich.</p>`
  },
  // Sticker/Funnel "GOAT Skill" → 3 Claude-Skill-Dateien (kostenlos)
  goatskill: {
    files: [
      { url: `${BASE}/goat-storytelling.zip`, filename: "goat-storytelling.zip" },
      { url: `${BASE}/goat-sales.zip`,        filename: "goat-sales.zip" },
      { url: `${BASE}/goat-mentor.zip`,       filename: "goat-mentor.zip" }
    ],
    subject: "Deine 3 GOAT Skills für Claude 🐐",
    title: "Deine 3 GOAT Skills sind da.",
    body: (name) => `
      <p>${hi(name)}</p>
      <p>hier sind deine <b>3 GOAT Skills für Claude</b> — im Anhang als fertige Skill-Dateien:</p>
      <ul style="line-height:1.7">
        <li><b>GOAT Storytelling</b> — deine Founder-Story, die verkauft (nach „Art of Breaking Yourself")</li>
        <li><b>GOAT Sales</b> — verkaufen mit Haltung statt Druck</li>
        <li><b>GOAT Mentor</b> — dein Sparringspartner für Gründer-Entscheidungen</li>
      </ul>
      <p><b>So installierst du sie</b> (30 Sek.): ZIP entpacken → den Skill-Ordner in Claude hochladen
         (claude.ai → <i>Settings → Capabilities → Skills</i>) oder in <code>~/.claude/skills/</code> legen.
         Dann sag Claude einfach: „nutze GOAT Storytelling".</p>`,
    cta: { label: "🐐 Mehr in der Inner GOAT Academy", url: "https://inner-goat.com/inner-goat-academy/" },
    outro: `<p>Komplett kostenlos — wir wollen sehen, ob's dir hilft. Wenn ja, sag uns Bescheid (einfach auf diese Mail antworten). Trust your goat.</p>`
  },
  // Newsletter-Landingpage (go.inner-goat.com/newsletter) — Willkommensmail, KEIN PDF
  newsletter: {
    subject: "Willkommen beim Inner GOAT Briefing 🐐",
    title: "Willkommen beim Inner GOAT Briefing.",
    body: (name) => `
      <p>${hi(name)}</p>
      <p>schön, dass du dabei bist. Ab jetzt bekommst du das <b>Inner GOAT Briefing</b>, alle ein bis zwei Wochen einen echten Gedanken zu
         Storytelling, Sales, Mindset &amp; Personal Branding. Jede Ausgabe mit einer Sache, die du
         sofort anwenden kannst, plus dem passenden Blogartikel und einer Podcastfolge.</p>
      <p>Im ersten Monat hörst du wöchentlich von uns, danach alle zwei Wochen. Die erste richtige
         Ausgabe ist schon unterwegs.</p>`,
    cta: { label: "🐐 Mehr über Inner GOAT", url: "https://inner-goat.com/" },
    outro: `<p>Wenn dir etwas fehlt oder du eine Frage hast, antworte einfach auf diese Mail.<br>Trust your goat. Marco &amp; Nel</p>`
  },

  // ── Beamten-Check (go.inner-goat.com/beamten-check) ───────────────
  // Personalisierte Auswertung statt PDF. Eigenes Branding und eigene
  // Antwortadresse, weil die Zielgruppe (Referendare / junge Beamte) mit
  // "Inner GOAT / from founders to founders" nichts anfangen kann.
  // skipFlows: Diese Leads gehören NICHT in den Founder-Newsletter.
  beamtencheck: {
    skipFlows: true,
    from: "Beamten-Check <info@inner-goat.com>",
    replyTo: REPLY_TO,
    brand: "BEAMTEN-CHECK",
    signature: "Viele Grüße,<br><b>Marco Maiworm</b>",
    footer: "Beamten-Check · ein Projekt der Mailenstein GbR · Orientierung, keine Beratung",
    subject: (name, r) => r
      ? `Deine Auswertung: ${r.gruen} von 5 Bereichen sind bei dir sauber`
      : "Deine Auswertung ist da",
    title: (name, r) => (r ? r.headline : "Deine Auswertung"),
    cta: { label: "✉️ Antworten und 15 Minuten ausmachen", url: "mailto:info@inner-goat.com?subject=Mein%20Beamten-Check" },
    body: (name, r) => {
      if (!r) return `<p>${hi(name)}</p><p>deine Auswertung konnte nicht berechnet werden. Antworte kurz auf diese Mail, dann schicke ich sie dir von Hand.</p>`;
      const AMPEL = { gruen: "🟢", gelb: "🟡", rot: "🔴" };
      const RAND  = { gruen: "#1FA463", gelb: "#E8A400", rot: "#E5484D" };
      const bloecke = r.bloecke.map(b => `
        <div style="border-left:4px solid ${RAND[b.level]};background:#fff;border-radius:0 10px 10px 0;padding:15px 17px;margin:0 0 12px">
          <div style="font-weight:800;font-size:15px">${AMPEL[b.level]} ${b.titel}</div>
          <div style="font-size:14px;color:#555;margin-top:3px">${b.kurz}</div>
          <div style="font-size:14px;line-height:1.65;margin-top:11px">${b.lang}</div>
        </div>`).join("");
      const nicht = r.nichtNoetig.map(t => `<li style="margin-bottom:7px">${t}</li>`).join("");
      return `
      <p>${hi(name)}</p>
      <p>hier ist deine Auswertung. Du bist ${r.statusLabel}${r.bundesland ? " in " + r.bundesland : ""},
         und in <b>${r.gruen} von 5 Bereichen</b> sieht es bei dir sauber aus.</p>
      ${bloecke}
      <div style="background:#0E0E0E;color:#fff;border-radius:12px;padding:19px;margin:24px 0">
        <div style="color:#FF5F00;font-weight:800;font-size:12px;letter-spacing:.6px">DAS EINE FÜR DIE NÄCHSTEN 14 TAGE</div>
        <div style="font-weight:800;font-size:17px;margin-top:7px">${r.naechsterSchritt.titel}</div>
        <div style="font-size:14px;line-height:1.65;margin-top:9px;opacity:.9">${r.naechsterSchritt.text}</div>
      </div>
      <div style="background:#fff;border:1px solid #e6e6e6;border-radius:12px;padding:17px;margin:0 0 6px">
        <div style="font-weight:800;font-size:15px;margin-bottom:9px">Und was du gerade nicht brauchst</div>
        <ul style="font-size:14px;line-height:1.6;margin:0;padding-left:19px;color:#333">${nicht}</ul>
      </div>
      <p style="font-size:15px;line-height:1.65;margin-top:22px">Wenn du magst, schaue ich mit dir 15 Minuten drüber.
         Kostenlos, ich verkaufe dir nichts, und wenn bei dir alles passt, sage ich dir das genauso.
         <b>Antworte einfach auf diese Mail</b>, ein Wort reicht.</p>`;
    },
    outro: (name, r) => `
      <p style="font-size:13px;line-height:1.6;color:#666;background:#f0f0f0;border-radius:10px;padding:14px">
        <b>Zur Einordnung:</b> Das ist ein Orientierungs-Check auf Basis deiner sechs Antworten, keine
        Versicherungs- oder Anlageberatung und keine Empfehlung für ein bestimmtes Produkt. Rechtsgrundlagen:
        § 14 und § 12 BeamtVG (Ruhegehaltssatz und Anrechnung von Ausbildungszeiten), die Beihilfeverordnungen
        des Bundes und der Länder. Für deinen Einzelfall gilt immer, was dein Dienstherr und deine Verträge sagen.
      </p>`
  }
};

function emailHtml(c, name, ctx) {
  const cta = val(c.cta, name, ctx);
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0E0E0E">
    <div style="background:#FF5F00;padding:22px 24px;border-radius:14px 14px 0 0">
      <div style="font-weight:800;font-size:14px">${c.brand || "INNER GOAT 🐐"}</div>
      <div style="font-weight:800;font-size:22px;margin-top:4px">${val(c.title, name, ctx)}</div>
    </div>
    <div style="padding:24px;background:#fafafa;border-radius:0 0 14px 14px">
      ${c.body(name, ctx)}
      ${cta ? `<p style="text-align:center;margin:26px 0">
        <a href="${cta.url}" style="background:#FF5F00;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:12px;display:inline-block">
          ${cta.label}</a>
      </p>` : ""}
      ${val(c.outro, name, ctx)}
      <p style="margin-top:24px">${c.signature || "Trust your goat,<br><b>Marco · Inner GOAT</b>"}</p>
      <p style="font-size:12px;color:#888;margin-top:20px">${c.footer || "inner-goat.com · from founders to founders"}</p>
    </div>
  </div>`;
}

// Schickt die Lead-Magnet-Mail über Resend. Nur aktiv, wenn RESEND_API_KEY gesetzt ist.
async function sendMail(to, c, name, ctx) {
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: "no_key" };
  // Anhänge: entweder mehrere (c.files) oder ein einzelnes PDF (c.pdf).
  const wanted = c.files || (c.pdf ? [{ url: c.pdf, filename: c.filename }] : []);
  let attachments = [];
  for (const f of wanted) {
    try {
      const buf = Buffer.from(await (await fetch(f.url)).arrayBuffer());
      attachments.push({ filename: f.filename, content: buf.toString("base64") });
    } catch { /* Anhang optional – Link ist im Mailtext */ }
  }
  if (!attachments.length) attachments = undefined;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: c.from || FROM, to: [to], reply_to: c.replyTo || REPLY_TO,
      subject: val(c.subject, name, ctx), html: emailHtml(c, name, ctx), attachments
    })
  });
  return { sent: r.ok, status: r.status };
}

// POST /api/lead  {email, name, source, answer}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  // noMail=true: Der Lead kommt aus einer Strecke, die ihre eigene Double-Opt-In-Mail
  // verschickt (Newsletter). Dann NUR speichern, keine Mail und kein Flows-Enrollment,
  // denn eingeschrieben wird erst nach bestätigter Einwilligung.
  const { email, name, lastName, source, answer, noMail } = req.body || {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }
  const mail = email.toLowerCase().slice(0, 200);
  const nm = (name || "").trim().slice(0, 80);                 // Vorname → Begrüßung + Flows-firstName
  const lastNm = (lastName || "").trim().slice(0, 80);
  const fullName = (nm + (lastNm ? " " + lastNm : "")).trim(); // Vor- + Nachname → im Lead gespeichert
  const src = (source || "ideen").slice(0, 40);
  const campaign = CAMPAIGNS[src] || CAMPAIGNS.ideen;

  // Antworten kommen als JSON-String (Beamten-Check) oder als Freitext (alle anderen).
  const answerStr = (typeof answer === "string" ? answer : JSON.stringify(answer || "")).slice(0, 4000);

  // Auswertung für den Beamten-Check: einmal berechnen, für Mail UND Ergebnisseite.
  let ctx = null;
  if (src === "beamtencheck") {
    let ans = {};
    try { ans = typeof answer === "string" ? JSON.parse(answer) : (answer || {}); } catch { ans = {}; }
    ctx = evaluate(ans);
  }
  try {
    await sql`INSERT INTO leads (email, name, source, answer, ts)
              VALUES (${mail}, ${fullName}, ${src}, ${answerStr}, now())
              ON CONFLICT (email) DO UPDATE SET
                name = COALESCE(NULLIF(EXCLUDED.name,''), leads.name),
                source = EXCLUDED.source, answer = EXCLUDED.answer`;
  } catch (e) {
    return res.status(500).json({ error: "db" });
  }

  // Lead an GOAT Flow weiterreichen (Kontakt + Liste + Sequenz-Enrollment).
  // Fire-and-forget: darf das Lead-Speichern + die PDF-Mail NIE blockieren.
  try {
    if (!noMail && !campaign.skipFlows && process.env.GOATFLOW_INGEST_URL && process.env.INGEST_API_KEY) {
      fetch(process.env.GOATFLOW_INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.INGEST_API_KEY}` },
        body: JSON.stringify({ email: mail, name: nm, campaign: src }),
      }).catch(() => {});
    }
  } catch { /* ignore */ }

  let mailResult = { sent: false };
  if (!noMail) {
    try { mailResult = await sendMail(mail, campaign, nm, ctx); } catch (e) { /* Lead ist gespeichert, Mail nicht blockierend */ }
  }
  res.json({ ok: true, mailed: mailResult.sent, result: ctx });
}

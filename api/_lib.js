// Inner GOAT Tracker — shared helpers
import crypto from "node:crypto";

// Link-/QR-Vorschauen & Crawler erzeugen Fake-Scans (WhatsApp, iMessage/Applebot,
// Slack, Telegram, Discord, FB, LinkedIn, Bots …). Solche Requests werden
// weitergeleitet, aber mit is_bot=true markiert und NICHT als echter Scan gezählt.
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|facebot|whatsapp|slackbot|slack-imgproxy|telegram|discordbot|twitterbot|linkedinbot|embedly|quora link preview|pinterest|redditbot|applebot|skypeuripreview|bingbot|googlebot|baiduspider|yandex|duckduckbot|curl|wget|python-requests|go-http-client|libwww-perl|headless|phantomjs|axios|okhttp/i;
export function isBot(ua = "") { return BOT_RE.test(ua); }

export function clientIp(req) {
  const xff = req.headers["x-forwarded-for"] || "";
  return (xff.split(",")[0] || req.headers["x-real-ip"] || "").trim();
}

// Datenschutzfreundlicher Dedupe-Token: sha256(IP + UA + Tag), gekürzt.
// Es wird KEINE Klartext-IP gespeichert — nur dieser Hash, der pro Person/Tag
// gleich bleibt → erlaubt "unique scans" ohne personenbezogene Daten.
export function visitHash(req) {
  const ip = clientIp(req);
  const ua = req.headers["user-agent"] || "";
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash("sha256").update(`${ip}|${ua}|${day}`).digest("hex").slice(0, 32);
}

export function parseUA(ua = "") {
  const u = ua.toLowerCase();
  let device = "Desktop";
  if (/ipad|tablet|playbook|silk/.test(u) || (/android/.test(u) && !/mobile/.test(u))) device = "Tablet";
  else if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(u)) device = "Mobile";
  let os = "Andere";
  if (/iphone|ipad|ipod/.test(u)) os = "iOS";
  else if (/android/.test(u)) os = "Android";
  else if (/windows/.test(u)) os = "Windows";
  else if (/mac os x|macintosh/.test(u)) os = "macOS";
  else if (/linux/.test(u)) os = "Linux";
  let browser = "Andere";
  if (/edg\//.test(u)) browser = "Edge";
  else if (/opr\/|opera/.test(u)) browser = "Opera";
  else if (/(chrome|crios)/.test(u) && !/edg\//.test(u)) browser = "Chrome";
  else if (/(firefox|fxios)/.test(u)) browser = "Firefox";
  else if (/safari/.test(u) && !/(chrome|crios)/.test(u)) browser = "Safari";
  return { device, os, browser };
}

export function geo(req) {
  const h = req.headers;
  const dec = (v) => { try { return decodeURIComponent(v || ""); } catch { return v || ""; } };
  return {
    country: h["x-vercel-ip-country"] || "",
    city: dec(h["x-vercel-ip-city"]) || "",
    region: h["x-vercel-ip-country-region"] || ""
  };
}

// Simple shared-password auth via ?key=  (set ADMIN_PASSWORD in Vercel env)
// Timing-safe Vergleich, damit das Passwort nicht über Laufzeitunterschiede erratbar ist.
export function auth(req, res) {
  const key = (req.query && req.query.key) || "";
  const pw = process.env.ADMIN_PASSWORD || "";
  let ok = false;
  if (pw.length > 0 && key.length === pw.length) {
    ok = crypto.timingSafeEqual(Buffer.from(key), Buffer.from(pw));
  }
  if (!ok) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

// Zentrale Ziel-URLs pro CTA (an einer Stelle ändern wirkt überall)
const CARDS = "https://inner-goat.com/storytelling-app/";
const WEB   = "https://inner-goat.com/";
const ACAD  = "https://inner-goat.com/inner-goat-academy/";
const YT    = "https://www.youtube.com/watch?v=J9Ljgx-6I2o";
const IDEEN = "https://inner-goat-track.vercel.app/ideen"; // Klickpfad-Funnel (Sticker "Ideenliste")
const KI    = "https://inner-goat-track.vercel.app/ki";     // Klickpfad-Funnel (Instagram "KI-App-Bauplan")
const SKILLS= "https://inner-goat-track.vercel.app/skills"; // Klickpfad-Funnel (Instagram "25 Claude Skills")
const EMPF  = "https://inner-goat-track.vercel.app/empfehlung"; // Funnel "Nie wieder nur von Empfehlungen leben"
const BERAT = "https://inner-goat-track.vercel.app/beratung";   // Sticker "Dein bestes Argument bist du" → Gratis-Beratung
const PODCAST = "https://inner-goat-track.vercel.app/podcast";  // Sticker "Du redest, keiner hört dir zu" → Podcast + WhatsApp-Community
const RITTER= "https://storybuilder-cards.vercel.app/quiz?source=ritter"; // Ritter-Persönlichkeitstest (Storybuilder-Quiz)

// Spalten: [id, name, cta, destination, typ, kampagne]
//   typ      = "sticker" | "kampagne"  (für die Trennung im Dashboard)
//   kampagne = Lead-Quelle (source), die dieser Link/Sticker speist (sonst null).
//              Ein Sticker kann gleichzeitig eine Kampagne speisen (z.B. Ideenliste).
export const SEED = [
  // ── Sticker (SuperReturn-Kampagne) ──────────────────────────────
  ["cards-zuhoeren",   "Du redest. Keiner hört dir zu",             "Podcast",            PODCAST,"sticker",  null],
  ["yt-podcast",       "GOAT Mode ON · Podcast",                    "YouTube",            YT,     "sticker",  null],
  ["web-argument",     "Dein bestes Argument bist du",              "Beratung",           BERAT,  "sticker",  "beratung"],
  ["academy-netzwerk", "Netzwerkst du noch oder verdienst du schon","Academy",            ACAD,   "sticker",  null],
  ["web-ideenliste",   "Deine Ideenliste ist unendlich",            "Website",            IDEEN,  "sticker",  "ideen"],  // Sticker UND Kampagne
  // ── Kampagnen (Instagram-Funnels, sammeln E-Mails) ──────────────
  ["ig-ki",            "Hör auf, teure App-Abos zu zahlen",         "KI-Funnel",          KI,     "kampagne", "ki"],
  ["ig-skills",        "25 Claude Skills, die dein Team ersetzen",  "Skills-Funnel",      SKILLS, "kampagne", "skills"],
  ["ig-empfehlung",    "Nie wieder nur von Empfehlungen leben",     "Empfehlungs-Funnel", EMPF,   "kampagne", "empfehlung"],
  // ── Branded Redirects (digital) ─────────────────────────────────
  // Ritter-Test = Kampagne (taucht im Dashboard auf). Leads werden im
  // Storybuilder-Quiz selbst gesammelt, nicht hier → E-Mails-Spalte bleibt 0.
  ["ritter",           "Welcher Gründer-Typ bist du? (Ritter-Test)","Quiz",               RITTER, "kampagne", "ritter"],
];

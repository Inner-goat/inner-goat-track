import { sql } from "@vercel/postgres";
import { parseUA, geo, isBot, visitHash, DEST_OVERRIDES } from "../_lib.js";

function redirect(res, dest) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  if (typeof res.redirect === "function") res.redirect(302, dest);
  else { res.writeHead(302, { Location: dest }); res.end(); }
}

// Zwischenseite: fragt GPS, schickt es ans /api/geo, leitet dann weiter.
// Leitet IMMER weiter — bei Ablehnung, Timeout oder Klick auf "Weiter ohne Standort".
function interstitial(scanId, dest) {
  const destJson = JSON.stringify(dest);
  const destAttr = dest.replace(/"/g, "%22");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5;url=${destAttr}">
<title>Inner GOAT</title>
<style>
  html,body{height:100%;margin:0}
  body{background:#FF5F00;color:#0E0E0E;font-family:Poppins,Arial,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center}
  .b{max-width:340px;padding:24px}
  .g{width:64px;height:64px;margin:0 auto 18px;animation:p 1.1s ease-in-out infinite}
  @keyframes p{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.82);opacity:.6}}
  h1{font-size:22px;margin:0 0 6px}
  p{font-size:14px;opacity:.8;margin:0 0 18px}
  a{color:#0E0E0E;font-weight:700;font-size:13px;text-decoration:underline;cursor:pointer}
</style></head>
<body><div class="b">
  <svg class="g" viewBox="0 0 215 183" xmlns="http://www.w3.org/2000/svg"><g fill="#0E0E0E">
    <path d="M159.5,182.9h-49.5c0-28.7,3.3-58.4,27-81.2,23.4-22.5,53.7-25.6,83-25.6v49.5c-30.4,0-41.1,4.5-48.7,11.7-7.3,7-11.8,17.1-11.8,45.5Z"/>
    <path d="M110,182.9h-49.5c0-28.5-4.5-38.5-11.8-45.5-7.5-7.2-18.3-11.7-48.7-11.7v-49.5c29.3,0,59.7,3.1,83,25.6,23.7,22.8,27,52.5,27,81.2Z"/>
    <path d="M110,87.9c-42.5,0-73.8-25.4-101.3-52.9L43.8,0c28,28,45.9,38.4,66.3,38.4S148.3,28,176.3,0l35,35c-18,18-32.6,29.8-47.3,38.1-17.5,9.9-35.2,14.8-54,14.8Z"/>
  </g></svg>
  <h1>Einen Moment… 🐐</h1>
  <p>Du wirst gleich weitergeleitet.</p>
  <a onclick="go()">Weiter ohne Standort →</a>
</div>
<script>
  var DEST=${destJson}, SID=${scanId}, done=false;
  function go(){ if(done)return; done=true; location.replace(DEST); }
  function send(p){
    try{
      fetch('/api/geo',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
        body:JSON.stringify({sid:SID,lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy})}).finally(go);
    }catch(e){ go(); }
  }
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      function(p){ send(p); },
      function(){ go(); },
      {enableHighAccuracy:true, timeout:4000, maximumAge:0}
    );
    setTimeout(go, 4500); // Sicherheits-Fallback
  } else { go(); }
</script>
</body></html>`;
}

// GET /r/:id  → Scan loggen, dann (Mensch) Zwischenseite mit GPS oder (Bot) sofort 302
export default async function handler(req, res) {
  const id = req.query.id;
  let dest = "https://www.inner-goat.com";
  let destType = "sticker";
  let scanId = null;
  const ua = req.headers["user-agent"] || "";
  const bot = isBot(ua);
  try {
    const { rows } = await sql`SELECT destination, type FROM links WHERE id=${id}`;
    if (rows[0] && rows[0].destination) dest = rows[0].destination;
    if (rows[0] && rows[0].type) destType = rows[0].type;
    // Code-Override schlägt den DB-Wert (falls setup noch nicht neu lief).
    if (DEST_OVERRIDES && DEST_OVERRIDES[id]) dest = DEST_OVERRIDES[id];
    const d = parseUA(ua);
    const g = geo(req);
    const ins = await sql`
      INSERT INTO scans (link_id, ts, country, city, region, device, os, browser, lang, referer, ua, is_bot, visit_hash)
      VALUES (${id}, now(), ${g.country}, ${g.city}, ${g.region},
              ${d.device}, ${d.os}, ${d.browser},
              ${(req.headers["accept-language"] || "").split(",")[0]},
              ${req.headers["referer"] || ""}, ${ua.slice(0, 300)},
              ${bot}, ${visitHash(req)})
      RETURNING id`;
    scanId = ins.rows[0] && ins.rows[0].id;
  } catch (e) {
    // Logging darf den Redirect nie blockieren
  }
  // Funnel-Links (Instagram/TikTok "ig-…" oder interne Funnel-Ziele) bekommen
  // KEINE GPS-Zwischenseite: die Standort-Abfrage hängt in In-App-Browsern
  // (IG/TikTok) und blockiert die Weiterleitung. Sofort sauber 302 → öffnet
  // zuverlässig. Der Scan ist oben bereits geloggt (Tracking bleibt erhalten).
  const funnelLink = (id && /^ig-/.test(id)) || /inner-goat-track\.vercel\.app|go\.inner-goat\.com/.test(dest);
  // Bei Funnel-Links host-RELATIV weiterleiten (nur Pfad), damit der Besucher auf
  // der Domain bleibt, über die er kam (z.B. go.inner-goat.com) — sonst springt er
  // zurück auf .vercel.app, das TikTok blockt.
  let target = dest;
  if (funnelLink) { try { const u = new URL(dest); target = u.pathname + u.search; } catch (e) { /* dest war schon relativ */ } }
  // GPS-Zwischenseite NUR für physische Sticker (type='sticker'). Alle digitalen
  // Links (Kampagnen, Quiz/Ritter-Test …) leiten sofort sauber weiter — die
  // GPS-Abfrage hängt in In-App-Browsern und bringt bei digitalem Traffic nichts.
  if (bot || !scanId || funnelLink || destType !== "sticker") return redirect(res, target);
  // Physische Sticker (Menschen): Zwischenseite mit GPS-Abfrage (leitet immer weiter).
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(interstitial(scanId, dest));
}

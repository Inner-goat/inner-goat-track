# 🐐 Inner GOAT Tracker — auf Vercel deployen (~5 Min)

Eigene Tracking-App. Erfasst pro Scan: **Zeit · Sticker · Gerät (Handy/Tablet/Laptop) · OS (iOS/Android/Windows/macOS) · Browser · Land · Stadt · Region · Sprache.**
Ziel-Links jederzeit änderbar, **ohne Neudruck**. Daten in deiner eigenen Vercel-Postgres-DB.

## A) Schnellster Weg — Vercel CLI
```bash
cd tracking-app-vercel
npm i -g vercel        # falls noch nicht installiert
vercel                 # einloggen + Projekt anlegen.  WICHTIG: Projektname = inner-goat-track
                       # (dann passt die URL zu den fertigen QR-Codes)
```
Dann im Vercel-Dashboard:
1. **Storage → Create Database → Postgres** → mit dem Projekt verbinden (setzt `POSTGRES_URL` automatisch).
2. **Settings → Environment Variables →** `ADMIN_PASSWORD` = dein Wunschpasswort.
3. `vercel --prod` (neu deployen, damit die Variablen greifen).

## B) Ohne CLI — über GitHub
1. Diesen Ordner in ein GitHub-Repo pushen.
2. vercel.com → **Add New → Project → Repo importieren** → Projektname **inner-goat-track**.
3. **Storage → Postgres** anlegen + verbinden.
4. **Env Var** `ADMIN_PASSWORD` setzen → Deploy.

## Einmalig einrichten
Im Browser öffnen: `https://inner-goat-track.vercel.app/api/setup?key=DEIN_PASSWORT`
→ legt Tabellen an + die 8 Sticker-Links. Antwort: „Setup fertig."

## Nutzen
- **QR-Codes:** liegen schon fertig in `../qr-tracker/qr_codes/` (zeigen auf `inner-goat-track.vercel.app/r/<sticker>`).
  Eigene/andere URLs? → `../QR-Studio.html` benutzen.
- **Dashboard:** `https://inner-goat-track.vercel.app/dashboard` (Passwort).
- **Ziele ändern:** `https://inner-goat-track.vercel.app/admin` (Passwort) — sofort wirksam.

## Anderer Projektname / eigene Domain?
Kein Problem — dann sind die QR-Ziele anders. Erzeug die QR-Codes einfach neu in `../QR-Studio.html`
(deine URL eintragen) oder sag mir die Domain, dann baue ich die PNGs neu.

## Test, dass es läuft
1. Nach Setup: Handy-Kamera auf einen QR halten → du landest auf dem Ziel.
2. `/dashboard` neu laden → der Scan taucht auf (mit Gerät/OS/Stadt). ✅

## Kosten
Vercel Hobby + Postgres Free-Tier reichen für die Kampagne locker.

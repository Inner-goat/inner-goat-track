-- Inner GOAT Tracker — Postgres-Schema (wird auch von /api/setup automatisch angelegt)
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY, name TEXT, cta TEXT, destination TEXT, created TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scans (
  id BIGSERIAL PRIMARY KEY, link_id TEXT, ts TIMESTAMPTZ,
  country TEXT, city TEXT, region TEXT, device TEXT, os TEXT, browser TEXT,
  lang TEXT, referer TEXT, ua TEXT
);
CREATE INDEX IF NOT EXISTS idx_scans_link ON scans(link_id);

INSERT INTO links (id,name,cta,destination) VALUES
('academy-bock','Kein Bock auf Uni','Academy','https://www.inner-goat.com/academy'),
('cards-smarties','Ideen wie Smarties','Storytelling Cards','https://www.inner-goat.com/cards'),
('web-trust','Trust your Goat','Website','https://www.inner-goat.com'),
('yt-goatmode','GOAT Mode On','YouTube','https://www.youtube.com/@innergoat'),
('academy-theorie','Spar dir die Theorie','Academy','https://www.inner-goat.com/academy'),
('cards-termsheet','Term Sheet','Storytelling Cards','https://www.inner-goat.com/cards'),
('web-netzwerk','Netzwerk = Net Worth','Website','https://www.inner-goat.com'),
('yt-bebrave','Be brave, be loud','YouTube','https://www.youtube.com/@innergoat')
ON CONFLICT (id) DO NOTHING;

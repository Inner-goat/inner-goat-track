// Auswertungslogik für den Beamten-Check (go.inner-goat.com/beamten-check).
//
// EINE Quelle der Wahrheit: /api/lead benutzt evaluate() für die Auswertungs-Mail
// UND gibt das Ergebnis an die Ergebnisseite zurück. Seite und Mail können also
// nie auseinanderlaufen.
//
// WICHTIG — rechtlicher Rahmen:
// Das hier ist ein Orientierungs-Check, KEINE Versicherungs- oder Anlageberatung.
// Deshalb: keine Produktempfehlungen, keine Beitrags- oder Renditezusagen, keine
// "du solltest X abschließen"-Sätze. Nur: hier ist eine Wissenslücke, hier ist die
// Rechtslage, sprich mit jemandem der beraten darf.
//
// Faktenstand: August 2026. Quellen siehe QUELLEN unten.

export const LAENDER = [
  "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen", "Hamburg",
  "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen",
  "Rheinland-Pfalz", "Saarland", "Sachsen", "Sachsen-Anhalt",
  "Schleswig-Holstein", "Thüringen", "Bund"
];

// Länder, die die pauschale Beihilfe anbieten (Stand 2026).
const PAUSCHALE_VOLL = new Set([
  "Hamburg", "Bremen", "Berlin", "Brandenburg", "Thüringen", "Baden-Württemberg",
  "Sachsen", "Niedersachsen", "Sachsen-Anhalt", "Mecklenburg-Vorpommern"
]);
// Nur für bestimmte Gruppen.
const PAUSCHALE_TEIL = new Set(["Schleswig-Holstein"]);

// Status, bei denen der Dienstherr bei Dienstunfähigkeit KEIN Ruhegehalt zahlt,
// sondern entlässt und in der gesetzlichen Rentenversicherung nachversichert.
const OHNE_VERSORGUNG = new Set(["referendariat", "probe"]);

const STATUS_LABEL = {
  studium:       "im Studium",
  referendariat: "im Referendariat (Beamtenverhältnis auf Widerruf)",
  probe:         "verbeamtet auf Probe",
  lebenszeit:    "verbeamtet auf Lebenszeit",
  angestellt:    "angestellt im öffentlichen Dienst"
};

const W = { du: 35, kv: 25, pension: 20, ueberblick: 10, fenster: 10 };
const PUNKTE = { gruen: 1, gelb: 0.5, rot: 0 };

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ── Block 1: Dienstunfähigkeit ──────────────────────────────────────
function blockDu(a) {
  const ohne = OHNE_VERSORGUNG.has(a.status);
  let level, kurz, lang;

  const lageOhne = `Als ${a.status === "probe" ? "Beamtin oder Beamter auf Probe" : "Beamtin oder Beamter auf Widerruf"} wirst du bei Dienstunfähigkeit nicht in den Ruhestand versetzt, sondern aus dem Beamtenverhältnis <b>entlassen</b>. Der Dienstherr zahlt dann kein Ruhegehalt. Du wirst rückwirkend in der gesetzlichen Rentenversicherung nachversichert. Für eine Erwerbsminderungsrente gilt dort aber eine Wartezeit von fünf Jahren, und die ist in dieser Phase praktisch nie erfüllt. Unterm Strich: laufendes Einkommen null.`;
  const lageLebenszeit = `Auf Lebenszeit bekommst du bei Dienstunfähigkeit ein Ruhegehalt. Das richtet sich aber nach den Dienstjahren, die du bis dahin gesammelt hast. Wer mit Anfang dreißig dienstunfähig wird, hat entsprechend wenige, und landet meist deutlich unter dem, was der Alltag kostet.`;
  const lageAngestellt = `Im Angestelltenverhältnis greift nicht die Dienstunfähigkeit, sondern die gesetzliche Erwerbsminderungsrente. Die setzt voraus, dass du praktisch gar keiner Tätigkeit mehr nachgehen kannst, nicht nur deiner eigenen. Die Hürde ist also deutlich höher, als die meisten denken.`;
  const lage = ohne ? lageOhne : (a.status === "angestellt" ? lageAngestellt : lageLebenszeit);

  if (a.du === "abgesichert") {
    level = "gruen";
    kurz = "Abgesichert, und das ist der wichtigste Punkt überhaupt.";
    lang = `${lage}<br><br>Du hast angegeben, dass du hier abgesichert bist. Damit hast du die Entscheidung getroffen, die von allen fünf am schwersten nachzuholen ist, denn sie hängt an deiner Gesundheit und die wird mit den Jahren selten besser.`;
  } else if (a.du === "bu_unklar") {
    level = ohne ? "rot" : "gelb";
    kurz = "Du hast etwas, aber der entscheidende Satz ist ungeprüft.";
    lang = `${lage}<br><br>Du hast eine Absicherung, weißt aber nicht, ob die Dienstunfähigkeit wirklich drin ist. Genau da liegt der Unterschied zwischen zahlt und zahlt vielleicht: Bei einer <b>echten Dienstunfähigkeitsklausel</b> übernimmt der Versicherer die Entscheidung deines Dienstherrn. Bei einer unechten prüft er nach eigenen Maßstäben nochmal selbst nach.<br><br>Das steht in deinen Vertragsbedingungen, meist unter „Dienstunfähigkeit". Such nach der Formulierung, dass die Versetzung in den Ruhestand oder die Entlassung wegen Dienstunfähigkeit als Leistungsfall gilt. Steht da stattdessen, dass der Versicherer selbst prüft, ist es eine unechte Klausel.`;
  } else if (a.du === "nichts") {
    level = "rot";
    kurz = "Hier ist gerade nichts, und das ist die größte Lücke im Check.";
    lang = `${lage}<br><br>Du hast angegeben, dass hier nichts läuft. Das ist der Punkt, an dem aus einem Ärgernis eine Existenzfrage wird, und gleichzeitig der einzige, der sich mit der Zeit von allein verschlechtert: Was du heute noch ohne Ausschlüsse bekommst, ist nach der ersten Diagnose oft nicht mehr zu haben.`;
  } else {
    level = "rot";
    kurz = "Unklar, und Unklarheit ist hier dasselbe wie ungesichert.";
    lang = `${lage}<br><br>Du weißt gerade nicht, wie du hier stehst. Das ist ehrlich und ziemlich normal. Aber im Ernstfall zählt nicht, was du vermutest, sondern was im Vertrag steht.`;
  }
  return { key: "du", titel: "Dienstunfähigkeit", level, kurz, lang };
}

// ── Block 2: Krankenversicherung und Beihilfe ───────────────────────
function blockKv(a) {
  const land = a.bundesland || "deinem Bundesland";
  const hatPauschale = PAUSCHALE_VOLL.has(a.bundesland);
  const teilPauschale = PAUSCHALE_TEIL.has(a.bundesland);
  const beamtin = a.status !== "angestellt" && a.status !== "studium";

  const grundlage = `Als Beamtin oder Beamter zahlt dein Dienstherr keinen Arbeitgeberanteil zur Krankenversicherung, sondern <b>Beihilfe</b>: im aktiven Dienst in der Regel 50 Prozent deiner Kosten, ab zwei berücksichtigungsfähigen Kindern 70 Prozent, als Versorgungsempfängerin später ebenfalls 70 Prozent. Den Rest deckst du selbst ab, üblicherweise über eine private Restkostenversicherung.`;

  let level, kurz, lang;

  if (a.kv === "pkv_beihilfe") {
    level = "gruen";
    kurz = "Passt zum Beamtenstatus.";
    lang = `${grundlage}<br><br>Du hast diese Kombination bereits. Damit nutzt du die Beihilfe so, wie sie gedacht ist.`;
  } else if (a.kv === "gkv") {
    if (hatPauschale) {
      level = "gelb";
      kurz = `In ${esc(land)} kann das aufgehen, ist aber meist eine Einbahnstraße.`;
      lang = `${grundlage}<br><br>${esc(land)} bietet die <b>pauschale Beihilfe</b> an: Statt der Einzelabrechnung bekommst du einen Zuschuss von rund der Hälfte deines Krankenversicherungsbeitrags und kannst gesetzlich versichert bleiben. Das ist eine echte Option und für manche die bessere.<br><br>Der Haken ist nicht die Höhe, sondern die Richtung: Die Entscheidung zwischen pauschaler und individueller Beihilfe ist in aller Regel <b>einmalig und unwiderruflich</b>. Wenn du sie noch nicht bewusst getroffen hast, ist das der Punkt, an dem ich mir eine Stunde Zeit nehmen würde.`;
    } else if (teilPauschale) {
      level = "gelb";
      kurz = `In ${esc(land)} gibt es die pauschale Beihilfe nur für bestimmte Gruppen.`;
      lang = `${grundlage}<br><br>${esc(land)} gewährt die pauschale Beihilfe nur eingeschränkt. Ob du dazugehörst, entscheidet über einen dreistelligen Betrag im Monat, und zwar für den Rest deines Berufslebens. Das würde ich zuerst klären.`;
    } else {
      level = beamtin ? "rot" : "gelb";
      kurz = `In ${esc(land)} gibt es keine pauschale Beihilfe.`;
      lang = `${grundlage}<br><br>${esc(land)} bietet die pauschale Beihilfe nicht an. Wer dort als Beamtin gesetzlich versichert bleibt, zahlt den vollen Beitrag allein, ohne Arbeitgeberanteil, und lässt die Beihilfe gleichzeitig weitgehend liegen. Das ist die teuerste Variante, die es in dieser Konstellation gibt.<br><br>Sie kann trotzdem die richtige sein, etwa bei Vorerkrankungen oder wenn mehrere Kinder mitversichert sind. Aber sie sollte eine Entscheidung sein, keine Voreinstellung.`;
    }
  } else if (a.kv === "familienversichert") {
    level = "gelb";
    kurz = "Läuft, aber mit Ablaufdatum.";
    lang = `${grundlage}<br><br>Die Familienversicherung endet spätestens mit dem Beginn deines Dienstverhältnisses oder mit der Altersgrenze. Das ist genau der Moment, in dem die Weiche gestellt wird, und danach lässt sie sich meist nicht mehr umlegen. Gut, wenn du vorher weißt, wohin du willst.`;
  } else {
    level = "rot";
    kurz = "Unklar, und das ist die teuerste Unklarheit im Check.";
    lang = `${grundlage}<br><br>Du weißt gerade nicht genau, wie du versichert bist. Bei allen anderen Punkten kostet Unwissen Geld. Hier kostet es Geld <b>und</b> eine Option, weil der Wechsel zwischen den Systemen in aller Regel nur einmal möglich ist.`;
  }
  return { key: "kv", titel: "Krankenversicherung & Beihilfe", level, kurz, lang };
}

// ── Block 3: Pension ────────────────────────────────────────────────
function blockPension(a) {
  const grundlage = `Dein Ruhegehalt wächst mit <b>1,79375 Prozent pro ruhegehaltfähigem Dienstjahr</b> und ist bei <b>71,75 Prozent</b> gedeckelt. Diesen Höchstsatz erreichst du erst nach 40 Dienstjahren in Vollzeit. Studium und Vorbereitungsdienst werden nur begrenzt und nach Ermessen angerechnet, nicht automatisch.`;
  let level, kurz, lang;

  if (a.dienstjahre === "ueber40") {
    level = "gruen";
    kurz = "Du kommst voraussichtlich auf den vollen Satz.";
    lang = `${grundlage}<br><br>Nach deiner Einschätzung kommst du über 40 Jahre. Dann ist die Versorgung selbst dein kleinstes Thema. Lohnt sich trotzdem, den Wert einmal schriftlich bestätigt zu bekommen statt ihn zu schätzen.`;
  } else if (a.dienstjahre === "unter40") {
    level = "gelb";
    kurz = "Unter 40 Jahren fehlt dir dauerhaft ein Stück.";
    lang = `${grundlage}<br><br>Du kommst nach eigener Einschätzung nicht auf 40 Jahre. Ein Rechenbeispiel: Wer 37 Jahre zusammenbekommt, landet bei rund 66,4 Prozent statt 71,75 Prozent. Das sind gut fünf Prozentpunkte deiner letzten Bezüge, jeden Monat, ab dem ersten Ruhestandstag.<br><br>Dazu kommt: Wer vor der Altersgrenze geht, verliert zusätzlich 3,6 Prozent pro Jahr. Beides ist kein Drama, wenn man es früh weiß, weil dann jedes Jahr Vorlauf mitarbeitet. Beides ist unangenehm, wenn man es mit 55 zum ersten Mal ausrechnet.`;
  } else {
    level = "gelb";
    kurz = "Die Zahl kennst du noch nicht, dabei ist sie ausrechenbar.";
    lang = `${grundlage}<br><br>Das ist die einzige Zahl im ganzen Check, die sich ziemlich genau vorhersagen lässt: Eintrittsalter, geplantes Ende, Teilzeitphasen, fertig. Die meisten kennen sie trotzdem nicht, und genau deshalb wird die Lücke oft erst entdeckt, wenn kaum noch Zeit bleibt.`;
  }
  return { key: "pension", titel: "Pension & Versorgungslücke", level, kurz, lang };
}

// ── Block 4: Überblick ──────────────────────────────────────────────
function blockUeberblick(a) {
  let level, kurz, lang;
  if (a.check === "letztes_jahr") {
    level = "gruen";
    kurz = "Aktuell durchgesehen.";
    lang = `Deine Unterlagen sind frisch geprüft. Damit gehörst du in eine klare Minderheit.`;
  } else if (a.check === "ueber2") {
    level = "gelb";
    kurz = "Länger als zwei Jahre her.";
    lang = `In zwei Jahren ändern sich Besoldung, Familienstand, Wohnort und manchmal das Bundesland. Verträge, die damals gepasst haben, passen deshalb nicht automatisch weiter. Es geht dabei selten um neue Verträge, öfter um Verträge, die man sich sparen kann.`;
  } else {
    level = "rot";
    kurz = "Noch nie unabhängig durchgesehen.";
    lang = `Es hat noch nie jemand draufgeschaut, der nichts verkaufen wollte. Das ist der häufigste Befund in diesem Check und meistens der billigste zu beheben, weil dabei erfahrungsgemäß mindestens genauso viel wegfällt wie dazukommt.`;
  }
  return { key: "ueberblick", titel: "Überblick über deine Verträge", level, kurz, lang };
}

// ── Block 5: Zeitfenster ────────────────────────────────────────────
function blockFenster(a) {
  let level, kurz, lang;
  if (a.status === "studium") {
    level = "gruen";
    kurz = "Dir steht alles offen.";
    lang = `Du bist früh dran, und das ist bei diesen Themen der einzige echte Vorteil, den man sich nicht kaufen kann. Die Gesundheitsprüfung für eine Absicherung wird nie wieder so günstig ausfallen wie jetzt.`;
  } else if (a.status === "referendariat") {
    level = "gelb";
    kurz = "Dein Fenster ist offen, aber es schließt sich terminiert.";
    lang = `Das Referendariat ist die Phase, in der drei Weichen gleichzeitig stehen: Absicherung gegen Dienstunfähigkeit, Krankenversicherung samt Beihilfe und der Start deiner Dienstzeit. Alle drei sind später entweder teurer oder gar nicht mehr korrigierbar. Das ist kein Grund zur Eile, aber ein Grund, es nicht auf nach dem Examen zu schieben.`;
  } else if (a.status === "probe") {
    level = "gelb";
    kurz = "Noch offen, aber du bist mitten in der Weichenstellung.";
    lang = `Auf Probe gilt versorgungsrechtlich noch nicht, was auf Lebenszeit gilt: Bei Dienstunfähigkeit wird in der Regel entlassen, nicht pensioniert. Die Absicherungsentscheidung gehört deshalb in diese Phase und nicht danach.`;
  } else if (a.status === "lebenszeit") {
    level = "gruen";
    kurz = "Die großen Weichen sind gestellt.";
    lang = `Auf Lebenszeit sind die einmaligen Entscheidungen weitgehend gefallen. Was jetzt zählt, ist Feinschliff: Passt die Absicherung noch zur Besoldungsstufe, stimmen die Beihilfesätze mit deiner Familiensituation überein, läuft der Vermögensaufbau.`;
  } else {
    level = "gruen";
    kurz = "Andere Regeln, anderes Tempo.";
    lang = `Als Angestellte im öffentlichen Dienst gelten Beihilfe und Dienstunfähigkeit für dich nicht. Dafür ist die Zusatzversorgung dein Thema, und die Erwerbsminderungsrente hat eine deutlich höhere Hürde als die Dienstunfähigkeit.`;
  }
  return { key: "fenster", titel: "Dein Zeitfenster", level, kurz, lang };
}

// ── Gesamtauswertung ────────────────────────────────────────────────
export function evaluate(a = {}) {
  const bloecke = [blockDu(a), blockKv(a), blockPension(a), blockUeberblick(a), blockFenster(a)];

  let score = 0;
  for (const b of bloecke) score += (W[b.key] || 0) * (PUNKTE[b.level] ?? 0);
  score = Math.round(score);

  const gruen = bloecke.filter(b => b.level === "gruen").length;
  const rot = bloecke.filter(b => b.level === "rot");

  let headline;
  if (score >= 80)      headline = "Du bist besser aufgestellt als die allermeisten.";
  else if (score >= 55) headline = "Grundsätzlich solide, mit einer klaren Lücke.";
  else if (score >= 30) headline = "Zwei Sachen würde ich an deiner Stelle zeitnah klären.";
  else                  headline = "Da liegt gerade einiges offen.";

  // Die eine Sache für die nächsten 14 Tage: schwerstes rotes Feld, sonst schwerstes gelbes.
  const reihenfolge = ["du", "kv", "pension", "ueberblick", "fenster"];
  const kandidat =
    reihenfolge.map(k => bloecke.find(b => b.key === k)).find(b => b.level === "rot") ||
    reihenfolge.map(k => bloecke.find(b => b.key === k)).find(b => b.level === "gelb");

  const AKTION = {
    du: `Nimm deine Versicherungsunterlagen und such nach dem Wort „Dienstunfähigkeit“. Finde heraus, ob dort steht, dass die Entscheidung deines Dienstherrn genügt. Wenn du nichts findest oder es unklar formuliert ist, hast du deine Antwort.`,
    kv: "Schreib deiner Beihilfestelle eine Mail mit zwei Fragen: Welcher Bemessungssatz gilt aktuell für mich, und bis wann kann ich zwischen individueller und pauschaler Beihilfe wählen? Das kostet dich fünf Minuten und beendet die Unklarheit.",
    pension: "Beantrage bei deiner Versorgungsstelle eine Auskunft über deine bisher anerkannte ruhegehaltfähige Dienstzeit. Damit hast du statt einer Vermutung eine Zahl.",
    ueberblick: "Leg deine Verträge einmal nebeneinander und schreib zu jedem auf, wogegen er dich eigentlich schützt. Bei allem, wo du keinen Satz zustande bekommst, weißt du schon Bescheid.",
    fenster: "Trag dir einen festen Termin mit dir selbst ein, bevor dein Status wechselt. Danach sind ein paar dieser Entscheidungen nicht mehr offen."
  };
  const naechsterSchritt = kandidat
    ? { titel: kandidat.titel, text: AKTION[kandidat.key] }
    : { titel: "Nichts Dringendes", text: "Bei dir ist gerade nichts akut. Ein Blick alle ein bis zwei Jahre reicht völlig." };

  // Ehrlicher Gegenpol: was gerade NICHT dran ist.
  const nichtNoetig = [];
  if (bloecke[0].level === "gruen") nichtNoetig.push("Eine zweite Absicherung gegen Dienstunfähigkeit brauchst du nicht. Eine reicht, sie muss nur die richtige Klausel haben.");
  if (a.status === "studium" || a.status === "referendariat") nichtNoetig.push("Kapitalbildende Lebens- oder Rentenversicherungen mit langer Bindung sind in deiner Phase selten sinnvoll, weil sich dein Einkommen in den nächsten zwei Jahren stark verändert.");
  if (bloecke[2].level === "gruen") nichtNoetig.push("Zusätzliche private Altersvorsorge ist bei dir kein dringendes Thema. Die Versorgung trägt.");
  if (!nichtNoetig.length) nichtNoetig.push("Du brauchst jetzt keinen Rundumschlag. Ein Punkt nach dem anderen reicht, und der erste steht oben.");

  return {
    score, gruen, rotAnzahl: rot.length, headline, bloecke, naechsterSchritt, nichtNoetig,
    statusLabel: STATUS_LABEL[a.status] || "im öffentlichen Dienst",
    bundesland: a.bundesland || ""
  };
}

// Kompakte Level-Liste für die Teaser-Ampeln vor der Mail-Abfrage.
export function ampeln(a) {
  return evaluate(a).bloecke.map(b => ({ titel: b.titel, level: b.level }));
}

export const QUELLEN = [
  ["Dienstunfähigkeit bei Beamten auf Widerruf und Probe, echte DU-Klausel", "https://www.franke-bornberg.de/blog/echte-du-klausel-fuer-beamte-dienstunfaehigkeit"],
  ["Beihilfe-Bemessungssätze (BVA-Merkblatt)", "https://www.bva.bund.de/SharedDocs/Downloads/DE/Bundesbedienstete/Gesundheit-Vorsorge/Beihilfe/Merkblaetter/bemessungssatz.pdf"],
  ["Pauschale Beihilfe nach Bundesländern", "https://www.deutsche-beamtenversorgung.de/pauschale-beihilfe/"],
  ["§ 14 BeamtVG, Ruhegehaltssatz 1,79375 % / Höchstsatz 71,75 %", "https://www.gesetze-im-internet.de/beamtvg/__14.html"],
  ["§ 12 BeamtVG, Anrechnung von Ausbildungszeiten", "https://www.gesetze-im-internet.de/beamtvg/__12.html"]
];

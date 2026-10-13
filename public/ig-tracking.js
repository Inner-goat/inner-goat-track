/*
 * Inner GOAT Tracking, Bausteine 1.1-1.5 nach Spezifikation Kiez & Kante.
 * Gemeinsame Datei fuer alle Seiten auf go.inner-goat.com.
 *
 * Einbindung im <head>, ohne async und ohne defer:
 *   <script src="/ig-tracking.js" data-seitentyp="lp" data-kampagne="ideen"></script>
 *
 * data-seitentyp  -> Custom Dimension 2 (start, academy, blog, lp, app, podcast)
 * data-kampagne   -> loest zusaetzlich funnel/lp_besuch/<kampagne> aus, optional
 *
 * Angelegt 01.09.2026. Aenderungen bitte mit dem WPCode-Snippet #527 auf
 * inner-goat.com abgleichen, beide muessen denselben Stand haben.
 */
(function () {
  var mich = document.currentScript;
  var seitentyp = (mich && mich.getAttribute('data-seitentyp')) || 'lp';
  var kampagne = mich && mich.getAttribute('data-kampagne');

  /* Hilfsfunktionen: Labels als data-Attribut ODER als Klasse.
     Klick:        ig--kategorie--aktion--label
     Sichtbarkeit: ig-sicht--name
     Das data-Attribut hat Vorrang. */
  window.__igKlasse = window.__igKlasse || function (el, muster) {
    var c = el.className;
    if (c && typeof c !== 'string' && typeof c.baseVal === 'string') { c = c.baseVal; }
    return (' ' + (c || '') + ' ').match(muster);
  };
  window.__igLiesKlick = window.__igLiesKlick || function (el) {
    var d = el.getAttribute('data-ig');
    if (d) { return d.split('|'); }
    var m = window.__igKlasse(el, /\sig--([a-z0-9_]+)--([a-z0-9_]+)(?:--([a-z0-9_]+))?(?=\s)/);
    return m ? [m[1], m[2], m[3] || ''] : null;
  };
  window.__igLiesSicht = window.__igLiesSicht || function (el) {
    var d = el.getAttribute('data-ig-sicht');
    if (d) { return d; }
    var m = window.__igKlasse(el, /\sig-sicht--([a-z0-9_]+)(?=\s)/);
    return m ? m[1] : null;
  };

  /* 1.1 Matomo Basis */
  if (!window.__igMatomo) {
    window.__igMatomo = true;
    var _paq = (window._paq = window._paq || []);
    var u = 'https://stats.inner-goat.com/';
    _paq.push(['setTrackerUrl', u + 'matomo.php']);
    _paq.push(['setSiteId', '1']);
    _paq.push(['disableCookies']);
    _paq.push(['setDomains', ['*.inner-goat.com', '*.vercel.app']]);
    _paq.push(['enableLinkTracking']);
    _paq.push(['enableHeartBeatTimer', 15]);
    _paq.push(['setCustomDimension', 1, location.hostname]);
    _paq.push(['setCustomDimension', 2, seitentyp]);
    _paq.push(['trackPageView']);
    var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
    g.async = true;
    g.src = u + 'matomo.js';
    s.parentNode.insertBefore(g, s);
  }

  /* 1.2 Gemeinsamer Wrapper. Der PostHog-Zweig ist Vorarbeit fuer Phase 2 und bleibt untaetig. */
  window.igTrack = window.igTrack || function (kategorie, aktion, label, wert) {
    label = label || '';
    if (window._paq) {
      window._paq.push(['trackEvent', kategorie, aktion, label, wert]);
    }
    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(kategorie + '_' + aktion, {
        label: label,
        wert: wert,
        host: location.hostname,
        path: location.pathname
      });
    }
  };

  /* 1.3 Zentraler Klick-Listener */
  if (!window.__igKlick) {
    window.__igKlick = true;
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var el = e.target.closest('[data-ig], [class*="ig--"]');
      if (!el) return;
      var p = window.__igLiesKlick(el);
      if (!p || !p[0] || !p[1]) return;
      window.igTrack(p[0], p[1], p[2] || '');
    }, true);
  }

  /* 1.4 Scrolltiefe */
  if (!window.__igScroll) {
    window.__igScroll = true;
    var stufen = [25, 50, 75, 100];
    var erledigt = {};
    var seite = location.pathname;
    var pruefen = function () {
      var h = document.documentElement;
      var gesamt = h.scrollHeight - h.clientHeight;
      if (gesamt <= 0) return;
      var pct = ((h.scrollTop || document.body.scrollTop) / gesamt) * 100;
      for (var i = 0; i < stufen.length; i++) {
        var st = stufen[i];
        if (pct >= st && !erledigt[st]) {
          erledigt[st] = true;
          window.igTrack('scroll', 'tiefe', seite + '|' + st, st);
        }
      }
    };
    var wartet = false;
    window.addEventListener('scroll', function () {
      if (wartet) return;
      wartet = true;
      setTimeout(function () { wartet = false; pruefen(); }, 250);
    }, { passive: true });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', pruefen);
    } else {
      pruefen();
    }
  }

  /* 1.5 Sichtbarkeit von Sektionen. Start erst nach DOMContentLoaded, sonst
     gibt es noch keine Ziel-Elemente und die Sperre wuerde die Messung
     dauerhaft abwuergen. */
  if (!window.__igSichtInit) {
    var sichtStart = function () {
      if (window.__igSichtInit) return;
      window.__igSichtInit = true;
      var ziele = document.querySelectorAll('[data-ig-sicht], [class*="ig-sicht--"]');
      if (!ziele.length || !('IntersectionObserver' in window)) return;
      window.igSicht = window.igSicht || {};
      var obs = new IntersectionObserver(function (eintraege) {
        eintraege.forEach(function (ein) {
          if (!ein.isIntersecting) return;
          var name = window.__igLiesSicht(ein.target);
          if (!name || window.igSicht[name]) return;
          window.igSicht[name] = Date.now();
          window.igTrack('sichtbarkeit', 'sektion', name);
          obs.unobserve(ein.target);
        });
      }, { threshold: 0.5 });
      [].forEach.call(ziele, function (z) { obs.observe(z); });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', sichtStart);
    } else {
      sichtStart();
    }
  }

  /* Messpunkt 03, Zeit bis zum ersten Klick */
  if (!window.__igErsterKlick) {
    window.__igErsterKlick = true;
    var erster = false;
    document.addEventListener('click', function () {
      if (erster) return;
      erster = true;
      window.igTrack('interaktion', 'erster_klick', location.pathname, Math.round(performance.now() / 1000));
    }, true);
  }

  /* Messpunkt 12, erste Haelfte: Besuch der Landingpage.
     Die zweite Haelfte (lp_absenden) sitzt im jeweiligen Absende-Erfolgspfad
     der Seite, damit Fehlversuche nicht mitgezaehlt werden. */
  if (kampagne && !window.__igLpBesuch) {
    window.__igLpBesuch = true;
    window.igTrack('funnel', 'lp_besuch', kampagne);
  }
})();

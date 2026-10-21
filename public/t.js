/* Roots Engine · analítica web ligera (sin cookies). Uso: <script defer src="https://TU-MOTOR/t.js" data-site="CLAVE"></script> */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var key = s.getAttribute("data-site");
  if (!key || navigator.webdriver) return;
  var endpoint = new URL(s.src).origin + "/api/collect";
  function id() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function store(k, area) { try { return area.getItem(k); } catch (e) { return null; } }
  function save(k, v, area) { try { area.setItem(k, v); } catch (e) {} }
  var visitor = store("pra_v", localStorage) || id();
  save("pra_v", visitor, localStorage);
  var last = Number(store("pra_t", sessionStorage) || 0);
  var session = store("pra_s", sessionStorage);
  if (!session || Date.now() - last > 30 * 60 * 1000) session = id();
  save("pra_s", session, sessionStorage);
  function touch() { save("pra_t", String(Date.now()), sessionStorage); }

  function send(data) {
    data.k = key; data.v = visitor; data.s = session; data.w = window.innerWidth;
    var body = JSON.stringify(data);
    touch();
    if (navigator.sendBeacon && navigator.sendBeacon(endpoint, body)) return;
    try { fetch(endpoint, { method: "POST", body: body, keepalive: true, mode: "no-cors" }); } catch (e) {}
  }

  var page = null, visibleSince = 0, active = 0, maxScroll = 0;
  function scrollPct() {
    var h = document.documentElement, b = document.body;
    var total = Math.max(h.scrollHeight, b.scrollHeight) - window.innerHeight;
    return total <= 0 ? 100 : Math.min(100, Math.round(((window.scrollY || h.scrollTop) / total) * 100));
  }
  function utm() {
    var q = new URLSearchParams(location.search), o = {};
    ["utm_source", "utm_medium", "utm_campaign"].forEach(function (k) { if (q.get(k)) o[k] = q.get(k); });
    return o;
  }
  function leave() {
    if (!page) return;
    if (visibleSince) active += Date.now() - visibleSince;
    visibleSince = 0;
    send({ t: "leave", p: page, d: active, sc: maxScroll });
    page = null;
  }
  function view() {
    var p = location.pathname + (location.hash.indexOf("#/") === 0 ? location.hash : "");
    if (p === page) return;
    leave();
    page = p; active = 0; maxScroll = scrollPct(); visibleSince = document.visibilityState === "visible" ? Date.now() : 0;
    send({ t: "pageview", p: p, ti: document.title, r: document.referrer, u: utm() });
  }
  window.addEventListener("scroll", function () { var x = scrollPct(); if (x > maxScroll) maxScroll = x; }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") leave();
    else if (!page) { page = location.pathname; active = 0; visibleSince = Date.now(); }
  });
  window.addEventListener("pagehide", leave);
  ["pushState", "replaceState"].forEach(function (m) {
    var orig = history[m];
    history[m] = function () { var r = orig.apply(this, arguments); setTimeout(view, 0); return r; };
  });
  window.addEventListener("popstate", view);
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("a,button,[data-track]") : null;
    if (!el) return;
    var label = el.getAttribute("data-track");
    var href = el.getAttribute("href") || "";
    if (!label) {
      if (href.indexOf("tel:") === 0) label = "Llamada";
      else if (href.indexOf("mailto:") === 0) label = "Correo";
      else if (/wa\.me|whatsapp/i.test(href)) label = "WhatsApp";
      else if (/instagram\.com|tiktok\.com|facebook\.com/i.test(href)) label = "Red social";
      else if (/calendly|booksy|vagaro|square|acuity|book|agenda|cita/i.test(href + " " + (el.textContent || ""))) label = "Agendar: " + (el.textContent || "").trim().slice(0, 40);
      else if (href && el.host && el.host !== location.host) label = "Sale a " + el.host;
      else if (el.tagName === "BUTTON") label = "Botón: " + (el.textContent || "").trim().slice(0, 40);
    }
    if (label) send({ t: "click", p: location.pathname, l: label.slice(0, 80) });
  }, true);
  view();
})();

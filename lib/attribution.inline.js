/* sergiogalos.es — atribución de origen de los contactos. Código propio, sin terceros.
   Se incluye INLINE en todas las páginas (ver inyección en cada index.html). Compatible con navegadores antiguos. */
(function () {
  var PREFIX = "sg_attr_";
  var mem = {};
  function store(kind) {
    try {
      var s = kind === "local" ? window.localStorage : window.sessionStorage;
      s.setItem(PREFIX + "test", "1"); s.removeItem(PREFIX + "test");
      return s;
    } catch (e) {
      return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, kind + k) ? mem[kind + k] : null; },
               setItem: function (k, v) { mem[kind + k] = String(v); } };
    }
  }
  var LS = store("local"), SS = store("session");
  function get(s, k) { try { var v = s.getItem(PREFIX + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function set(s, k, v) { try { s.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) {} }
  function cut(v, n) { v = v == null ? "" : String(v); return v.length > n ? v.slice(0, n) : v; }
  function param(q, name) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(q);
    if (!m) return "";
    try { return decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { return m[1]; }
  }

  // ---- touch de esta carga de página
  var q = location.search || "";
  var touch = { ts: new Date().toISOString(), landing: cut(location.pathname + location.search, 300), referrer: "", utm: {}, ids: {} };
  try {
    if (document.referrer) {
      var a = document.createElement("a"); a.href = document.referrer;
      if (a.hostname && a.hostname !== location.hostname) touch.referrer = cut(document.referrer, 300);
    }
  } catch (e) {}
  var UTM = ["source", "medium", "campaign", "term", "content", "id"], i, v;
  for (i = 0; i < UTM.length; i++) { v = param(q, "utm_" + UTM[i]); if (v) touch.utm[UTM[i]] = cut(v, 150); }
  var IDS = ["gclid", "gbraid", "wbraid", "gad_source", "fbclid", "msclkid", "ttclid", "li_fat_id", "twclid", "oppref", "olref"];
  for (i = 0; i < IDS.length; i++) { v = param(q, IDS[i]); if (v) touch.ids[IDS[i]] = cut(v, 400); }
  function hasSignal(t) {
    if (t.referrer) return true;
    for (var k in t.utm) if (t.utm[k]) return true;
    for (var j in t.ids) if (t.ids[j]) return true;
    return false;
  }

  // ---- primera visita (90 días)
  var first = get(LS, "first");
  var ninetyDays = 90 * 24 * 60 * 60 * 1000;
  if (!first || !first.ts || (Date.now() - new Date(first.ts).getTime()) > ninetyDays) { first = touch; set(LS, "first", first); }

  // ---- sesión
  var session = get(SS, "session");
  if (!session || !session.touch) {
    session = { touch: touch, startedAt: Date.now(), pages: 0 };
    var visits = parseInt(get(LS, "visits"), 10) || 0;
    set(LS, "visits", visits + 1);
  } else if (hasSignal(touch)) {
    session.touch = touch;
  }
  session.pages = (parseInt(session.pages, 10) || 0) + 1;
  set(SS, "session", session);

  // ---- al enviar un formulario con input[name="email"]
  function hidden(form, name, value) {
    var el = form.querySelector('input[name="' + name + '"]');
    if (!el) { el = document.createElement("input"); el.type = "hidden"; el.name = name; form.appendChild(el); }
    if (value !== undefined) el.value = value;
    return el;
  }
  function newEventId() {
    if (typeof window.oaiqNewEventId === "function") { try { return String(window.oaiqNewEventId()); } catch (e) {} }
    return "sg-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    if (!form || String(form.tagName).toUpperCase() !== "FORM") return;
    if (!form.querySelector('input[name="email"]')) return;
    var s = get(SS, "session") || session;
    var device = {
      w: screen.width, h: screen.height, vw: window.innerWidth, dpr: window.devicePixelRatio || 1,
      touch: ("ontouchstart" in window) || (navigator.maxTouchPoints > 0),
      lang: navigator.language || "", tz: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } })()
    };
    var attribution = {
      first: get(LS, "first") || first,
      session: s.touch,
      pages: s.pages,
      secondsOnSite: Math.round((Date.now() - (s.startedAt || Date.now())) / 1000),
      visits: parseInt(get(LS, "visits"), 10) || 1,
      device: device
    };
    hidden(form, "attribution", JSON.stringify(attribution));
    hidden(form, "source", cut(location.href, 500));
    var ev1 = hidden(form, "eventId");
    if (!ev1.value) ev1.value = newEventId();
    try { window.sessionStorage.setItem("oaiq_event_id", ev1.value); } catch (e) {}
  }, true);
})();

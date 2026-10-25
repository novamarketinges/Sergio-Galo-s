// lib/lead-source.js — Clasificación del origen de un contacto a partir de la atribución
// recogida en el navegador (ver lib/attribution.inline.js). Sin dependencias externas.

"use strict";

var PAID = /^(cpc|ppc|paid|paidsearch|paid_search|paid-search|ads?|display|cpm|sem|retargeting|remarketing)$/i;

var TRACKING_PARAMS = /^(utm_[a-z]+|gclid|gbraid|wbraid|gad_source|gad_campaignid|fbclid|msclkid|ttclid|li_fat_id|twclid|oppref|olref)$/i;

var AI_HOSTS = [
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/^gemini\.google\.com$|^bard\.google\.com$/, "Gemini"],
  [/^copilot\.microsoft\.com$/, "Copilot"],
  [/(^|\.)claude\.ai$/, "Claude"],
  [/(^|\.)deepseek\.com$/, "DeepSeek"],
];

var SOCIAL_HOSTS = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
  [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, "X (Twitter)"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)youtube\.com$/, "YouTube"],
  [/(^|\.)pinterest\.[a-z.]+$/, "Pinterest"],
];

var SEARCH_HOSTS = [
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\.com$/, "Yahoo"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
  [/^search\.brave\.com$/, "Brave"],
];

function str(v) { return v == null ? "" : String(v); }

function clean(v, max) {
  return str(v).replace(/[\r\n\t]+/g, " ").trim().slice(0, max || 300);
}

function refHostOf(referrer) {
  var r = str(referrer).trim();
  if (!r) return "";
  try {
    var host = new URL(/^https?:\/\//i.test(r) ? r : "https://" + r).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
}

function matchHost(host, table) {
  if (!host) return "";
  for (var i = 0; i < table.length; i++) if (table[i][0].test(host)) return table[i][1];
  return "";
}

// ---------------------------------------------------------------------------

function classifyTouch(touch) {
  if (!touch || typeof touch !== "object") return "Desconocido";
  var utm = touch.utm || {};
  var ids = touch.ids || {};
  var source = clean(utm.source, 150).toLowerCase();
  var medium = clean(utm.medium, 150).toLowerCase();
  var refHost = refHostOf(touch.referrer);
  var paid = PAID.test(medium);
  var name;

  // 1 Google Ads
  if (ids.gclid || ids.gbraid || ids.wbraid || ids.gad_source || (source.indexOf("google") >= 0 && paid)) return "Google Ads";
  // 2 ChatGPT Ads
  if (ids.oppref || ids.olref || (/chatgpt|openai/.test(source) && paid)) return "ChatGPT Ads";
  // 3 Meta Ads
  var metaSrc = /facebook|instagram|meta|^fb$|^ig$/.test(source);
  if ((ids.fbclid && (paid || metaSrc)) || (metaSrc && paid)) return "Meta Ads";
  // 4 Microsoft Ads
  if (ids.msclkid || (/bing|microsoft/.test(source) && paid)) return "Microsoft Ads (Bing)";
  // 5 Otros ids de pago
  if (ids.ttclid) return "TikTok Ads";
  if (ids.li_fat_id) return "LinkedIn Ads";
  if (ids.twclid) return "X Ads";
  // 6 Pago genérico
  if (source && paid) return "Publicidad (" + source + ")";
  // 7 IA orgánico
  name = matchHost(refHost, AI_HOSTS);
  if (!name && /chatgpt|openai/.test(source)) name = "ChatGPT";
  if (!name && /perplexity/.test(source)) name = "Perplexity";
  if (name) return "IA orgánico (" + name + ")";
  // 8 Email
  if (/^(email|e-mail|mail|newsletter)$/.test(medium) || /newsletter|mailchimp|brevo/.test(source)) return "Email";
  // 9 fbclid sin pago
  if (ids.fbclid) return "Redes sociales (Facebook/Instagram)";
  // 10 Redes sociales
  name = matchHost(refHost, SOCIAL_HOSTS);
  if (name) return "Redes sociales (" + name + ")";
  if (/^(social|social-media|rrss)$/.test(medium) && source) return "Redes sociales (" + source + ")";
  // 11 Orgánico
  name = matchHost(refHost, SEARCH_HOSTS);
  if (name) return "Orgánico (" + name + ")";
  if (medium === "organic" && source) return "Orgánico (" + source + ")";
  // 12 Campaña
  if (source) return "Campaña (" + source + " / " + (medium || "-") + ")";
  // 13 Referencia
  if (refHost) return "Referencia (" + refHost + ")";
  // 14 Directo
  return "Directo";
}

// ---------------------------------------------------------------------------

function describeDevice(userAgent, device) {
  var ua = str(userAgent);
  var d = device && typeof device === "object" ? device : {};
  var tipo, so, nav;

  if (/iPad|Tablet|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || (/Macintosh/i.test(ua) && d.touch)) tipo = "Tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) tipo = "Móvil";
  else tipo = "Escritorio";

  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && d.touch)) so = "iOS";
  else if (/Android/i.test(ua)) so = "Android";
  else if (/Windows/i.test(ua)) so = "Windows";
  else if (/Macintosh|Mac OS X/i.test(ua)) so = "macOS";
  else if (/CrOS/i.test(ua)) so = "ChromeOS";
  else if (/Linux/i.test(ua)) so = "Linux";
  else so = "Otro SO";

  if (/Edg\//i.test(ua)) nav = "Edge";
  else if (/OPR\//i.test(ua)) nav = "Opera";
  else if (/SamsungBrowser/i.test(ua)) nav = "Samsung Internet";
  else if (/Firefox|FxiOS/i.test(ua)) nav = "Firefox";
  else if (/Chrome|CriOS/i.test(ua)) nav = "Chrome";
  else if (/Safari/i.test(ua)) nav = "Safari";
  else nav = "Otro navegador";

  var pantalla = d.w && d.h ? d.w + "x" + d.h : "?";
  return tipo + " · " + so + " · " + nav + " · pantalla " + pantalla;
}

// ---------------------------------------------------------------------------

function fmtDate(iso) {
  var dt = new Date(iso);
  if (isNaN(dt.getTime())) return clean(iso, 40) || "-";
  var p = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(dt);
  var m = {};
  p.forEach(function (x) { m[x.type] = x.value; });
  return m.day + "/" + m.month + "/" + m.year + ", " + m.hour + ":" + m.minute;
}

function stripTracking(landing) {
  var l = clean(landing, 300);
  if (!l) return "-";
  var qi = l.indexOf("?");
  if (qi < 0) return l;
  var path = l.slice(0, qi);
  var kept = l.slice(qi + 1).split("&").filter(function (kv) {
    var k = kv.split("=")[0];
    return k && !TRACKING_PARAMS.test(decodeURIComponent(k));
  });
  return kept.length ? path + "?" + kept.join("&") : path;
}

function touchLines(title, touch) {
  var lines = [];
  var utm = touch.utm || {};
  var ids = touch.ids || {};
  lines.push(title + ": " + classifyTouch(touch) + " (" + fmtDate(touch.ts) + ")");
  lines.push("  Entrada:   " + stripTracking(touch.landing));
  lines.push("  Referrer:  " + (clean(touch.referrer, 300) || "(ninguno)"));
  var utmParts = ["source", "medium", "campaign", "term", "content"].filter(function (k) { return utm[k]; })
    .map(function (k) { return k + "=" + clean(utm[k], 150); });
  if (utmParts.length) lines.push("  UTM:       " + utmParts.join(" · "));
  var idNames = Object.keys(ids).filter(function (k) { return ids[k]; });
  if (idNames.length) lines.push("  Click ID:  " + idNames.join(", "));
  return lines;
}

function leadSourceBlock(attributionJson, userAgent, acceptLanguage) {
  var a = null;
  if (typeof attributionJson === "string" && attributionJson.length <= 8000) {
    try { a = JSON.parse(attributionJson); } catch (e) { a = null; }
  }
  var lines = ["", "ORIGEN DEL CONTACTO", "-------------------"];
  if (!a || typeof a !== "object") {
    lines.push("Canal:        Desconocido (sin datos del navegador)");
    lines.push("Dispositivo:  " + describeDevice(userAgent, null));
    lines.push("Idioma:       " + (clean(acceptLanguage, 60).split(",")[0] || "-"));
    return lines;
  }
  var session = a.session || null;
  var first = a.first || null;
  var device = a.device || {};
  var canal = session ? classifyTouch(session) : "Desconocido (sin datos del navegador)";
  var visits = parseInt(a.visits, 10) || 1;
  var pages = parseInt(a.pages, 10) || 0;
  var mins = Math.round((parseInt(a.secondsOnSite, 10) || 0) / 60);

  lines.push("Canal:        " + canal);
  lines.push("Dispositivo:  " + describeDevice(userAgent, device));
  lines.push("Idioma:       " + (clean(device.lang, 20) || clean(acceptLanguage, 60).split(",")[0] || "-") + " · " + (clean(device.tz, 60) || "-"));
  lines.push("Esta visita:  " + pages + " páginas vistas · " + mins + " min en la web");
  lines.push("Visitas:      " + visits + (visits > 1 ? " (ha vuelto a la web)" : " (primera visita)"));
  if (session) {
    lines.push("");
    lines = lines.concat(touchLines("Visita actual", session));
  }
  if (first && (!session || first.ts !== session.ts)) {
    lines.push("");
    lines = lines.concat(touchLines("Primera visita", first));
  }
  return lines;
}

module.exports = { classifyTouch: classifyTouch, describeDevice: describeDevice, leadSourceBlock: leadSourceBlock, fmtDate: fmtDate, clean: clean };

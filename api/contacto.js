// Función serverless de Vercel: recibe el formulario de contacto, clasifica el origen del lead
// y envía el aviso por SMTP. Sin analítica externa, sin terceros, sin guardar la IP.
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   SMTP_HOST, SMTP_PORT (587 o 465), SMTP_USER, SMTP_PASS, SMTP_SECURE ("true" para 465)
//   MAIL_FROM (remitente visible; el sobre SMTP usa siempre SMTP_USER), MAIL_TO (por defecto hola@novamarketing.es)
//   SMTP_DRY_RUN "1" para probar sin enviar (solo registra en los logs)

const nodemailer = require("nodemailer");
const { classifyTouch, leadSourceBlock, fmtDate, clean } = require("../lib/lead-source");

const BRAND = "Sergio Galo's";
const PHONE_RE = /^[0-9+\s().-]{9,40}$/;
const URL_RE = /^(https?:\/\/)?(www\.)?([a-z0-9áéíóúàèòïüñç-]+\.)+[a-z]{2,24}(:\d{2,5})?(\/\S*)?$/i;
const OBJETIVOS = {
  local: "Más clientes de mi zona",
  ecommerce: "Vender más en mi tienda online",
  b2b: "Conseguir presupuestos de empresas",
  "no-se": "Todavía no lo tiene claro",
};
const NECESIDADES = {
  "auditoria-gratuita": "Auditoría SEO inicial gratuita",
  "auditoria-completa": "Auditoría SEO completa (desde 900 €)",
  "consultoria-mensual": "Consultoría SEO mensual (desde 300 € al mes)",
  "proyecto": "Proyecto SEO a medida (a consultar)",
  "no-se": "Todavía no lo sabe",
};

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body); } catch (e) { return {}; }
}

function truthy(v) { return v === "1" || v === "on" || v === true || v === 1; }

function crearTransporte() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
    tls: { servername: process.env.SMTP_HOST },
  });
}

// Construye el email del administrador. Exportado para poder probarlo sin enviar.
function buildAdminMail(body, headers) {
  const name = clean(body.name, 120);
  const email = clean(body.email, 160).toLowerCase();
  const phone = clean(body.phone, 40);
  const msg = String(body.msg || "").trim().slice(0, 4000);
  const source = clean(body.source, 500);
  const business = clean(body.business, 120);
  const noWeb = truthy(body.no_web);
  let url = clean(body.url, 300);
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  const necesidad = NECESIDADES[clean(body.necesidad, 60)] || clean(body.necesidad, 60) || "";
  const empresa = clean(body.empresa, 160);

  let leadChannel = "Origen desconocido";
  try {
    const a = JSON.parse(body.attribution);
    if (a && a.session) leadChannel = classifyTouch(a.session);
  } catch (e) { /* sin atribución */ }

  const to = process.env.MAIL_TO || "hola@novamarketing.es";
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "";

  const lines = [
    `NUEVA CONSULTA - ${BRAND}`,
    "================================",
    `Nombre:    ${name}`,
    `Email:     ${email}`,
    `Teléfono:  ${phone || "-"}`,
    `Web:       ${noWeb ? "no tiene web" : (url || "-")}`,
    `Negocio:   ${business || empresa || "-"}`,
  ];
  const objetivo = OBJETIVOS[clean(body.objetivo, 30)] || clean(body.objetivo, 60);
  if (objetivo) lines.push(`Objetivo:  ${objetivo}`);
  if (necesidad) lines.push(`Necesita:  ${necesidad}`);
  lines.push(`Mensaje:   ${msg || "-"}`);
  lines.push(`Página:    ${source || "-"}`);
  lines.push(`Fecha:     ${fmtDate(new Date().toISOString())}`);
  const text = lines.concat(leadSourceBlock(body.attribution, headers["user-agent"], headers["accept-language"])).join("\n");

  return {
    from: `"${BRAND}" <${from}>`,
    sender: process.env.SMTP_USER,
    envelope: { from: process.env.SMTP_USER, to },
    to,
    replyTo: `"${name.replace(/"/g, "")}" <${email}>`,
    subject: `Nueva consulta en ${BRAND} · ${leadChannel}`,
    text,
    leadChannel,
  };
}

function validate(body) {
  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const phone = clean(body.phone, 40);
  const noWeb = truthy(body.no_web);
  const url = clean(body.url, 300);
  const business = clean(body.business, 120);
  const digits = phone.replace(/\D/g, "");
  const errores = [];
  if (!name) errores.push({ campo: "name", mensaje: "El nombre es obligatorio" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push({ campo: "email", mensaje: "El email no es válido" });
  if (!phone || !PHONE_RE.test(phone) || digits.length < 9) errores.push({ campo: "phone", mensaje: "Introduce un teléfono válido (mínimo 9 cifras)" });
  if (!noWeb) {
    if (!url || !URL_RE.test(url)) errores.push({ campo: "url", mensaje: "Introduce una web válida, por ejemplo: miempresa.com" });
  } else if (business.length < 2 || business.length > 120) {
    errores.push({ campo: "business", mensaje: "Indica el nombre del negocio (2 a 120 caracteres)" });
  }
  if (!truthy(body.terms)) errores.push({ campo: "terms", mensaje: "Debes aceptar la política de privacidad" });
  return errores;
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Diagnóstico: GET /api/contacto/?diag=1 comprueba la configuración y la conexión SMTP sin enviar nada.
  if (req.method === "GET" && req.query && req.query.diag === "1") {
    const vars = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_SECURE", "MAIL_FROM", "MAIL_TO"];
    const out = { ok: false, variables: Object.fromEntries(vars.map((v) => [v, Boolean(process.env[v])])),
                  puerto: Number(process.env.SMTP_PORT || 587),
                  secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465 };
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      out.error = "Faltan variables SMTP"; return res.status(200).json(out);
    }
    try { await crearTransporte().verify(); out.ok = true; out.conexion = "SMTP verificado"; }
    catch (err) { out.error = "Fallo de conexión o autenticación SMTP"; out.codigo = err && (err.code || err.responseCode); out.detalle = err && err.message; }
    return res.status(200).json(out);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const body = parseBody(req);
  if (body._honey) return res.status(200).json({ ok: true }); // bot: respondemos como si fuera bien

  const errores = validate(body);
  if (errores.length) {
    return res.status(400).json({ ok: false, error: errores[0].mensaje, campos: errores.map((e) => e.campo), errores });
  }

  const mail = buildAdminMail(body, req.headers || {});

  if (process.env.SMTP_DRY_RUN === "1") {
    console.log("[contacto] DRY RUN:", JSON.stringify({ to: mail.to, subject: mail.subject }));
    return res.status(200).json({ ok: true, dryRun: true, canal: mail.leadChannel });
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("[contacto] Faltan variables SMTP");
    return res.status(500).json({ ok: false, error: "Envío no configurado" });
  }
  try {
    const { leadChannel, ...mensaje } = mail;
    await crearTransporte().sendMail(mensaje);
    return res.status(200).json({ ok: true, canal: leadChannel });
  } catch (err) {
    console.error("[contacto] Error SMTP:", err && err.code, err && err.message, err && err.response);
    return res.status(502).json({ ok: false, error: "No se pudo enviar el correo", codigo: err && (err.code || err.responseCode), detalle: err && (err.response || err.message) });
  }
}

module.exports = handler;
module.exports.buildAdminMail = buildAdminMail;
module.exports.validate = validate;

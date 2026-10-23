// Función serverless de Vercel: recibe el formulario de contacto y lo envía por SMTP.
// Variables de entorno necesarias (Vercel → Settings → Environment Variables):
//   SMTP_HOST    p. ej. smtp.tuproveedor.com
//   SMTP_PORT    587 (STARTTLS) o 465 (SSL)
//   SMTP_USER    usuario SMTP
//   SMTP_PASS    contraseña SMTP
//   SMTP_SECURE  "true" si el puerto es 465; "false" u omitido para 587
//   MAIL_TO      destinatario (por defecto hola@novamarketing.es)
//   MAIL_FROM    remitente, normalmente el mismo buzón SMTP (por defecto el SMTP_USER)
//   SMTP_DRY_RUN "1" para probar sin enviar (solo registra en los logs)

const nodemailer = require("nodemailer");

const MAX = { nombre: 120, empresa: 160, web: 300, telefono: 40, email: 160, necesidad: 60, mensaje: 4000 };
const NECESIDADES = {
  "auditoria-gratuita": "Auditoría SEO inicial gratuita",
  "auditoria-completa": "Auditoría SEO completa (desde 900 €)",
  "consultoria-mensual": "Consultoría SEO mensual (desde 300 € al mes)",
  "proyecto": "Proyecto SEO a medida (a consultar)",
  "no-se": "Todavía no lo sabe",
};

function clean(v, max) {
  return String(v || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body); } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  // Diagnóstico: GET /api/contacto?diag=1 comprueba la configuración y la conexión SMTP sin enviar nada.
  // No devuelve credenciales, solo qué variables existen y el código de error si la conexión falla.
  if (req.method === "GET" && req.query && req.query.diag === "1") {
    const vars = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_SECURE", "MAIL_FROM", "MAIL_TO"];
    const presentes = Object.fromEntries(vars.map((v) => [v, Boolean(process.env[v])]));
    const out = { ok: false, variables: presentes, puerto: Number(process.env.SMTP_PORT || 587),
                  secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465 };
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      out.error = "Faltan variables SMTP"; return res.status(200).json(out);
    }
    try {
      await crearTransporte().verify();
      out.ok = true; out.conexion = "SMTP verificado";
    } catch (err) {
      out.error = "Fallo de conexión o autenticación SMTP"; out.codigo = err && (err.code || err.responseCode); out.detalle = err && err.message;
    }
    return res.status(200).json(out);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const body = parseBody(req);

  // Honeypot: los bots rellenan este campo oculto. Respondemos como si fuera bien.
  if (body._honey) return res.status(200).json({ ok: true });

  const data = {
    nombre: clean(body.nombre, MAX.nombre),
    empresa: clean(body.empresa, MAX.empresa),
    web: clean(body.web, MAX.web),
    telefono: clean(body.telefono, MAX.telefono),
    email: clean(body.email, MAX.email).toLowerCase(),
    necesidad: clean(body.necesidad, MAX.necesidad),
    mensaje: String(body.mensaje || "").trim().slice(0, MAX.mensaje),
    privacidad: body.privacidad === "1" || body.privacidad === "on" || body.privacidad === true,
  };

  // Web: se acepta "tunegocio.es" sin esquema ni www; se normaliza a https:// para el enlace del correo
  if (data.web) {
    const DOMINIO = /^((https?:\/\/)?(www\.)?)?[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)*\.[\p{L}]{2,}(\/\S*)?$/u;
    if (!DOMINIO.test(data.web)) {
      data.webInvalida = true;
    } else if (!/^https?:\/\//i.test(data.web)) {
      data.web = "https://" + data.web;
    }
  }

  const errores = [];
  if (data.webInvalida) errores.push("web");
  if (!data.nombre) errores.push("nombre");
  if (!data.telefono) errores.push("telefono");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errores.push("email");
  if (!data.mensaje) errores.push("mensaje");
  if (!data.privacidad) errores.push("privacidad");
  if (errores.length) return res.status(400).json({ ok: false, error: "Faltan campos", campos: errores });

  const to = process.env.MAIL_TO || "hola@novamarketing.es";
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const necesidad = NECESIDADES[data.necesidad] || data.necesidad || "No indicada";
  const fecha = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();

  const texto = [
    "Nueva solicitud desde sergiogalos.es/contacto/",
    "",
    `Nombre:    ${data.nombre}`,
    `Empresa:   ${data.empresa || "-"}`,
    `Web:       ${data.web || "-"}`,
    `Teléfono:  ${data.telefono}`,
    `Email:     ${data.email}`,
    `Necesita:  ${necesidad}`,
    "",
    "Mensaje:",
    data.mensaje,
    "",
    `Fecha: ${fecha} · IP: ${ip || "-"}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#0b1526;line-height:1.5">
      <p style="font-size:12px;color:#5b6472;margin:0 0 12px">Nueva solicitud desde sergiogalos.es/contacto/</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><td style="color:#5b6472">Nombre</td><td><strong>${esc(data.nombre)}</strong></td></tr>
        <tr><td style="color:#5b6472">Empresa</td><td>${esc(data.empresa || "-")}</td></tr>
        <tr><td style="color:#5b6472">Web</td><td>${data.web ? `<a href="${esc(data.web)}">${esc(data.web)}</a>` : "-"}</td></tr>
        <tr><td style="color:#5b6472">Teléfono</td><td><a href="tel:${esc(data.telefono)}">${esc(data.telefono)}</a></td></tr>
        <tr><td style="color:#5b6472">Email</td><td><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></td></tr>
        <tr><td style="color:#5b6472">Necesita</td><td>${esc(necesidad)}</td></tr>
      </table>
      <p style="margin:16px 0 4px;color:#5b6472">Mensaje</p>
      <p style="white-space:pre-wrap;background:#f6f7f9;padding:12px;border-radius:8px">${esc(data.mensaje)}</p>
      <p style="font-size:12px;color:#5b6472">${esc(fecha)} · IP ${esc(ip || "-")}</p>
    </div>`;

  // El sobre SMTP (MAIL FROM) va siempre con la cuenta autenticada: muchos proveedores rechazan
  // cualquier otro remitente. En la cabecera From se usa MAIL_FROM si existe.
  const mail = {
    from: `"Web sergiogalos.es" <${from}>`,
    sender: process.env.SMTP_USER,
    envelope: { from: process.env.SMTP_USER, to },
    to,
    replyTo: `"${data.nombre.replace(/"/g, "")}" <${data.email}>`,
    subject: `Solicitud SEO · ${data.nombre}${data.empresa ? " · " + data.empresa : ""} · ${necesidad}`,
    text: texto,
    html,
  };

  if (process.env.SMTP_DRY_RUN === "1") {
    console.log("[contacto] DRY RUN, no se envía:", JSON.stringify({ to, subject: mail.subject }));
    return res.status(200).json({ ok: true, dryRun: true });
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !from) {
    console.error("[contacto] Faltan variables SMTP_HOST / SMTP_USER / SMTP_PASS / MAIL_FROM");
    return res.status(500).json({ ok: false, error: "Envío no configurado" });
  }

  try {
    await crearTransporte().sendMail(mail);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[contacto] Error SMTP:", err && err.code, err && err.message, err && err.response);
    return res.status(502).json({ ok: false, error: "No se pudo enviar el correo", codigo: err && (err.code || err.responseCode),
                                  detalle: err && (err.response || err.message) });
  }
};

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

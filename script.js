// sergiogalos.es — interacciones de la landing

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Barra de búsqueda: consultas que escriben tus clientes ---------- */

const DEFAULT_QUERIES = [
  "consultor seo",
  "mi web no aparece en google",
  "cómo salir primero en google",
  "auditoría seo para mi negocio",
  "posicionar mi web en google"
];

const queryEl = document.getElementById("query");

// Cada página puede definir sus propias consultas en data-queries (JSON)
let QUERIES = DEFAULT_QUERIES;
if (queryEl && queryEl.dataset.queries) {
  try {
    const custom = JSON.parse(queryEl.dataset.queries);
    if (Array.isArray(custom) && custom.length) QUERIES = custom;
  } catch (e) { /* se mantienen las consultas por defecto */ }
}

if (queryEl && !reducedMotion) {
  let qIndex = 0;
  let charIndex = QUERIES[0].length;
  let deleting = true;

  const tick = () => {
    const current = QUERIES[qIndex];

    if (deleting) {
      charIndex--;
      queryEl.textContent = current.slice(0, charIndex);
      if (charIndex === 0) {
        deleting = false;
        qIndex = (qIndex + 1) % QUERIES.length;
        setTimeout(tick, 400);
        return;
      }
      setTimeout(tick, 32);
    } else {
      charIndex++;
      queryEl.textContent = QUERIES[qIndex].slice(0, charIndex);
      if (charIndex === QUERIES[qIndex].length) {
        deleting = true;
        setTimeout(tick, 2600);
        return;
      }
      setTimeout(tick, 55 + Math.random() * 60);
    }
  };

  setTimeout(tick, 2200);
}

/* ---------- Formulario de contacto: envío sin recargar ---------- */

const contactForm = document.getElementById("form-contacto");

if (contactForm) {
  const status = contactForm.querySelector(".form-status");
  const submit = contactForm.querySelector(".form-submit");

  // Campo web: basta con un dominio con su extensión (tunegocio.es); http, https y www son opcionales
  const webField = contactForm.elements.web;
  if (webField) {
    const DOMINIO = /^\s*((https?:\/\/)?(www\.)?)?[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)*\.[\p{L}]{2,}(\/\S*)?\s*$/u;
    const validarWeb = () => {
      const v = webField.value.trim();
      webField.setCustomValidity(v && !DOMINIO.test(v) ? "Escribe tu dominio, por ejemplo tunegocio.es" : "");
    };
    webField.addEventListener("input", validarWeb);
    webField.addEventListener("blur", () => { validarWeb(); webField.value = webField.value.trim(); });
  }

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "form-status";

    if (!contactForm.checkValidity()) {
      contactForm.reportValidity();
      return;
    }
    if (contactForm.elements._honey && contactForm.elements._honey.value) return; // bot

    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = "Enviando…";

    const data = {};
    new FormData(contactForm).forEach((v, k) => { data[k] = v; });

    try {
      const res = await fetch(contactForm.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        let codigo = "";
        try { const j = await res.json(); codigo = j.codigo ? " (" + j.codigo + ")" : ""; } catch (e) { /* sin cuerpo */ }
        throw new Error("HTTP " + res.status + codigo);
      }
      status.textContent = "Recibido. Te respondo personalmente en menos de 24 horas laborables.";
      status.classList.add("is-ok");
      contactForm.reset();
      if (window.dataLayer) window.dataLayer.push({ event: "form_contacto_enviado" });
    } catch (err) {
      status.textContent = "No se ha podido enviar. Llámame al 644 738 270 o escríbeme por WhatsApp." + (err && /\(/.test(err.message) ? " Código: " + err.message.replace(/^HTTP \d+ /, "") : "");
      status.classList.add("is-err");
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}

/* ---------- Nav: línea inferior al hacer scroll ---------- */

const nav = document.getElementById("nav");

const onScroll = () => {
  nav.classList.toggle("scrolled", window.scrollY > 8);
};

window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- Aparición al hacer scroll ---------- */

const revealEls = document.querySelectorAll(".reveal");

if (reducedMotion || !("IntersectionObserver" in window)) {
  revealEls.forEach((el) => el.classList.add("visible"));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  revealEls.forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    io.observe(el);
  });
}

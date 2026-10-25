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

/* ---------- Web obligatoria con casilla "No tengo web" (todos los formularios con input[name="url"]) ---------- */

(function () {
  var URL_RE = /^(https?:\/\/)?(www\.)?([a-z0-9áéíóúàèòïüñç-]+\.)+[a-z]{2,24}(:\d{2,5})?(\/\S*)?$/i;
  var ca = (document.documentElement.lang || "es").toLowerCase().indexOf("ca") === 0;
  var T = ca
    ? { noweb: "No tinc web", business: "Nom del negoci *", invalid: "Introdueix una web vàlida, per exemple: lamevaempresa.com" }
    : { noweb: "No tengo web", business: "Nombre del negocio *", invalid: "Introduce una web válida, por ejemplo: miempresa.com" };

  var forms = document.querySelectorAll("form");
  for (var i = 0; i < forms.length; i++) {
    (function (form) {
      var url = form.querySelector('input[name="url"]');
      if (!url || form.hasAttribute("data-wizard")) return;
      var formId = form.id || "form";

      url.required = true;
      url.setAttribute("autocomplete", "url");
      url.setAttribute("inputmode", "url");
      if (!url.placeholder) url.placeholder = "www.miempresa.com";
      var field = url.closest(".field") || url.parentNode;
      var labelText = field.querySelector("span");
      if (labelText && !/\*\s*$/.test(labelText.textContent)) labelText.textContent = labelText.textContent.replace(/\s*$/, "") + " *";

      var validar = function () {
        var v = url.value.trim();
        url.setCustomValidity(v && !URL_RE.test(v) ? T.invalid : "");
      };
      url.addEventListener("input", validar);
      url.addEventListener("blur", function () { url.value = url.value.trim(); validar(); });

      // Casilla "No tengo web"
      var check = document.createElement("label");
      check.className = "field field-check field-noweb";
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.name = "no_web"; cb.value = "1"; cb.id = formId + "-no-web";
      var cbText = document.createElement("span"); cbText.textContent = T.noweb;
      check.appendChild(cb); check.appendChild(cbText);

      // Campo "Nombre del negocio" (oculto hasta marcar la casilla)
      var biz = document.createElement("label");
      biz.className = "field field-business";
      biz.hidden = true;
      var bizText = document.createElement("span"); bizText.textContent = T.business;
      var bizInput = document.createElement("input");
      bizInput.type = "text"; bizInput.name = "business"; bizInput.maxLength = 120;
      bizInput.setAttribute("autocomplete", "organization"); bizInput.disabled = true;
      biz.appendChild(bizText); biz.appendChild(bizInput);

      field.insertAdjacentElement("afterend", check);
      check.insertAdjacentElement("afterend", biz);

      var toggle = function () {
        var on = cb.checked;
        field.hidden = on; url.disabled = on; url.required = !on;
        if (on) url.setCustomValidity("");
        biz.hidden = !on; bizInput.disabled = !on; bizInput.required = on;
      };
      cb.addEventListener("change", toggle);
      toggle();
    })(forms[i]);
  }
})();

/* ---------- Formulario por pasos (data-wizard) ---------- */

(function () {
  var form = document.querySelector("form[data-wizard]");
  if (!form) return;
  var URL_RE = /^(https?:\/\/)?(www\.)?([a-z0-9áéíóúàèòïüñç-]+\.)+[a-z]{2,24}(:\d{2,5})?(\/\S*)?$/i;
  var steps = form.querySelectorAll(".wizard-step");
  var bars = form.querySelectorAll(".wizard-progress i");
  var url = form.querySelector('input[name="url"]');
  var biz = form.querySelector('input[name="business"]');
  var noWeb = form.querySelector('input[name="no_web"]');
  var title1 = steps[0].querySelector(".wizard-title");
  var next1 = steps[0].querySelector(".wizard-next");
  var current = 1;

  function show(n) {
    current = n;
    for (var i = 0; i < steps.length; i++) steps[i].classList.toggle("is-active", i === n - 1);
    for (var j = 0; j < bars.length; j++) bars[j].classList.toggle("is-on", j < n);
    var first = steps[n - 1].querySelector("input:not([type=hidden]):not([disabled]):not(.hp)");
    if (first && first.type !== "radio" && first.type !== "checkbox") setTimeout(function () { first.focus(); }, 30);
  }
  function err(n, msg) { steps[n - 1].querySelector(".wizard-error").textContent = msg || ""; }

  function toggleNoWeb() {
    var on = noWeb.checked;
    url.closest(".field").hidden = on; url.disabled = on; url.required = !on;
    biz.closest(".field").hidden = !on; biz.disabled = !on; biz.required = on;
    title1.textContent = on ? title1.getAttribute("data-title-noweb") : title1.getAttribute("data-title-web");
    next1.textContent = on ? "Continuar →" : "Analizar mi web →";
    err(1, "");
    (on ? biz : url).focus();
  }
  noWeb.addEventListener("change", toggleNoWeb);

  function validStep1() {
    if (noWeb.checked) {
      var b = biz.value.trim();
      if (b.length < 2) { err(1, "Escribe el nombre de tu negocio"); biz.focus(); return false; }
    } else {
      var u = url.value.trim(); url.value = u;
      if (!URL_RE.test(u)) { err(1, "Introduce una web válida, por ejemplo: miempresa.com"); url.focus(); return false; }
    }
    err(1, ""); return true;
  }

  next1.addEventListener("click", function () { if (validStep1()) show(2); });
  [url, biz].forEach(function (el) {
    el.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); next1.click(); } });
  });

  var radios = form.querySelectorAll('input[name="objetivo"]');
  for (var r = 0; r < radios.length; r++) radios[r].addEventListener("change", function () { err(2, ""); show(3); });

  var backs = form.querySelectorAll(".wizard-back");
  for (var k = 0; k < backs.length; k++) backs[k].addEventListener("click", function () { show(Math.max(1, current - 1)); });

  // Si el envío llega con algo inválido de pasos anteriores, vuelve a ese paso
  form.addEventListener("submit", function (e) {
    if (!validStep1()) { e.preventDefault(); e.stopImmediatePropagation(); show(1); return; }
    if (!form.querySelector('input[name="objetivo"]:checked')) { e.preventDefault(); e.stopImmediatePropagation(); show(2); err(2, "Elige una opción"); }
  }, true);


  show(1);
})();

/* ---------- Formulario de contacto: envío sin recargar ---------- */

const contactForm = document.getElementById("form-contacto");

if (contactForm) {
  const status = contactForm.querySelector(".form-status");
  const submit = contactForm.querySelector(".form-submit");

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
        let detalle = "";
        try { const j = await res.json(); detalle = j.error ? j.error + (j.codigo ? " (" + j.codigo + ")" : "") : (j.codigo ? "(" + j.codigo + ")" : ""); } catch (e) { /* sin cuerpo */ }
        throw new Error("HTTP " + res.status + (detalle ? " " + detalle : ""));
      }
      status.textContent = "Recibido. Te respondo personalmente en menos de 24 horas laborables.";
      status.classList.add("is-ok");
      var eventId = (contactForm.elements.eventId && contactForm.elements.eventId.value) || "";
      try { sessionStorage.setItem("sg_lead_ok", JSON.stringify({ t: Date.now(), page: location.pathname, eventId: eventId })); } catch (e) {}
      if (window.dataLayer) window.dataLayer.push({ event: "form_contacto_enviado", event_id: eventId, form_page: location.pathname });
      contactForm.reset();
      window.location.href = "/gracias/";
    } catch (err) {
      const srv = err && err.message ? err.message.replace(/^HTTP (\d+)\s?/, "") : "";
      status.textContent = (/^HTTP 400/.test(err && err.message) && srv)
        ? srv
        : "No se ha podido enviar. Llámame al 644 738 270 o escríbeme por WhatsApp." + (srv ? " " + srv : "");
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

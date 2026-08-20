// sergiogalos.es — interacciones de la landing

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Barra de búsqueda: consultas que escriben tus clientes ---------- */

const QUERIES = [
  "consultor seo",
  "mi web no aparece en google",
  "cómo salir primero en google",
  "auditoría seo para mi negocio",
  "posicionar mi web en google"
];

const queryEl = document.getElementById("query");

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

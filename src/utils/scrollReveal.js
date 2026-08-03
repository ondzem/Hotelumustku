// Jemné naskakování prvků při scrollování.
// Každý prvek se animuje POUZE JEDNOU za načtení stránky.

let observer = null;

export const initScrollReveal = () => {
  // Starý prohlížeč bez podpory → nic neskrýváme
  if (!('IntersectionObserver' in window)) {
    document.documentElement.classList.remove('anim-ready');
    return;
  }

  document.documentElement.classList.add('anim-ready');

  if (observer) observer.disconnect();

  observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      obs.unobserve(e.target);   // ← klíčové: podruhé už se nespustí
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -10% 0px'   // spustí se, až prvek vjede do okna
  });

  document.querySelectorAll('[data-anim]:not(.is-in)').forEach((el) => {
    // Postupné naskakování uvnitř skupiny (karty, ikony, odrážky)
    const skupina = el.closest('[data-anim-group]');
    if (skupina) {
      const sourozenci = [...skupina.querySelectorAll('[data-anim]')];
      const poradi = sourozenci.indexOf(el);
      el.style.transitionDelay = (Math.min(poradi, 6) * 0.09).toFixed(2) + 's';
    }
    observer.observe(el);
  });
};

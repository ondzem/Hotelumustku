// Jemné naskakování prvků při scrollování.
// Každý prvek se animuje POUZE JEDNOU za načtení stránky.

let observer = null;

const odhalit = (el) => {
  // Skupina se odhalí jako celek — i karty odsunuté vodorovně
  // mimo okno (karusely) tak naskočí ve správném pořadí.
  if (el.hasAttribute('data-anim-group')) {
    el.classList.add('anim-group-done');
    [...el.querySelectorAll('[data-anim]')].forEach((dite, i) => {
      dite.style.transitionDelay = (Math.min(i, 6) * 0.16).toFixed(2) + 's';
      dite.classList.add('is-in');
    });
    return;
  }
  el.classList.add('is-in');
};

export const initScrollReveal = () => {
  if (!('IntersectionObserver' in window)) {
    document.documentElement.classList.remove('anim-ready');
    return;
  }

  document.documentElement.classList.add('anim-ready');

  if (observer) observer.disconnect();

  observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      odhalit(e.target);
      obs.unobserve(e.target);
    });
  }, {
    threshold: 0,
    rootMargin: '0px 0px -22% 0px'
  });

  // 1) Skupiny — spouští se jako jeden celek
  document.querySelectorAll('[data-anim-group]:not(.anim-group-done)')
    .forEach((g) => observer.observe(g));

  // 2) Samostatné prvky, které do žádné skupiny nepatří
  document.querySelectorAll('[data-anim]:not(.is-in)').forEach((el) => {
    if (el.closest('[data-anim-group]')) return;
    observer.observe(el);
  });

  // Pojistka: obsah dodaný ze serveru až po prvním běhu
  if (!window.__animLoadHook) {
    window.__animLoadHook = true;
    window.addEventListener('load', () => {
      setTimeout(initScrollReveal, 300);
    });
  }
};

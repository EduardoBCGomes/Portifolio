(function () {
  'use strict';

  const preloader = document.getElementById('eb-preloader');

  if (!preloader) {
    window.portfolioPreloader = { done: Promise.resolve() };
    return;
  }

  const logo = document.getElementById('eb-logo');
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const MIN_VISIVEL = reduzido ? 0 : 1100;
  const MAX_ESPERA  = 5000;
  const SAIDA       = reduzido ? 120 : 700;

  document.documentElement.classList.add('is-loading');

  let resolver;
  const done = new Promise((r) => { resolver = r; });
  window.portfolioPreloader = { done };

  const inicio = performance.now();

  const fonteEmCena = (document.fonts && document.fonts.ready)
    ? document.fonts.ready.catch(() => {})
    : Promise.resolve();

  fonteEmCena.then(() => logo && logo.classList.add('eb-in'));

  const paginaCarregada = new Promise((r) => {
    if (document.readyState === 'complete') return r();
    window.addEventListener('load', r, { once: true });
  });

  const teto = new Promise((r) => setTimeout(r, MAX_ESPERA));

  Promise.race([Promise.all([paginaCarregada, fonteEmCena]), teto])
    .then(() => {
      const decorrido = performance.now() - inicio;
      const restante = Math.max(0, MIN_VISIVEL - decorrido);
      return new Promise((r) => setTimeout(r, restante));
    })
    .then(sair);

  function sair() {
    if (logo) {
      logo.classList.remove('eb-in');
      logo.classList.add('eb-hide');
    }
    preloader.classList.add('eb-out');
    document.documentElement.classList.remove('is-loading');

    setTimeout(() => {
      preloader.remove();
      resolver();
    }, SAIDA);
  }
})();

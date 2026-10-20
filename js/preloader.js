(function () {
  'use strict';

  const preloader = document.getElementById('eb-preloader');

  if (!preloader) {
    window.portfolioPreloader = { done: Promise.resolve() };
    return;
  }

  const logo = document.getElementById('eb-logo');
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 800 ms bastam para o "EB" ser lido; cada milissegundo aqui atrasa o
  // primeiro conteúdo (LCP), que o Google usa no ranking
  const MIN_VISIVEL = reduzido ? 0 : 800;
  const MAX_ESPERA  = 5000;
  const SAIDA       = reduzido ? 120 : 700;

  document.documentElement.classList.add('is-loading');

  let resolver;
  const done = new Promise((r) => { resolver = r; });
  window.portfolioPreloader = { done };

  const inicio = performance.now();

  // Espera a fonte do monograma de verdade: o document.fonts.ready lido
  // aqui resolvia antes de a Archivo Black ser pedida, e o "EB" entrava
  // com a fonte reserva e trocava no meio da animação.
  const fonteEmCena = (document.fonts && document.fonts.load)
    ? Promise.race([
        document.fonts.load('1em "Archivo Black"', 'EB').catch(() => {}),
        new Promise((r) => setTimeout(r, 1500))
      ])
    : Promise.resolve();

  fonteEmCena.then(() => logo && logo.classList.add('eb-in'));

  // A cortina sai quando a primeira tela está pronta: estrutura da página e
  // foto do topo. Esperar o "load" inteiro (imagens dos projetos, fontes de
  // outras seções) segurava o primeiro conteúdo à toa em rede lenta.
  const estruturaPronta = new Promise((r) => {
    if (document.readyState !== 'loading') return r();
    document.addEventListener('DOMContentLoaded', r, { once: true });
  });

  const fotoTopo = document.querySelector('.hero__photo');
  const fotoPronta = new Promise((r) => {
    if (!fotoTopo || fotoTopo.complete) return r();
    fotoTopo.addEventListener('load', r, { once: true });
    fotoTopo.addEventListener('error', r, { once: true });
  });

  const teto = new Promise((r) => setTimeout(r, MAX_ESPERA));

  Promise.race([Promise.all([estruturaPronta, fotoPronta, fonteEmCena]), teto])
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

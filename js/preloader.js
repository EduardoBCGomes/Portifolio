(function () {
  'use strict';

  const preloader = document.getElementById('eb-preloader');

  if (!preloader) {
    window.portfolioPreloader = { done: Promise.resolve() };
    return;
  }

  const logo = document.getElementById('eb-logo');
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // O "EB" entra em 0,5 s e precisa de um instante parado para ser lido;
  // cada milissegundo a mais aqui atrasa o primeiro conteúdo da página
  const MIN_VISIVEL = reduzido ? 0 : 650;
  const MAX_ESPERA  = 5000;
  const SAIDA       = reduzido ? 120 : 500;

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

  // As fontes do texto também: prontas antes de a cortina sair, o texto
  // nunca aparece numa fonte reserva e troca de desenho na frente da pessoa.
  // Elas são do próprio site e já começam a baixar no <head> (preload).
  const fontesTexto = (document.fonts && document.fonts.load)
    ? Promise.race([
        Promise.all([
          document.fonts.load('700 1em "Space Grotesk"'),
          document.fonts.load('400 1em "Inter"')
        ]).catch(() => {}),
        new Promise((r) => setTimeout(r, 2000))
      ])
    : Promise.resolve();

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

  Promise.race([Promise.all([estruturaPronta, fotoPronta, fonteEmCena, fontesTexto]), teto])
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

    // A entrada do topo começa junto com a cortina saindo: antes ela só
    // começava depois do fade inteiro, e as duas etapas somavam ~1,5 s.
    resolver();
    setTimeout(() => preloader.remove(), SAIDA);
  }
})();

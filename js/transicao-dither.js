(function () {
  'use strict';

  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TITULO_Y = 100;
  const CELULA = 5;
  const COBRIR = 0.5;
  const REVELAR = 0.6;

  const BAYER = [
     0, 32,  8, 40,  2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44,  4, 36, 14, 46,  6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
     3, 35, 11, 43,  1, 33,  9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47,  7, 39, 13, 45,  5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  ].map((v) => v / 64);

  const CREME = [236, 232, 225];
  const CINZA = [61, 57, 52];
  const FUNDO = [12, 10, 9];

  const tela = document.createElement('canvas');
  tela.className = 'transicao-dither';
  tela.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tela);
  const ctx = tela.getContext('2d');

  const mini = document.createElement('canvas');
  const mctx = mini.getContext('2d');
  let img = null;
  let posicoes = null;
  let bayers = null;
  let nx = null;
  let ny = null;
  let colunas = 0;
  let linhas = 0;
  let ocupado = false;

  const AMEBA = 0.17;
  const PESO_BAYER = 0.12;

  function medir(subindo) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    tela.width = w;
    tela.height = h;
    colunas = Math.ceil(w / CELULA);
    linhas = Math.ceil(h / CELULA);
    mini.width = colunas;
    mini.height = linhas;
    img = mctx.createImageData(colunas, linhas);
    const total = colunas * linhas;
    posicoes = new Float32Array(total);
    bayers = new Float32Array(total);
    nx = new Float32Array(total);
    ny = new Float32Array(total);
    for (let y = 0; y < linhas; y++) {
      const v = y / (linhas - 1 || 1);
      for (let x = 0; x < colunas; x++) {
        const u = x / (colunas - 1 || 1);
        const i = y * colunas + x;
        posicoes[i] = subindo ? (u + (1 - v)) / 2 : ((1 - u) + v) / 2;
        bayers[i] = BAYER[(y & 7) * 8 + (x & 7)];
        nx[i] = u * (w / h);
        ny[i] = v;
      }
    }
  }

  function limiar(i, t) {
    const x = nx[i];
    const y = ny[i];
    const onda =
      0.5 * Math.sin(x * 3.1 + y * 2.4 + t * 1.6) +
      0.3 * Math.sin(x * 5.3 - y * 4.7 - t * 2.1) +
      0.2 * Math.sin(-x * 8.9 + y * 7.6 + t * 2.9);
    const base = posicoes[i] + onda * AMEBA;
    const p = 1 - PESO_BAYER;
    return (base * p + bayers[i] * PESO_BAYER + AMEBA * p) / (1 + AMEBA * 2 * p);
  }

  function pintar(progresso, cobrindo) {
    const dados = img.data;
    const t = performance.now() / 1000;
    for (let i = 0; i < posicoes.length; i++) {
      const lim = limiar(i, t);
      const d = cobrindo ? progresso * 1.12 - lim : lim - (progresso * 1.12 - 0.12);
      const o = i * 4;
      if (d < 0) { dados[o + 3] = 0; continue; }
      const cor = d < 0.025 ? CREME : d < 0.06 ? CINZA : FUNDO;
      dados[o] = cor[0];
      dados[o + 1] = cor[1];
      dados[o + 2] = cor[2];
      dados[o + 3] = 255;
    }
    mctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, tela.width, tela.height);
    ctx.drawImage(mini, 0, 0, colunas * CELULA, linhas * CELULA);
  }

  function animar(duracao, cobrindo) {
    const st = { p: 0 };
    return new Promise((pronto) => {
      gsap.to(st, {
        p: 1,
        duration: duracao,
        ease: cobrindo ? 'power2.in' : 'power2.out',
        onUpdate: () => pintar(st.p, cobrindo),
        onComplete: pronto
      });
    });
  }

  function destinoDe(link) {
    const id = link.getAttribute('href');
    if (id === '#hero') return { alvo: document.getElementById('hero'), topo: 0 };
    const alvo = document.querySelector(id);
    if (!alvo) return null;
    const inicio = alvo.getBoundingClientRect().top + window.scrollY;
    const respiro = parseFloat(getComputedStyle(alvo).paddingTop) || 0;
    const maximo = document.documentElement.scrollHeight - window.innerHeight;
    return { alvo, topo: Math.round(Math.min(maximo, Math.max(0, inicio + respiro - TITULO_Y))) };
  }

  async function saltar(link, peloTeclado) {
    const destino = destinoDe(link);
    if (!destino) return;
    const { alvo, topo } = destino;
    const menu = link.closest('.staggered-menu-panel') ? window.portfolioStaggeredMenu : null;

    if (reduzido.matches || Math.abs(topo - window.scrollY) < window.innerHeight * 0.6) {
      menu?.close();
      window.scrollTo({ top: topo, behavior: reduzido.matches ? 'auto' : 'smooth' });
    } else {
      ocupado = true;
      medir(topo < window.scrollY);
      tela.classList.add('is-ativa');
      await animar(COBRIR, true);
      if (menu) {
        menu.close();
        const partes = document.querySelectorAll(
          '.staggered-menu-wrapper, .staggered-menu-wrapper *, .sm-toggle, .sm-toggle *'
        );
        gsap.getTweensOf(partes).forEach((tw) => tw.progress(1));
      }
      window.portfolioTitulos?.antesDoSalto(alvo);
      window.scrollTo({ top: topo, behavior: 'instant' });
      if (window.ScrollTrigger) ScrollTrigger.update();
      setTimeout(() => window.portfolioTitulos?.depoisDoSalto(alvo), 220);
      await animar(REVELAR, false);
      tela.classList.remove('is-ativa');
      ctx.clearRect(0, 0, tela.width, tela.height);
      ocupado = false;
    }

    if (peloTeclado) {
      if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
      alvo.focus({ preventScroll: true });
    }
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-transicao]');
    if (!link || typeof gsap === 'undefined') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (ocupado) return;
    saltar(link, e.detail === 0);
  }, true);
})();

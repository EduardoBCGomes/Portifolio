(function () {
  'use strict';

  const BAYER = [
     0, 32,  8, 40,  2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44,  4, 36, 14, 46,  6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
     3, 35, 11, 43,  1, 33,  9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47,  7, 39, 13, 45,  5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  ].map((v) => (v + 0.5) / 64);

  const CREME = [236, 232, 225];
  const CINZA = [61, 57, 52];
  const FUNDO = [12, 10, 9];
  const OCULTO = 'linear-gradient(transparent, transparent)';
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cache = new Map();

  function ativo() {
    return typeof gsap !== 'undefined' &&
      !reduzido.matches &&
      !document.documentElement.classList.contains('sem-movimento');
  }

  function mascara(el, valor) {
    el.style.webkitMaskImage = valor;
    el.style.maskImage = valor;
  }

  function esconder(el) {
    if (!el) return;
    mascara(el, OCULTO);
    el.style.webkitMaskSize = '100% 100%';
    el.style.maskSize = '100% 100%';
  }

  function limpar(el) {
    if (!el) return;
    mascara(el, 'none');
  }

  function parar(el) {
    if (el.__revelar) { el.__revelar.kill(); el.__revelar = null; }
    if (el.__revelarFim) { el.__revelarFim(); el.__revelarFim = null; }
  }

  function textura(chave, largura, altura, pintar) {
    if (cache.has(chave)) return cache.get(chave);
    const c = document.createElement('canvas');
    c.width = largura;
    c.height = altura;
    pintar(c.getContext('2d'));
    const url = c.toDataURL();
    cache.set(chave, url);
    return url;
  }

  function cor(texto) {
    const m = texto.match(/\d+(\.\d+)?/g);
    return m ? `rgb(${m[0]}, ${m[1]}, ${m[2]})` : 'rgb(236, 232, 225)';
  }

  function revelarTexto(el, { duracao = 0.9, ease = 'power2.out' } = {}) {
    if (!el) return Promise.resolve();
    parar(el);
    limpar(el);
    if (!ativo()) return Promise.resolve();

    const w = el.offsetWidth;
    if (!w) return Promise.resolve();

    const c = 4;
    const faixa = Math.max(c * 12, Math.round(w * 0.24));
    const total = w * 2 + faixa;
    const lado = c * 8;
    const tinta = cor(getComputedStyle(el).color);
    const passos = Math.ceil(faixa / c);
    const url = textura(['texto', w, faixa, tinta].join(':'), total, lado, (g) => {
      g.fillStyle = tinta;
      g.fillRect(0, 0, w, lado);
      for (let k = 0; k < passos; k++) {
        const u = (k + 0.5) / passos;
        for (let j = 0; j < 8; j++) {
          const t = BAYER[j * 8 + (k & 7)];
          if (u < t) { g.fillStyle = tinta; g.fillRect(w + k * c, j * c, c, c); }
          else if (u < t + 0.14) { g.fillStyle = 'rgb(250, 249, 246)'; g.fillRect(w + k * c, j * c, c, c); }
        }
      }
    });

    const s = el.style;
    Object.assign(s, {
      backgroundImage: `url(${url})`,
      backgroundRepeat: 'repeat-y',
      backgroundSize: `${total}px ${lado}px`,
      webkitBackgroundClip: 'text',
      backgroundClip: 'text',
      webkitTextFillColor: 'transparent',
      backgroundPosition: `${-(w + faixa)}px 0px`
    });

    const fim = () => {
      for (const p of ['backgroundImage', 'backgroundRepeat', 'backgroundSize', 'webkitBackgroundClip', 'backgroundClip', 'webkitTextFillColor', 'backgroundPosition']) s[p] = '';
    };
    el.__revelarFim = fim;
    const estado = { p: -(w + faixa) };
    return new Promise((pronto) => {
      el.__revelar = gsap.to(estado, {
        p: 0,
        duration: duracao,
        ease,
        onUpdate: () => { s.backgroundPosition = `${estado.p}px 0px`; },
        onComplete: () => { fim(); el.__revelar = null; el.__revelarFim = null; pronto(); }
      });
    });
  }

  function revelarBloco(el, { duracao = 1.15, ease = 'power2.inOut', de = 'baixo' } = {}) {
    if (!el) return Promise.resolve();
    parar(el);
    if (!ativo()) { limpar(el); return Promise.resolve(); }

    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const pai = el.parentElement;
    if (!w || !h || !pai) { limpar(el); return Promise.resolve(); }
    if (getComputedStyle(pai).position === 'static') pai.style.position = 'relative';

    const celula = window.innerWidth < 700 ? 4 : 5;
    const colunas = Math.ceil(w / celula);
    const linhas = Math.ceil(h / celula);
    const total = colunas * linhas;

    const tela = document.createElement('canvas');
    tela.className = 'revelar-camada';
    tela.setAttribute('aria-hidden', 'true');
    tela.width = colunas;
    tela.height = linhas;
    Object.assign(tela.style, {
      left: `${el.offsetLeft}px`,
      top: `${el.offsetTop}px`,
      width: `${w}px`,
      height: `${h}px`,
      borderRadius: getComputedStyle(el).borderRadius
    });
    const ctx = tela.getContext('2d');
    const img = ctx.createImageData(colunas, linhas);
    const px = new Uint32Array(img.data.buffer);
    const pack = (k) => (255 << 24 | k[2] << 16 | k[1] << 8 | k[0]) >>> 0;
    const C_CREME = pack(CREME);
    const C_CINZA = pack(CINZA);
    const C_FUNDO = pack(FUNDO);

    const lim = new Float32Array(total);
    const fase = new Float32Array(total);
    for (let y = 0; y < linhas; y++) {
      for (let x = 0; x < colunas; x++) {
        const i = y * colunas + x;
        const v = linhas > 1 ? y / (linhas - 1) : 0;
        const pos = de === 'baixo' ? 1 - v : v;
        lim[i] = pos * 0.8 + BAYER[(y & 7) * 8 + (x & 7)] * 0.2;
        fase[i] = x / colunas;
      }
    }

    const BANDA = 0.2;
    function pintar(p) {
      const q = p * (1 + BANDA + 0.06) - BANDA;
      const t = performance.now() / 1000;
      for (let i = 0; i < total; i++) {
        const onda = Math.sin(fase[i] * 9 + t * 2.4) * 0.025 + Math.sin(fase[i] * 23 - t * 3.1) * 0.012;
        const e = lim[i] + onda - q;
        px[i] = e < 0 ? 0 : e < 0.03 ? C_CREME : e < 0.075 ? C_CINZA : C_FUNDO;
      }
      ctx.putImageData(img, 0, 0);
    }

    pintar(0);
    pai.appendChild(tela);
    limpar(el);

    const fim = () => tela.remove();
    el.__revelarFim = fim;
    const estado = { p: 0 };
    return new Promise((pronto) => {
      el.__revelar = gsap.to(estado, {
        p: 1,
        duration: duracao,
        ease,
        onUpdate: () => pintar(estado.p),
        onComplete: () => { fim(); el.__revelar = null; el.__revelarFim = null; pronto(); }
      });
    });
  }

  function animarMascara(el, { duracao = 0.4, ease = 'power2.inOut', sumir = false } = {}) {
    if (!el) return Promise.resolve();
    parar(el);
    if (!ativo()) { sumir ? esconder(el) : limpar(el); return Promise.resolve(); }

    const w = el.offsetWidth;
    if (!w) { sumir ? esconder(el) : limpar(el); return Promise.resolve(); }

    const c = 4;
    const faixa = Math.max(c * 10, Math.round(w * 0.26));
    const total = w * 2 + faixa;
    const lado = c * 8;
    const passos = Math.ceil(faixa / c);
    const url = textura(['mascara', w, faixa].join(':'), total, lado, (g) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, lado);
      for (let k = 0; k < passos; k++) {
        const u = (k + 0.5) / passos;
        for (let j = 0; j < 8; j++) {
          if (u < BAYER[j * 8 + (k & 7)]) g.fillRect(w + k * c, j * c, c, c);
        }
      }
    });

    mascara(el, `url(${url})`);
    el.style.webkitMaskRepeat = 'repeat-y';
    el.style.maskRepeat = 'repeat-y';
    el.style.webkitMaskSize = `${total}px ${lado}px`;
    el.style.maskSize = `${total}px ${lado}px`;

    const fechado = -(w + faixa);
    const estado = { p: sumir ? 0 : fechado };
    const posicionar = () => {
      el.style.webkitMaskPosition = `${estado.p}px 0px`;
      el.style.maskPosition = `${estado.p}px 0px`;
    };
    posicionar();
    return new Promise((pronto) => {
      el.__revelar = gsap.to(estado, {
        p: sumir ? fechado : 0,
        duration: duracao,
        ease,
        onUpdate: posicionar,
        onComplete: () => { el.__revelar = null; sumir ? esconder(el) : limpar(el); pronto(); }
      });
    });
  }

  window.portfolioRevelar = {
    ativo,
    esconder,
    limpar,
    revelarTexto,
    revelarBloco,
    revelar: (el, opcoes) => animarMascara(el, { ...opcoes, sumir: false }),
    sumir: (el, opcoes) => animarMascara(el, { ...opcoes, sumir: true })
  };
})();

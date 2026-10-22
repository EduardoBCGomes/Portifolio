(function () {
  'use strict';

  const raiz = document.documentElement;
  const cortina = document.getElementById('eb-preloader');

  let liberar;
  const done = new Promise((r) => { liberar = r; });
  window.portfolioPreloader = { done };

  function soltarSemAnimacao() {
    cortina?.remove();
    raiz.classList.remove('is-loading');
    liberar();
  }
  if (!cortina || typeof gsap === 'undefined') { soltarSemAnimacao(); return; }

  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN_VISIVEL = 900;
  const MAX_ESPERA = 5000;

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

  const CREME = [250, 249, 246];
  const CINZA = [61, 57, 52];
  const BRASA = [33, 30, 27];
  const GRAO = [24, 21, 19];
  const FUNDO = [12, 10, 9];

  const W = window.innerWidth;
  const H = window.innerHeight;
  const CELULA = W < 700 ? 4 : 5;
  const colunas = Math.ceil(W / CELULA);
  const linhas = Math.ceil(H / CELULA);
  const total = colunas * linhas;

  const tela = document.createElement('canvas');
  tela.className = 'revelar';
  tela.setAttribute('aria-hidden', 'true');
  tela.width = W;
  tela.height = H;
  document.body.appendChild(tela);
  raiz.classList.add('is-loading');

  function comecarAPintar() {
    gsap.ticker.add(desenhar);
  }

  const ctx = tela.getContext('2d', { willReadFrequently: true });
  const mini = document.createElement('canvas');
  mini.width = colunas;
  mini.height = linhas;
  const mctx = mini.getContext('2d', { willReadFrequently: true });
  const img = mctx.createImageData(colunas, linhas);
  const px32 = new Uint32Array(img.data.buffer);
  const cor32 = (c) => (255 << 24 | c[2] << 16 | c[1] << 8 | c[0]) >>> 0;

  const fsTela = Math.round(Math.min(220, Math.max(96, W * 0.2)));
  const fs = fsTela / CELULA;
  const cx = colunas / 2;
  const base = Math.round(linhas / 2 + fs * 0.36);
  const cy = base - fs * 0.36;
  let logo = new Float32Array(total);
  let halo = new Float32Array(total);

  function desenharMascaras() {
    const c = document.createElement('canvas');
    c.width = colunas;
    c.height = linhas;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.font = `${fs}px "Archivo Black", "Archivo", sans-serif`;
    g.textBaseline = 'alphabetic';
    const le = g.measureText('E').width;
    const lb = g.measureText('B').width;
    const x0 = cx - (le + lb) / 2;
    const tracar = () => {
      g.fillStyle = '#fff';
      g.strokeStyle = '#fff';
      g.lineWidth = Math.max(1, fs * 0.045);
      g.fillText('E', x0, base);
      g.strokeText('B', x0 + le, base);
    };
    tracar();
    let d = g.getImageData(0, 0, colunas, linhas).data;
    for (let i = 0; i < total; i++) logo[i] = d[i * 4 + 3] / 255;

    g.clearRect(0, 0, colunas, linhas);
    g.filter = `blur(${Math.max(2, fs * 0.28)}px)`;
    g.font = `${fs}px "Archivo Black", "Archivo", sans-serif`;
    g.fillStyle = '#fff';
    g.fillText('E', x0, base);
    g.fillText('B', x0 + le, base);
    g.fillText('E', x0, base);
    d = g.getImageData(0, 0, colunas, linhas).data;
    for (let i = 0; i < total; i++) halo[i] = Math.min(1, (d[i * 4 + 3] / 255) * 1.6);

    caixaLogo = caixa(logo, 0.01);
    caixaHalo = caixa(halo, 0.02);
    return { x0, largura: le + lb };
  }

  function caixa(mascara, minimo) {
    let x0 = colunas, x1 = -1, y0 = linhas, y1 = -1;
    for (let y = 0; y < linhas; y++) {
      for (let x = 0; x < colunas; x++) {
        if (mascara[y * colunas + x] > minimo) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return { x0, x1, y0, y1 };
  }
  let caixaLogo = { x0: 0, x1: -1, y0: 0, y1: -1 };
  let caixaHalo = { x0: 0, x1: -1, y0: 0, y1: -1 };

  const st = {
    subida: fs * 1.1,
    estica: 1.35,
    escala: 1,
    brilho: 0,
    halo: 0,
    barra: 0,
    barraVisivel: 1,
    onda: 0,
    corte: true
  };
  let medidas = { x0: cx, largura: 0 };
  const maxDist = Math.hypot(Math.max(cx, colunas - cx), Math.max(cy, linhas - cy));

  const C_CREME = cor32(CREME);
  const C_CINZA = cor32(CINZA);
  const C_BRASA = cor32(BRASA);
  const C_GRAO = cor32(GRAO);
  const C_FUNDO = cor32(FUNDO);

  const BAY = new Float32Array(total);
  const FUNDO_CEL = new Uint32Array(total);
  for (let y = 0; y < linhas; y++) {
    for (let x = 0; x < colunas; x++) {
      const i = y * colunas + x;
      BAY[i] = BAYER[(y & 7) * 8 + (x & 7)];
      FUNDO_CEL[i] = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 < 9 ? C_GRAO : C_FUNDO;
    }
  }

  let DIST, S5, C5, S9, C9, S14, C14;
  let ondaPronta = false;
  function prepararOnda() {
    if (ondaPronta) return;
    DIST = new Float32Array(total);
    S5 = new Float32Array(total); C5 = new Float32Array(total);
    S9 = new Float32Array(total); C9 = new Float32Array(total);
    S14 = new Float32Array(total); C14 = new Float32Array(total);
    for (let y = 0; y < linhas; y++) {
      for (let x = 0; x < colunas; x++) {
        const i = y * colunas + x;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy) / maxDist;
        const ang = Math.atan2(dy, dx);
        DIST[i] = dist * 0.86;
        S5[i] = Math.sin(ang * 5); C5[i] = Math.cos(ang * 5);
        S9[i] = Math.sin(ang * 9); C9[i] = Math.cos(ang * 9);
        S14[i] = Math.sin(dist * 14); C14[i] = Math.cos(dist * 14);
      }
    }
    ondaPronta = true;
  }
  const quandoOcioso = window.requestIdleCallback
    ? (f) => window.requestIdleCallback(f, { timeout: 1500 })
    : (f) => setTimeout(f, 300);

  let ultimoDesenho = 0;
  let telaInteira = true;
  let faixaAnterior = [0, -1];

  function desenhar() {
    const agora = performance.now();
    if (agora - ultimoDesenho < 32) return;
    ultimoDesenho = agora;

    const t = agora / 1000;
    const barraY = base + Math.round(fs * 0.3);
    const barraIni = Math.max(medidas.x0, cx - (medidas.largura / 2) * st.barraVisivel - 1);
    const barraFim = Math.min(medidas.x0 + medidas.largura * st.barra,
      cx + (medidas.largura / 2) * st.barraVisivel + 1);
    const temBarra = st.barraVisivel > 0 && st.barra > 0;

    const onda = st.onda;
    const cT1 = 0.5 * Math.cos(t * 2.2), sT1 = 0.5 * Math.sin(t * 2.2);
    const cT2 = 0.3 * Math.cos(t * 3.1), sT2 = 0.3 * Math.sin(t * 3.1);
    const cT3 = 0.2 * Math.cos(t * 5), sT3 = 0.2 * Math.sin(t * 5);

    const e = st.escala;
    const k = e * st.estica;
    const temLogo = st.brilho > 0 && caixaLogo.x1 >= 0;
    const lx0 = Math.floor(cx + (caixaLogo.x0 - cx) * e) - 1;
    const lx1 = Math.ceil(cx + (caixaLogo.x1 - cx) * e) + 1;
    let ly0 = Math.floor(base + (caixaLogo.y0 + st.subida - base) * k) - 1;
    const ly1 = Math.min(st.corte ? base : linhas, Math.ceil(base + (caixaLogo.y1 + st.subida - base) * k) + 1);
    if (ly0 < 0) ly0 = 0;
    const temHalo = st.halo > 0 && caixaHalo.x1 >= 0;
    const hx0 = Math.floor(cx + (caixaHalo.x0 - cx) * e) - 1;
    const hx1 = Math.ceil(cx + (caixaHalo.x1 - cx) * e) + 1;
    const hy0 = Math.floor(cy + (caixaHalo.y0 - cy) * e) - 1;
    const hy1 = Math.ceil(cy + (caixaHalo.y1 - cy) * e) + 1;

    let y0 = 0;
    let y1 = linhas - 1;
    if (!telaInteira && onda <= 0) {
      let a = linhas, z = -1;
      if (temLogo) { a = Math.min(a, ly0); z = Math.max(z, ly1); }
      if (temHalo) { a = Math.min(a, hy0); z = Math.max(z, hy1); }
      if (temBarra) { a = Math.min(a, barraY); z = Math.max(z, barraY); }
      y0 = Math.max(0, Math.min(a, faixaAnterior[0]));
      y1 = Math.min(linhas - 1, Math.max(z, faixaAnterior[1]));
      faixaAnterior = [a, z];
      if (y1 < y0) return;
    }
    telaInteira = false;

    for (let y = y0; y <= y1; y++) {
      const linhaLogo = temLogo && y >= ly0 && y <= ly1;
      const linhaHalo = temHalo && y >= hy0 && y <= hy1;
      const linhaBarra = temBarra && y === barraY;
      const sy = Math.round(base + (y - base) / k - st.subida);
      const syh = Math.round(cy + (y - cy) / e);
      const linhaFonte = sy >= 0 && sy < linhas ? sy * colunas : -1;
      const linhaFonteHalo = syh >= 0 && syh < linhas ? syh * colunas : -1;

      for (let x = 0; x < colunas; x++) {
        const i = y * colunas + x;
        const b = BAY[i];

        if (onda > 0 && ondaPronta) {
          const ameba =
            S5[i] * cT1 + C5[i] * sT1 +
            S9[i] * cT2 - C9[i] * sT2 +
            S14[i] * cT3 - C14[i] * sT3;
          const d = DIST[i] + ameba * 0.06 + b * 0.08 - onda;
          if (d < 0) { px32[i] = 0; continue; }
          if (d < 0.022) { px32[i] = C_CREME; continue; }
          if (d < 0.055) { px32[i] = C_CINZA; continue; }
        }

        if (linhaLogo && linhaFonte >= 0 && x >= lx0 && x <= lx1) {
          const sx = Math.round(cx + (x - cx) / e);
          if (sx >= 0 && sx < colunas && logo[linhaFonte + sx] * st.brilho > b) {
            px32[i] = C_CREME;
            continue;
          }
        }

        if (linhaBarra && x >= barraIni && x <= barraFim && b < 0.8) {
          px32[i] = C_CREME;
          continue;
        }

        if (linhaHalo && linhaFonteHalo >= 0 && x >= hx0 && x <= hx1) {
          const sxh = Math.round(cx + (x - cx) / e);
          if (sxh >= 0 && sxh < colunas && halo[linhaFonteHalo + sxh] * st.halo > b) {
            px32[i] = C_BRASA;
            continue;
          }
        }

        px32[i] = FUNDO_CEL[i];
      }
    }
    const n = y1 - y0 + 1;
    mctx.putImageData(img, 0, 0, 0, y0, colunas, n);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, y0 * CELULA, W, n * CELULA);
    ctx.drawImage(mini, 0, y0, colunas, n, 0, y0 * CELULA, colunas * CELULA, n * CELULA);

    if (cortina && cortina.isConnected) cortina.remove();
  }

  function espera(ms) { return new Promise((r) => setTimeout(r, ms)); }
  const etapas = [];
  let feitas = 0;
  const contar = (promessa) => {
    etapas.push(promessa);
    promessa.then(() => {
      feitas++;
      gsap.to(st, { barra: feitas / etapas.length, duration: 0.5, ease: 'power2.out' });
    });
  };
  const temFontes = Boolean(document.fonts && document.fonts.load);
  const fonteMarca = temFontes
    ? Promise.race([document.fonts.load('1em "Archivo Black"', 'EB').catch(() => {}), espera(1500)])
    : Promise.resolve();
  contar(new Promise((r) => {
    if (document.readyState !== 'loading') return r();
    document.addEventListener('DOMContentLoaded', r, { once: true });
  }));
  const foto = document.querySelector('.hero__photo');
  contar(new Promise((r) => {
    if (!foto || foto.complete) return r();
    foto.addEventListener('load', r, { once: true });
    foto.addEventListener('error', r, { once: true });
  }));
  contar(fonteMarca);
  contar(temFontes
    ? Promise.race([
        Promise.all([
          document.fonts.load('700 1em "Archivo"'),
          document.fonts.load('400 1em "Atkinson Hyperlegible Next"')
        ]).catch(() => {}),
        espera(2000)
      ])
    : Promise.resolve());

  const inicio = performance.now();
  const pronto = Promise.race([Promise.all(etapas), espera(MAX_ESPERA)]);

  if (reduzido) {
    fonteMarca.then(() => {
      medidas = desenharMascaras();
      Object.assign(st, { subida: 0, estica: 1, brilho: 1, halo: 0.4, corte: false });
      comecarAPintar();
    });
    pronto.then(() => {
      raiz.classList.remove('is-loading');
      liberar();
      gsap.to(tela, {
        opacity: 0,
        duration: 0.3,
        onComplete: () => { gsap.ticker.remove(desenhar); tela.remove(); }
      });
    });
    return;
  }

  fonteMarca.then(() => {
    medidas = desenharMascaras();
    comecarAPintar();

    const entrada = gsap.timeline();
    entrada.to(st, { brilho: 1, duration: 0.9, ease: 'power2.out' }, 0);
    entrada.to(st, { subida: 0, duration: 0.85, ease: 'expo.out' }, 0.05);
    entrada.to(st, { estica: 1, duration: 1, ease: 'elastic.out(1, 0.45)' }, 0.18);
    entrada.to(st, { halo: 0.55, duration: 1.2, ease: 'power2.out' }, 0.3);
    entrada.set(st, { corte: false }, 1.1);

    quandoOcioso(prepararOnda);

    pronto
      .then(() => espera(Math.max(0, MIN_VISIVEL - (performance.now() - inicio))))
      .then(sair);
  });

  function sair() {
    prepararOnda();
    const hero = document.querySelector('.hero');
    const camadas = hero ? [...hero.querySelectorAll(':scope > .hero__bg, :scope > .hero__inner')] : [];

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.ticker.remove(desenhar);
        tela.remove();
        if (camadas.length) gsap.set(camadas, { clearProps: 'transform,filter' });
      }
    });

    tl.to(st, { barraVisivel: 0, duration: 0.3, ease: 'power3.in' }, 0);

    tl.to(st, { escala: 0.86, halo: 1, duration: 0.45, ease: 'power2.inOut' }, 0.1);

    tl.set(tela, { pointerEvents: 'none' }, 0.55);
    tl.to(st, { onda: 1.15, duration: 1.25, ease: 'power4.out' }, 0.55);
    tl.to(st, { escala: 3.2, duration: 0.55, ease: 'expo.in' }, 0.5);
    tl.to(st, { brilho: 0, halo: 0, duration: 0.45, ease: 'power2.in' }, 0.62);
    tl.fromTo(tela, { x: 0, y: 0 }, {
      keyframes: [
        { x: -7, y: 4, duration: 0.04 },
        { x: 6, y: -5, duration: 0.04 },
        { x: -4, y: -3, duration: 0.04 },
        { x: 3, y: 2, duration: 0.04 },
        { x: 0, y: 0, duration: 0.06 }
      ],
      ease: 'none'
    }, 0.56);

    if (camadas.length) {
      tl.fromTo(camadas,
        {
          scale: W < 700 ? 1.08 : 1.15,
          filter: 'blur(10px)',
          transformOrigin: (i, el) => `50% ${Math.round(H / 2 - el.getBoundingClientRect().top)}px`
        },
        { scale: 1, filter: 'blur(0px)', duration: 1.5, ease: 'expo.out' },
        0.55);
    }

    tl.call(() => {
      raiz.classList.remove('is-loading');
      liberar();
    }, null, 0.55);
  }
})();

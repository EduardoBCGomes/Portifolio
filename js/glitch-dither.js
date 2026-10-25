(function () {
  'use strict';

  const tela = document.querySelector('.form-glitch');
  if (!tela || !tela.getContext) return;

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

  const pack = ([r, g, b]) => (255 << 24 | b << 16 | g << 8 | r) >>> 0;
  const CORES = [[36, 32, 29], [61, 57, 52], [107, 102, 95], [172, 167, 159], [236, 232, 225]].map(pack);
  const CELULA = 3;
  const INTERVALO = 1000 / 24;

  const ctx = tela.getContext('2d');
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  let colunas = 0;
  let linhas = 0;
  let img = null;
  let px = null;
  let desvio = null;
  let t = 0;
  let rajadaAte = 0;
  let proximaRajada = 1.2;
  let blocos = [];
  let visivel = false;
  let quadro = 0;
  let ultimo = 0;

  const sorteio = (a, b) => a + Math.random() * (b - a);

  function medir() {
    const w = tela.clientWidth;
    const h = tela.clientHeight;
    if (!w || !h) return false;
    colunas = Math.ceil(w / CELULA);
    linhas = Math.ceil(h / CELULA);
    tela.width = colunas;
    tela.height = linhas;
    img = ctx.createImageData(colunas, linhas);
    px = new Uint32Array(img.data.buffer);
    desvio = new Int16Array(linhas);
    return true;
  }

  function campo(x, y) {
    const v = y / (linhas - 1);
    const onda = Math.sin(x * 0.09 + t * 0.7 + Math.sin(y * 0.6 + t * 0.9) * 1.4) * 0.5 + 0.5;
    const ruido = Math.sin(x * 0.31 - t * 1.3) * Math.sin(x * 0.07 + y * 0.9 + t * 0.4);
    return Math.pow(v, 1.6) * (0.32 + onda * 0.3) + ruido * 0.05;
  }

  function sortearRajada() {
    rajadaAte = t + sorteio(0.12, 0.32);
    proximaRajada = t + sorteio(1.5, 3.5);
    desvio.fill(0);
    let y = 0;
    while (y < linhas) {
      const altura = Math.ceil(sorteio(1, 4));
      const dx = Math.random() < 0.55 ? Math.round(sorteio(-26, 26)) : 0;
      for (let k = y; k < Math.min(linhas, y + altura); k++) desvio[k] = dx;
      y += altura;
    }
    blocos = Array.from({ length: Math.ceil(sorteio(2, 6)) }, () => ({
      x: Math.floor(sorteio(0, colunas)),
      y: Math.floor(sorteio(0, linhas)),
      w: Math.ceil(sorteio(6, 34)),
      h: Math.ceil(sorteio(1, 3)),
      v: Math.random() < 0.7 ? sorteio(0.75, 1) : 0
    }));
  }

  function pintar() {
    const emRajada = t < rajadaAte;
    if (emRajada && Math.random() < 0.35) sortearRajada();
    for (let y = 0; y < linhas; y++) {
      const dx = emRajada ? desvio[y] : 0;
      for (let x = 0; x < colunas; x++) {
        let v = campo(x - dx, y);
        if (emRajada) {
          for (const b of blocos) {
            if (y >= b.y && y < b.y + b.h && x >= b.x && x < b.x + b.w) v = b.v;
          }
        }
        const n = v * 4.6;
        const nivel = Math.floor(n) + (n % 1 > BAYER[(y & 7) * 8 + (x & 7)] ? 1 : 0);
        px[y * colunas + x] = nivel <= 0 ? 0 : CORES[Math.min(nivel, CORES.length) - 1];
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const parado = () => reduzido.matches || document.documentElement.classList.contains('sem-movimento');

  function tique(agora) {
    quadro = 0;
    if (!visivel || parado() || !img) return;
    if (agora - ultimo >= INTERVALO) {
      const dt = ultimo ? Math.min(agora - ultimo, 100) / 1000 : INTERVALO / 1000;
      ultimo = agora;
      t += dt;
      if (t >= proximaRajada) sortearRajada();
      pintar();
    }
    quadro = requestAnimationFrame(tique);
  }

  function acordar() {
    if (!quadro && visivel && !parado()) {
      ultimo = 0;
      quadro = requestAnimationFrame(tique);
    }
  }

  function preparar() {
    if (!medir()) return;
    pintar();
    acordar();
  }

  new ResizeObserver(() => {
    if (Math.ceil(tela.clientWidth / CELULA) !== colunas || Math.ceil(tela.clientHeight / CELULA) !== linhas) preparar();
  }).observe(tela);

  new IntersectionObserver(([entrada]) => {
    visivel = entrada.isIntersecting;
    acordar();
  }, { rootMargin: '80px' }).observe(tela);

  document.addEventListener('portfolio:movimento', acordar);
  reduzido.addEventListener?.('change', acordar);

  preparar();
})();

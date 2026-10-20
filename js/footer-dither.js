(function () {
  'use strict';

  // Ideia do Aurora Footer (Reverse UI, inspirado no site do Dia): nove
  // colunas em degrau sobem da base da tela conforme a rolagem atravessa o
  // espaço depois do rodapé, e a página volta sozinha quando a pessoa para
  // ali. No original as colunas são um degradê colorido desfocado; aqui o
  // degradê vira o mesmo pontilhado Bayer 8x8 do fundo do topo.

  // Alturas das colunas, tiradas do SVG original (viewBox 1567 x 584).
  const ALTURAS = [0.497, 0.685, 0.822, 0.908, 1, 0.908, 0.822, 0.685, 0.497];

  const VERT = `#version 300 es
  in vec2 aPos;
  void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  const FRAG = `#version 300 es
  precision highp float;

  uniform vec2  uRes;
  uniform float uTempo;
  uniform float uSubida;
  uniform float uAlturas[9];
  uniform vec3  uTinta;

  out vec4 fragColor;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float ruido(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  // Altura do degrau em x. Entre duas colunas a troca é suave, no lugar do
  // desfoque gaussiano do original.
  float altura(float x) {
    float pos = x * 9.0 - 0.5;
    float i = floor(pos);
    float t = pos - i;
    float a = uAlturas[int(clamp(i, 0.0, 8.0))];
    float b = uAlturas[int(clamp(i + 1.0, 0.0, 8.0))];
    return mix(a, b, smoothstep(0.45, 0.55, t));
  }

  const float bayer[64] = float[64](
     0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
    32.0/64.0, 16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0, 19.0/64.0, 47.0/64.0, 31.0/64.0,
     8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0, 59.0/64.0,  7.0/64.0, 55.0/64.0,
    40.0/64.0, 24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0, 27.0/64.0, 39.0/64.0, 23.0/64.0,
     2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0, 49.0/64.0, 13.0/64.0, 61.0/64.0,
    34.0/64.0, 18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0, 17.0/64.0, 45.0/64.0, 29.0/64.0,
    10.0/64.0, 58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0, 57.0/64.0,  5.0/64.0, 53.0/64.0,
    42.0/64.0, 26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0, 25.0/64.0, 37.0/64.0, 21.0/64.0
  );

  void main() {
    vec2 celula = floor(gl_FragCoord.xy);
    vec2 uv = (celula + 0.5) / uRes;

    float h = altura(uv.x) * uSubida;
    if (h < 0.002) {
      fragColor = vec4(0.0);
      return;
    }

    // posição relativa dentro da coluna: 0 na base, 1 no topo (como o
    // degradê de cada barra no original, que vai da base até o topo dela)
    float t = uv.y / h;

    // as faixas ondulam devagar, como cortina de aurora
    float onda = ruido(vec2(uv.x * 5.0 + uTempo * 0.07, uTempo * 0.11));
    t += (onda - 0.5) * 0.06;

    float brilho = 0.92 * (1.0 - smoothstep(0.0, 1.0, t));
    brilho *= 0.8 + 0.2 * sin(t * 9.0 - uTempo * 0.55 + onda * 2.0);
    brilho *= 0.9 + 0.1 * ruido(uv * vec2(18.0, 8.0) - vec2(0.0, uTempo * 0.3));

    int bx = int(mod(celula.x, 8.0));
    int by = int(mod(celula.y, 8.0));
    float nivel = clamp(floor(brilho * 3.0 + bayer[by * 8 + bx]) / 3.0, 0.0, 1.0);

    // fora das colunas o canvas é transparente: a página aparece por trás
    fragColor = vec4(uTinta * nivel, nivel);
  }`;

  const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);

  function compilar(gl, tipo, fonte) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, fonte);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[footer-dither]', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function corDoCss(nome, reserva) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    const hex = /^#[0-9a-f]{6}$/i.test(v) ? v : reserva;
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function iniciar(raiz) {
    const espaco = raiz.querySelector('.aurora__espaco');
    const canvas = raiz.querySelector('.aurora__canvas');
    if (!espaco || !canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power'
    });

    // Sem WebGL2 o espaço no fim da página ficaria vazio à toa.
    const desistir = () => raiz.remove();
    if (!gl) return desistir();

    const vs = compilar(gl, gl.VERTEX_SHADER, VERT);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return desistir();
    const programa = gl.createProgram();
    gl.attachShader(programa, vs);
    gl.attachShader(programa, fs);
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
      console.error('[footer-dither]', gl.getProgramInfoLog(programa));
      return desistir();
    }
    gl.useProgram(programa);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(programa, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    ['uRes', 'uTempo', 'uSubida', 'uAlturas', 'uTinta']
      .forEach((n) => { u[n] = gl.getUniformLocation(programa, n); });

    gl.uniform1fv(u.uAlturas, ALTURAS);
    gl.uniform3fv(u.uTinta, corDoCss('--accent', '#faf9f6'));
    gl.clearColor(0, 0, 0, 0);

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A volta automática só no desktop, como no original: no celular a
    // rolagem por toque já tem o próprio elástico do sistema.
    const desktop = window.matchMedia('(min-width: 1000px)');

    let raf = 0;
    let ultimo = 0;
    let tempo = 0;
    let perdido = false;

    const celulaCss = () => (window.innerWidth < 700 ? 2 : 3);

    function medir() {
      const r = canvas.getBoundingClientRect();
      const tam = celulaCss();
      const w = Math.max(1, Math.round(r.width / tam));
      const h = Math.max(1, Math.round(r.height / tam));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uRes, w, h);
    }

    // 0 quando o topo do espaço encosta na base da tela, 1 quando o fim do
    // espaço chega nela (o offset ['start end', 'end end'] do original).
    function progresso() {
      const r = espaco.getBoundingClientRect();
      if (r.height <= 0) return 0;
      return limitar((window.innerHeight - r.top) / r.height, 0, 1);
    }

    function quadro(agora) {
      raf = 0;
      if (perdido) return;
      const dt = ultimo ? Math.min(0.1, (agora - ultimo) / 1000) : 0;
      ultimo = agora;

      const subida = limitar(progresso() / 0.995, 0, 1);
      const ativa = subida > 0.001;
      raiz.classList.toggle('is-ativa', ativa);
      if (!ativa) {
        ultimo = 0;
        return;
      }

      if (!reduzido) tempo += dt;
      gl.uniform1f(u.uTempo, tempo);
      gl.uniform1f(u.uSubida, subida);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Visível e com movimento liberado: as faixas continuam ondulando.
      if (!reduzido && !document.hidden) raf = requestAnimationFrame(quadro);
    }

    function acordar() {
      if (!raf && !perdido) raf = requestAnimationFrame(quadro);
    }

    // Volta automática: parou de rolar com as colunas à mostra, a página
    // sobe sozinha até o rodapé encostar na base da tela.
    let espera = 0;
    let voltando = false;

    function voltar() {
      if (voltando || progresso() <= 0.05) return;
      voltando = true;
      const alvo = window.scrollY + espaco.getBoundingClientRect().top - window.innerHeight - 50;
      window.scrollTo({ top: Math.max(0, alvo), behavior: 'smooth' });
      setTimeout(() => { voltando = false; }, 1000);
    }

    function agendarVolta() {
      clearTimeout(espera);
      if (!desktop.matches || reduzido) return;
      espera = setTimeout(voltar, 380);
    }

    window.addEventListener('scroll', () => {
      acordar();
      agendarVolta();
    }, { passive: true });

    window.addEventListener('resize', acordar);
    new ResizeObserver(() => { medir(); acordar(); }).observe(canvas);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) acordar();
    });

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      perdido = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(espera);
      desistir();
    });

    medir();
    acordar();
    // Recarregou a página já no fim: a volta também vale.
    agendarVolta();
  }

  // Fica no fim da página: só monta o WebGL quando o fim está a uma tela de
  // distância, em vez de compilar o shader no carregamento.
  document.querySelectorAll('[data-aurora-dither]').forEach((raiz) => {
    if (!('IntersectionObserver' in window)) return iniciar(raiz);
    const io = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      io.disconnect();
      iniciar(raiz);
    }, { rootMargin: '100% 0px' });
    io.observe(raiz);
  });
})();

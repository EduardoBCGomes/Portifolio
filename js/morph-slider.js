(function () {
  'use strict';

  const MODOS = { melt: 0, ripple: 1, shear: 2, swirl: 3 };

  const VERT = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }`;

  const FRAG = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif

  uniform sampler2D tCurrent;
  uniform sampler2D tNext;
  uniform vec2 uResolution;
  uniform vec2 uCurrentSize;
  uniform vec2 uNextSize;
  uniform float uProgress;
  uniform float uDir;
  uniform int uMode;
  uniform float uIntensity;
  uniform float uScale;
  uniform float uAberration;
  uniform float uDrift;
  uniform float uTime;
  uniform float uReduce;
  uniform vec2 uPointer;
  uniform vec3 uOverlay;

  varying vec2 vUv;

  const float PI = 3.14159265359;

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  vec2 coverUV(vec2 uv, vec2 res, vec2 img) {
    float rA = res.x / max(res.y, 1.0);
    float iA = img.x / max(img.y, 1.0);
    vec2 s = vec2(1.0);
    float ratio = rA / max(iA, 0.0001);
    if (ratio > 1.0) {
      s.y = 1.0 / ratio;
    } else {
      s.x = ratio;
    }
    return (uv - 0.5) * s + 0.5;
  }

  void main() {
    float p = clamp(uProgress, 0.0, 1.0);
    float env = sin(p * PI);

    vec2 uv = vUv;

    uv += vec2(sin(uTime * 0.25 + uv.y * 4.0), cos(uTime * 0.22 + uv.x * 4.0)) * uDrift * 0.008;
    uv = (uv - 0.5) * (1.0 - uDrift * 0.02 * sin(uTime * 0.4)) + 0.5;

    vec2 uvC = uv;
    vec2 uvN = uv;
    float m = smoothstep(0.0, 1.0, p);

    if (uReduce < 0.5) {
      if (uMode == 3) {
        vec2 c = uv - 0.5;
        float r = length(c);
        float ang = env * uIntensity * 3.5 * (1.0 - r);
        uvC = rot(ang) * c + 0.5;
        uvN = rot(-ang) * c + 0.5;
        m = smoothstep(0.0, 1.0, p);
      } else if (uMode == 1) {
        float d = distance(uv, uPointer);
        float ring = p * 1.6;
        float wave = sin((d - ring) * 30.0) * env;
        vec2 dir = normalize(uv - uPointer + 1e-4);
        vec2 disp = dir * wave * uIntensity * 0.25;
        uvC = uv + disp;
        uvN = uv + disp * 0.6;
        m = 1.0 - smoothstep(ring - 0.03, ring + 0.03, d);
      } else if (uMode == 2) {
        float slices = 14.0;
        float row = floor(uv.y * slices);
        float rnd = hash11(row);
        vec2 disp = vec2((rnd - 0.5) * env * uIntensity * 0.6, 0.0);
        uvC = uv + disp;
        uvN = uv + disp;
        float localX = uDir > 0.0 ? uv.x : 1.0 - uv.x;
        float th = p * 1.5 - 0.25 + (rnd - 0.5) * 0.25;
        m = 1.0 - smoothstep(th - 0.06, th + 0.06, localX);
      } else {
        float nn = fbm(uv * uScale + uTime * 0.03);
        float warp = fbm(uv * uScale * 1.7 - uTime * 0.02);
        vec2 g = vec2(nn, warp) - 0.5;
        uvC = uv + g * uIntensity * 0.5 * p;
        uvN = uv - g * uIntensity * 0.5 * (1.0 - p);
        m = smoothstep(nn - 0.15, nn + 0.15, p);
      }
    }

    vec2 sC = coverUV(uvC, uResolution, uCurrentSize);
    vec2 sN = coverUV(uvN, uResolution, uNextSize);

    float ca = uReduce < 0.5 ? uAberration * env * 0.03 : 0.0;

    vec3 colC = vec3(
      texture2D(tCurrent, sC + vec2(ca, 0.0)).r,
      texture2D(tCurrent, sC).g,
      texture2D(tCurrent, sC - vec2(ca, 0.0)).b
    );
    vec3 colN = vec3(
      texture2D(tNext, sN + vec2(ca, 0.0)).r,
      texture2D(tNext, sN).g,
      texture2D(tNext, sN - vec2(ca, 0.0)).b
    );

    vec3 col = mix(colC, colN, m);

    float vig = smoothstep(1.25, 0.25, length(uv - 0.5));
    col = mix(col, uOverlay, (1.0 - vig) * 0.28);

    gl_FragColor = vec4(col, 1.0);
  }`;

  function compilar(gl, tipo, fonte) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, fonte);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[morph-slider]', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function hexParaRgb(hex) {
    let h = (hex || '#000000').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function num(el, chave, padrao) {
    const v = parseFloat(el.dataset[chave]);
    return Number.isFinite(v) ? v : padrao;
  }

  function bool(el, chave, padrao) {
    const v = el.dataset[chave];
    if (v === undefined) return padrao;
    return v !== 'false';
  }

  function criarMotor(palco, itens, cfg, aoTrocar, aoPerderContexto) {
    const gl = palco.getContext('webgl', { alpha: false, antialias: true });
    if (!gl) return null;

    // Sao tres canvas nesta pagina; num celular com pouca memoria o
    // navegador pode derrubar um contexto. Sem tratar, sobra um canvas
    // com lixo na tela — melhor voltar para a lista de imagens.
    palco.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (aoPerderContexto) aoPerderContexto();
    }, false);

    const vs = compilar(gl, gl.VERTEX_SHADER, VERT);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[morph-slider]', gl.getProgramInfoLog(prog));
      return null;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 0,
       3, -1, 2, 0,
      -1,  3, 0, 2
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'position');
    const aUv = gl.getAttribLocation(prog, 'uv');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

    const u = {};
    ['tCurrent', 'tNext', 'uResolution', 'uCurrentSize', 'uNextSize', 'uProgress',
     'uDir', 'uMode', 'uIntensity', 'uScale', 'uAberration', 'uDrift', 'uTime',
     'uReduce', 'uPointer', 'uOverlay'].forEach((n) => { u[n] = gl.getUniformLocation(prog, n); });

    function texturaVazia() {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      const px = new Uint8Array([20, 17, 14, 255]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }

    const texturas = itens.map(texturaVazia);
    const tamanhos = itens.map(() => [1, 1]);

    itens.forEach((item, i) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = item.imagem;
      img.onload = () => {
        // O upload vai numa unidade de trabalho (TEXTURE2). Sem escolher a
        // unidade, o bind cairia na que estivesse ativa e sobrescreveria o
        // que tCurrent (0) ou tNext (1) estão apontando — e o slide passa a
        // mostrar a imagem errada.
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, texturas[i]);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        tamanhos[i] = [img.naturalWidth || 1, img.naturalHeight || 1];

        aplicarAtual();
        aplicarProximo(estado.proximo);
      };
    });

    const estado = {
      atual: cfg.startIndex,
      proximo: cfg.startIndex,
      anunciado: cfg.startIndex,
      animando: false,
      arrastando: false,
      dirArrasto: 0,
      progresso: { valor: 0 },
      tween: null,
      pausado: false
    };

    gl.uniform1i(u.tCurrent, 0);
    gl.uniform1i(u.tNext, 1);
    gl.uniform1f(u.uProgress, 0);
    gl.uniform1f(u.uDir, 1);
    gl.uniform1i(u.uMode, MODOS[cfg.transition] ?? 0);
    gl.uniform1f(u.uIntensity, cfg.intensity);
    gl.uniform1f(u.uScale, cfg.scale);
    gl.uniform1f(u.uAberration, cfg.aberration);
    gl.uniform1f(u.uDrift, cfg.drift);
    const formatoHigh = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const temHighp = !!formatoHigh && formatoHigh.precision >= 23;
    gl.uniform1f(u.uReduce, (cfg.reduzido || !temHighp) ? 1 : 0);
    gl.uniform2f(u.uPointer, 0.5, 0.5);
    const ov = hexParaRgb(cfg.overlayColor);
    gl.uniform3f(u.uOverlay, ov[0], ov[1], ov[2]);

    function aplicarAtual() {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texturas[estado.atual]);
      gl.uniform2f(u.uCurrentSize, tamanhos[estado.atual][0], tamanhos[estado.atual][1]);
    }

    function aplicarProximo(alvo) {
      estado.proximo = alvo;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texturas[alvo]);
      gl.uniform2f(u.uNextSize, tamanhos[alvo][0], tamanhos[alvo][1]);
    }

    aplicarAtual();
    aplicarProximo(estado.atual);

    let larg = 0;
    let alt = 0;

    function redimensionar() {
      const teto = window.innerWidth < 700 ? 1.5 : 2;
      const dpr = Math.min(window.devicePixelRatio || 1, teto);
      const r = palco.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width * dpr));
      const h = Math.max(1, Math.floor(r.height * dpr));
      if (w === larg && h === alt) return;
      larg = w; alt = h;
      palco.width = w;
      palco.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uResolution, w, h);
    }

    const ro = new ResizeObserver(redimensionar);
    ro.observe(palco);
    redimensionar();

    let raf = 0;
    function quadro(t) {
      raf = requestAnimationFrame(quadro);
      if (estado.pausado) return;
      gl.uniform1f(u.uTime, (t * 0.001) % 600);
      gl.uniform1f(u.uProgress, estado.progresso.valor);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    raf = requestAnimationFrame(quadro);

    function envolver(i) {
      const n = itens.length;
      return ((i % n) + n) % n;
    }

    function anunciar(i) {
      if (i === estado.anunciado) return;
      estado.anunciado = i;
      aoTrocar(i);
    }

    function prepararProximo(dir) {
      const alvo = envolver(estado.atual + dir);
      aplicarAtual();
      aplicarProximo(alvo);
      gl.uniform1f(u.uDir, dir);
      return alvo;
    }

    function concluir(alvo) {
      estado.atual = alvo;
      aplicarAtual();
      estado.progresso.valor = 0;
      estado.animando = false;
      estado.tween = null;
      anunciar(alvo);
    }

    function ir(dir) {
      if (estado.animando || estado.arrastando || itens.length < 2) return;
      if (!cfg.loop) {
        const cru = estado.atual + dir;
        if (cru < 0 || cru > itens.length - 1) return;
      }
      const alvo = prepararProximo(dir);
      estado.animando = true;
      const dur = cfg.reduzido ? Math.min(cfg.duration, 0.4) : cfg.duration;
      // A legenda troca na metade do morph, não no início: com ela fora do
      // quadro, anunciar cedo faz o texto chegar antes da imagem.
      estado.tween = gsap.fromTo(estado.progresso,
        { valor: 0 },
        {
          valor: 1,
          duration: dur,
          ease: cfg.ease,
          onUpdate: () => { if (estado.progresso.valor > 0.5) anunciar(alvo); },
          onComplete: () => concluir(alvo)
        }
      );
    }

    return {
      ir,
      indice: () => estado.atual,
      total: itens.length,
      apontar(x, y) { gl.uniform2f(u.uPointer, x, y); },
      pausar(v) { estado.pausado = !!v; },
      iniciarArrasto() {
        if (estado.animando || itens.length < 2) return false;
        estado.arrastando = true;
        estado.dirArrasto = 0;
        return true;
      },
      arrastar(ndx) {
        if (!estado.arrastando) return;
        const dir = ndx < 0 ? 1 : -1;
        if (!cfg.loop) {
          const cru = estado.atual + dir;
          if (cru < 0 || cru > itens.length - 1) {
            estado.progresso.valor = 0;
            return;
          }
        }
        if (dir !== estado.dirArrasto) {
          estado.dirArrasto = dir;
          prepararProximo(dir);
        }
        estado.progresso.valor = Math.min(Math.abs(ndx), 1);
        anunciar(estado.progresso.valor > 0.5 ? envolver(estado.atual + dir) : estado.atual);
      },
      terminarArrasto() {
        if (!estado.arrastando) return;
        estado.arrastando = false;
        if (estado.dirArrasto === 0) return;
        const p = estado.progresso.valor;
        const alvo = envolver(estado.atual + estado.dirArrasto);
        const dur = cfg.reduzido ? 0.3 : 0.5;
        estado.animando = true;
        if (p > 0.4) {
          anunciar(alvo);
          estado.tween = gsap.to(estado.progresso, {
            valor: 1, duration: dur, ease: 'power2.out', onComplete: () => concluir(alvo)
          });
        } else {
          anunciar(estado.atual);
          estado.tween = gsap.to(estado.progresso, {
            valor: 0, duration: dur, ease: 'power2.out',
            onComplete: () => { estado.animando = false; estado.tween = null; }
          });
        }
      },
      destruir() {
        cancelAnimationFrame(raf);
        if (estado.tween) estado.tween.kill();
        ro.disconnect();
        texturas.forEach((t) => gl.deleteTexture(t));
        gl.deleteProgram(prog);
        gl.deleteBuffer(buf);
      }
    };
  }

  // Na lista as imagens sao o conteudo, nao um extra adiado: com
  // loading="lazy" elas ficavam sem ser pedidas e o quadro aparecia vazio.
  function carregarImagensAgora(raiz) {
    raiz.querySelectorAll('.morph-slider-item img[loading="lazy"]').forEach((img) => {
      img.removeAttribute('loading');
      img.src = img.getAttribute('src');
    });
  }

  function iniciar(raiz) {
    const lista = raiz.querySelector('.morph-slider-items');
    if (!lista) return;

    const itens = [...lista.querySelectorAll('.morph-slider-item')].map((li) => {
      const img = li.querySelector('img');
      const link = li.querySelector('a');
      return {
        imagem: img ? img.getAttribute('src') : '',
        alt: img ? img.getAttribute('alt') : '',
        titulo: (li.dataset.titulo || '').trim(),
        descricao: (li.dataset.descricao || '').trim(),
        href: link ? link.getAttribute('href') : null,
        rotulo: link ? link.textContent.trim() : 'Ver projeto'
      };
    }).filter((i) => i.imagem);

    if (!itens.length || typeof gsap === 'undefined') return;

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const cfg = {
      startIndex: num(raiz, 'startIndex', 0),
      transition: raiz.dataset.transition || 'melt',
      duration: num(raiz, 'duration', 1.1),
      ease: raiz.dataset.ease || 'power2.inOut',
      intensity: num(raiz, 'intensity', 0.55),
      scale: num(raiz, 'scale', 2.4),
      aberration: num(raiz, 'aberration', 0.35),
      drift: num(raiz, 'drift', 0.4),
      autoplay: bool(raiz, 'autoplay', false),
      autoplayDelay: num(raiz, 'autoplayDelay', 4),
      loop: bool(raiz, 'loop', true),
      overlayColor: raiz.dataset.overlayColor || '#0c0a09',
      showControls: bool(raiz, 'showControls', true),
      showIndicators: bool(raiz, 'showIndicators', true),
      reduzido
    };

    // Em tela pequena o slider nao usa WebGL. O morph depende de amostrar
    // duas texturas grandes por quadro, e em GPU de celular isso apareceu
    // como faixas verticais no lugar da foto — o efeito custa caro e ali
    // rende pouco (nao ha hover e o quadro e pequeno). A lista empilhada
    // ainda e melhor: mostra todos os projetos de uma vez, sem navegar.
    if (window.matchMedia('(max-width: 699px)').matches) {
      raiz.classList.add('sem-webgl');
      carregarImagensAgora(raiz);
      return;
    }

    const palco = document.createElement('canvas');
    palco.className = 'morph-slider-canvas';

    const area = document.createElement('div');
    area.className = 'morph-slider-stage';
    area.setAttribute('role', 'group');
    area.setAttribute('aria-roledescription', 'carrossel');
    area.setAttribute('aria-label', 'Projetos');
    area.tabIndex = 0;
    area.appendChild(palco);

    const legenda = document.createElement('div');
    legenda.className = 'morph-slider-caption';
    legenda.setAttribute('aria-live', 'polite');
    legenda.innerHTML = itens.map((it, i) => `
      <div class="morph-slider-slide ${i === cfg.startIndex ? 'is-active' : ''}" ${i === cfg.startIndex ? '' : 'aria-hidden="true"'}>
        <h3 class="morph-slider-title">${it.titulo}</h3>
        ${it.descricao ? `<p class="morph-slider-desc">${it.descricao}</p>` : ''}
        ${it.href ? `<a class="morph-slider-link" href="${it.href}"${/^https?:/.test(it.href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${it.rotulo}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>` : ''}
      </div>`).join('');

    const controles = document.createElement('div');
    controles.className = 'morph-slider-controls';
    controles.innerHTML = `
      <button type="button" class="morph-slider-btn" data-anterior aria-label="Projeto anterior">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button type="button" class="morph-slider-btn" data-proximo aria-label="Próximo projeto">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;

    const pontos = document.createElement('div');
    pontos.className = 'morph-slider-indicators';
    pontos.setAttribute('role', 'tablist');
    pontos.setAttribute('aria-label', 'Projetos');
    pontos.innerHTML = itens.map((it, i) => `
      <button type="button" role="tab" class="morph-slider-dot ${i === cfg.startIndex ? 'is-active' : ''}"
              aria-selected="${i === cfg.startIndex}" aria-label="${it.titulo || 'Slide ' + (i + 1)}"></button>`).join('');

    lista.hidden = true;
    raiz.appendChild(area);
    if (cfg.showControls) raiz.appendChild(controles);
    if (cfg.showIndicators) raiz.appendChild(pontos);

    raiz.after(legenda);
    raiz.style.setProperty('--ms-swap', `${(cfg.duration * 0.66).toFixed(3)}s`);
    legenda.style.setProperty('--ms-swap', `${(cfg.duration * 0.66).toFixed(3)}s`);

    const slides = [...legenda.children];
    const dots = [...pontos.children];

    function voltarParaLista() {
      lista.hidden = false;
      area.remove();
      controles.remove();
      pontos.remove();
      legenda.remove();
      raiz.classList.remove('is-ready');
      raiz.classList.add('sem-webgl');
      carregarImagensAgora(raiz);
    }

    const motor = criarMotor(palco, itens, cfg, (i) => {
      slides.forEach((s, n) => {
        s.classList.toggle('is-active', n === i);
        if (n === i) s.removeAttribute('aria-hidden');
        else s.setAttribute('aria-hidden', 'true');
      });
      dots.forEach((d, n) => {
        d.classList.toggle('is-active', n === i);
        d.setAttribute('aria-selected', String(n === i));
      });
    }, voltarParaLista);

    if (!motor) {
      // Sem WebGL o fallback é a própria lista de imagens com links.
      lista.hidden = false;
      area.remove(); legenda.remove(); controles.remove(); pontos.remove();
      raiz.classList.add('sem-webgl');
      carregarImagensAgora(raiz);
      return;
    }

    raiz.classList.add('is-ready');

    controles.querySelector('[data-anterior]')?.addEventListener('click', () => motor.ir(-1));
    controles.querySelector('[data-proximo]')?.addEventListener('click', () => motor.ir(1));

    dots.forEach((d, i) => d.addEventListener('click', () => {
      const atual = motor.indice();
      if (i === atual) return;
      motor.ir(i > atual ? 1 : -1);
    }));

    area.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); motor.ir(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); motor.ir(-1); }
    });

    let arrastando = false;
    let xInicial = 0;
    let largura = 1;

    area.addEventListener('pointerdown', (e) => {
      const r = area.getBoundingClientRect();
      largura = r.width || 1;
      xInicial = e.clientX;
      motor.apontar((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
      arrastando = motor.iniciarArrasto();
      if (arrastando) {
        try { area.setPointerCapture(e.pointerId); } catch (err) {}
      }
    });
    area.addEventListener('pointermove', (e) => {
      if (!arrastando) return;
      motor.arrastar((e.clientX - xInicial) / largura);
    });
    const soltar = () => {
      if (!arrastando) return;
      arrastando = false;
      motor.terminarArrasto();
    };
    area.addEventListener('pointerup', soltar);
    area.addEventListener('pointercancel', soltar);

    let timer = 0;
    let sobre = false;
    function agendar() {
      clearTimeout(timer);
      if (!cfg.autoplay || sobre || cfg.reduzido) return;
      timer = setTimeout(() => { motor.ir(1); agendar(); }, Math.max(cfg.autoplayDelay, 1) * 1000);
    }
    raiz.addEventListener('pointerenter', () => { sobre = true; clearTimeout(timer); });
    raiz.addEventListener('pointerleave', () => { sobre = false; agendar(); });
    agendar();

    // Não gasta GPU com o slider fora da tela.
    new IntersectionObserver(([entrada]) => {
      motor.pausar(!entrada.isIntersecting);
      if (entrada.isIntersecting) agendar(); else clearTimeout(timer);
    }, { threshold: 0 }).observe(raiz);
  }

  document.querySelectorAll('[data-morph-slider]').forEach(iniciar);
})();

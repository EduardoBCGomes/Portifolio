(function () {
  'use strict';

  const SUAVE = 0.25;
  const DESLIZE = 0.8;
  const LIMIAR_ARRASTO = 6;
  const MAX_ARREMESSO = 4000;
  const INTRO_TEMPO = 0.7;
  const INTRO_ESCALONADO = 0.45;

  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const suavissimo = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const saida = (t) => 1 - Math.pow(1 - t, 3);

  function mascaraFade(tam) {
    const span = limitar(tam, 0, 0.5) * 100;
    if (span <= 0) return '';
    const paradas = [];
    for (let i = 0; i <= 12; i++) paradas.push(`rgba(0,0,0,${suavissimo(i / 12).toFixed(4)}) ${((span * i) / 12).toFixed(3)}%`);
    for (let i = 12; i >= 0; i--) paradas.push(`rgba(0,0,0,${suavissimo(i / 12).toFixed(4)}) ${(100 - (span * i) / 12).toFixed(3)}%`);
    return `linear-gradient(to right, ${paradas.join(', ')})`;
  }

  function num(el, chave, padrao) {
    const v = parseFloat(el.dataset[chave]);
    return Number.isFinite(v) ? v : padrao;
  }

  function iniciar(raiz) {
    const original = raiz.querySelector('.logoloop__list');
    if (!original) return;

    const cfg = {
      velocidade: num(raiz, 'speed', 120),
      direcao: raiz.dataset.direction === 'right' ? -1 : 1,
      altura: num(raiz, 'logoHeight', 28),
      gap: num(raiz, 'gap', 32),
      velocidadeHover: num(raiz, 'hoverSpeed', 0),
      fade: num(raiz, 'fadeOutWidth', 0.12)
    };

    raiz.style.setProperty('--logoloop-gap', `${cfg.gap}px`);
    raiz.style.setProperty('--logoloop-logoHeight', `${cfg.altura}px`);
    const mascara = mascaraFade(cfg.fade);
    if (mascara) {
      raiz.style.webkitMaskImage = mascara;
      raiz.style.maskImage = mascara;
    }

    const trilho = document.createElement('div');
    trilho.className = 'logoloop__track';
    original.parentNode.insertBefore(trilho, original);
    trilho.appendChild(original);

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    // na tela de toque não há hover para pausar: a fileira fica parada e anda
    // só quando a pessoa arrasta (WCAG 2.2.2, nada se move sozinho sem pausa)
    const toque = window.matchMedia('(hover: none)');

    const st = {
      offset: 0,
      velocidade: 0,
      periodo: 0,
      hover: false,
      foco: false,
      arrasto: null,
      deslize: false,
      bloquearCliqueAte: 0,
      visivel: true,
      raf: 0,
      ultimo: 0,
      introInicio: -1,
      introFeito: false,
      itens: []
    };

    function montarCopias() {
      [...trilho.children].slice(1).forEach((c) => c.remove());
      st.periodo = original.getBoundingClientRect().width;
      if (st.periodo <= 0) return;
      const copias = Math.max(2, Math.ceil(raiz.clientWidth / st.periodo) + 2);
      for (let i = 1; i < copias; i++) {
        const c = original.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
        trilho.appendChild(c);
      }
      st.itens = [...trilho.querySelectorAll('.logoloop__item')];
    }

    function quadro(agora) {
      st.raf = 0;
      if (st.periodo <= 0) return;
      const dt = st.ultimo ? limitar((agora - st.ultimo) / 1000, 0, 0.1) : 0;
      st.ultimo = agora;
      let ocupado = false;

      if (st.introInicio === -1 && !st.introFeito && st.visivel) {
        if (reduzido.matches) st.introFeito = true;
        else st.introInicio = agora;
        raiz.removeAttribute('data-intro');
      }

      const pausado = st.foco || st.hover;
      const alvo = reduzido.matches || toque.matches ? 0 : (pausado ? cfg.velocidadeHover : cfg.velocidade) * cfg.direcao;

      if (st.arrasto && st.arrasto.ativo) {
        ocupado = true;
      } else {
        const tau = st.deslize ? DESLIZE : SUAVE;
        st.velocidade += (alvo - st.velocidade) * (1 - Math.exp(-dt / tau));
        if (st.deslize && Math.abs(st.velocidade - alvo) < 2) st.deslize = false;
        if (Math.abs(st.velocidade - alvo) < 0.01) st.velocidade = alvo;
        st.offset += st.velocidade * dt;
        if (st.velocidade !== 0 || alvo !== 0) ocupado = true;
      }

      const P = st.periodo;
      st.offset = ((st.offset % P) + P) % P;
      trilho.style.transform = `translate3d(${(-st.offset).toFixed(2)}px, 0, 0)`;

      if (st.introInicio >= 0) {
        const t = (agora - st.introInicio) / 1000;
        const rr = raiz.getBoundingClientRect();
        st.itens.forEach((it) => {
          const r = it.getBoundingClientRect();
          const pos = limitar((r.left + r.width / 2 - rr.left) / Math.max(1, rr.width), 0, 1);
          const e = saida(limitar((t - pos * INTRO_ESCALONADO) / INTRO_TEMPO, 0, 1));
          it.style.clipPath = e >= 1 ? '' : `inset(0 0 ${((1 - e) * 100).toFixed(1)}% 0)`;
          it.style.transform = e >= 1 ? '' : `translateY(${((1 - e) * 14).toFixed(2)}px)`;
        });
        if (t >= INTRO_TEMPO + INTRO_ESCALONADO) {
          st.introInicio = -2;
          st.introFeito = true;
        } else {
          ocupado = true;
        }
      }

      if (ocupado && st.visivel) st.raf = requestAnimationFrame(quadro);
    }

    function acordar() {
      if (st.raf || !st.visivel) return;
      st.ultimo = 0;
      st.raf = requestAnimationFrame(quadro);
    }

    const local = (e) => e.clientX - raiz.getBoundingClientRect().left;

    raiz.addEventListener('pointerenter', () => { st.hover = true; acordar(); });
    raiz.addEventListener('pointerleave', () => { st.hover = false; acordar(); });

    raiz.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      st.arrasto = { id: e.pointerId, x: local(e), y: e.clientY, ativo: false, amostras: [], base: 0, inicio: 0 };
    });

    raiz.addEventListener('pointermove', (e) => {
      const d = st.arrasto;
      if (!d || e.pointerId !== d.id) return;
      const ao = local(e) - d.x;
      if (!d.ativo) {
        if (Math.abs(ao) < LIMIAR_ARRASTO) return;
        if (Math.abs(e.clientY - d.y) > Math.abs(ao)) { st.arrasto = null; return; }
        d.ativo = true;
        d.base = ao;
        d.inicio = st.offset;
        st.velocidade = 0;
        st.deslize = false;
        try { raiz.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
        raiz.setAttribute('data-dragging', '');
      }
      st.offset = d.inicio - (ao - d.base);
      const agora = performance.now();
      d.amostras.push([agora, ao]);
      while (d.amostras.length > 2 && agora - d.amostras[0][0] > 100) d.amostras.shift();
      acordar();
    });

    function soltar(e, cancelado) {
      const d = st.arrasto;
      if (!d || e.pointerId !== d.id) return;
      st.arrasto = null;
      if (!d.ativo) return;
      raiz.removeAttribute('data-dragging');
      try { raiz.releasePointerCapture(e.pointerId); } catch (err) { /* ja solto */ }
      const agora = performance.now();
      st.bloquearCliqueAte = agora + 400;
      let v = 0;
      const s = d.amostras;
      if (!cancelado && s.length > 1) {
        const [t0, a0] = s[0];
        const [t1, a1] = s[s.length - 1];
        if (t1 > t0 && agora - t1 < 80) v = limitar((-(a1 - a0) / (t1 - t0)) * 1000, -MAX_ARREMESSO, MAX_ARREMESSO);
      }
      st.velocidade = v;
      st.deslize = Math.abs(v) > 30;
      acordar();
    }

    raiz.addEventListener('pointerup', (e) => soltar(e, false));
    raiz.addEventListener('pointercancel', (e) => soltar(e, true));
    raiz.addEventListener('click', (e) => {
      if (performance.now() < st.bloquearCliqueAte) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    raiz.addEventListener('dragstart', (e) => e.preventDefault());
    raiz.addEventListener('focusin', () => { st.foco = true; acordar(); });
    raiz.addEventListener('focusout', (e) => {
      if (!raiz.contains(e.relatedTarget)) { st.foco = false; acordar(); }
    });

    if (reduzido.addEventListener) reduzido.addEventListener('change', acordar);

    new IntersectionObserver(([en]) => {
      st.visivel = en.isIntersecting;
      if (st.visivel) acordar();
    }, { threshold: 0.1 }).observe(raiz);

    let larguraAnterior = 0;
    new ResizeObserver(() => {
      if (raiz.clientWidth === larguraAnterior) return;
      larguraAnterior = raiz.clientWidth;
      montarCopias();
      acordar();
    }).observe(raiz);

    // A largura do periodo depende da fonte dos rótulos. Com cache frio o
    // ready resolvia antes de a fonte dos títulos (Archivo) chegar e o loop dava um salto
    // a cada volta; por isso pedimos a fonte e remedimos quando ela troca.
    const pronto = document.fonts && document.fonts.load
      ? document.fonts.load('500 1em "Archivo"').then(() => document.fonts.ready).catch(() => {})
      : Promise.resolve();
    pronto.then(() => { montarCopias(); acordar(); });

    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', () => {
        if (original.getBoundingClientRect().width === st.periodo) return;
        montarCopias();
        acordar();
      });
    }
  }

  document.querySelectorAll('[data-logo-loop]').forEach(iniciar);
})();

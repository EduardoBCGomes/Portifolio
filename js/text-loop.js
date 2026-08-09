(function () {
  'use strict';

  const VIEW_W = 1200;
  const EDGE_PAD = 6;

  function buildPath(shape, curviness, ribbonWidth, viewH) {
    const CX = VIEW_W / 2;
    const CY = viewH / 2;
    const c = Math.max(0, curviness);
    const room = Math.max(20, CY - Math.max(0, ribbonWidth) / 2 - EDGE_PAD);

    switch (shape) {
      case 'circle': {
        const r = Math.min(90 + c * 0.95, room);
        return `M ${CX - r} ${CY} A ${r} ${r} 0 1 1 ${CX + r} ${CY} A ${r} ${r} 0 1 1 ${CX - r} ${CY} Z`;
      }
      case 'infinity': {
        const r = 150 + c * 1.4;
        const h = Math.min(60 + c * 0.95, room);
        return [
          `M ${CX} ${CY}`,
          `C ${CX + r * 0.55} ${CY - h} ${CX + r} ${CY - h} ${CX + r} ${CY}`,
          `C ${CX + r} ${CY + h} ${CX + r * 0.55} ${CY + h} ${CX} ${CY}`,
          `C ${CX - r * 0.55} ${CY - h} ${CX - r} ${CY - h} ${CX - r} ${CY}`,
          `C ${CX - r} ${CY + h} ${CX - r * 0.55} ${CY + h} ${CX} ${CY}`,
          'Z'
        ].join(' ');
      }
      case 'arch': {
        const rise = Math.min(120 + c * 1.1, room * 2);
        return `M 120 ${CY + rise / 2} Q ${CX} ${CY - rise * 1.5} ${VIEW_W - 120} ${CY + rise / 2}`;
      }
      case 'line':
        return `M -320 ${CY} L ${VIEW_W + 320} ${CY}`;
      case 'wave':
      default: {
        const a = Math.min(c * 2.2, room * 2);
        return `M -320 ${CY} Q -160 ${CY - a} 0 ${CY} T 320 ${CY} T 640 ${CY} T 960 ${CY} T 1280 ${CY} T ${VIEW_W + 320} ${CY}`;
      }
    }
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function num(el, key, fallback) {
    const parsed = parseFloat(el.dataset[key]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function bool(el, key, fallback) {
    const raw = el.dataset[key];
    if (raw === undefined) return fallback;
    return raw !== 'false';
  }

  function createTextLoop(root, index) {
    const cfg = {
      text: root.dataset.text || 'React ✦ Bits',
      shape: root.dataset.shape || 'wave',
      path: root.dataset.path || null,
      speed: num(root, 'speed', 90),
      direction: root.dataset.direction === 'reverse' ? 'reverse' : 'forward',
      separator: root.dataset.separator !== undefined ? root.dataset.separator : '✦',
      curviness: num(root, 'curviness', 90),
      fontSize: num(root, 'fontSize', 46),
      fontWeight: num(root, 'fontWeight', 800),
      letterSpacing: num(root, 'letterSpacing', 2),
      uppercase: bool(root, 'uppercase', true),
      color: root.dataset.color || '#ffffff',
      ribbon: bool(root, 'ribbon', true),
      ribbonColor: root.dataset.ribbonColor || '#5227FF',
      ribbonWidth: num(root, 'ribbonWidth', 86),
      pauseOnHover: bool(root, 'pauseOnHover', true),
      viewHeight: num(root, 'viewHeight', 520)
    };

    const pathId = `text-loop-path-${index}`;
    const d = cfg.path || buildPath(cfg.shape, cfg.curviness, cfg.ribbonWidth, cfg.viewHeight);

    const base = cfg.uppercase ? String(cfg.text).toUpperCase() : String(cfg.text);
    const gap = cfg.separator ? ` ${cfg.separator} ` : '   ';
    const unit = `${base}${gap}`;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'text-loop-svg');
    svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${cfg.viewHeight}`);

    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');

    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const pathEl = document.createElementNS(SVG_NS, 'path');
    pathEl.setAttribute('id', pathId);
    pathEl.setAttribute('d', d);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', cfg.ribbon ? cfg.ribbonColor : 'none');
    pathEl.setAttribute('stroke-width', cfg.ribbon ? cfg.ribbonWidth : 0);
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(pathEl);

    const styleText = (el) => {
      el.style.fontSize = `${cfg.fontSize}px`;
      el.style.fontWeight = cfg.fontWeight;
      el.style.letterSpacing = `${cfg.letterSpacing}px`;
    };

    const measureEl = document.createElementNS(SVG_NS, 'text');
    measureEl.setAttribute('class', 'text-loop-measure');
    measureEl.textContent = unit;
    styleText(measureEl);
    svg.appendChild(measureEl);

    const makeRunner = () => {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('class', 'text-loop-text');
      text.setAttribute('fill', cfg.color);
      text.setAttribute('dominant-baseline', 'central');
      styleText(text);

      const tp = document.createElementNS(SVG_NS, 'textPath');
      tp.setAttribute('href', `#${pathId}`);
      tp.setAttribute('startOffset', '0');
      tp.setAttribute('lengthAdjust', 'spacing');
      text.appendChild(tp);
      svg.appendChild(text);
      return tp;
    };

    const head = makeRunner();
    const tail = makeRunner();

    root.appendChild(svg);

    let length = 0;
    let tween = null;

    function measure() {
      let unitWidth = 0;
      try {
        length = pathEl.getTotalLength();
        unitWidth = measureEl.getComputedTextLength();
      } catch (e) {
        return;
      }
      if (!length) return;

      const reps = unitWidth > 0 ? Math.max(1, Math.round(length / unitWidth)) : 1;
      const loopText = unit.repeat(reps);

      [head, tail].forEach((tp) => {
        tp.textContent = loopText;
        tp.setAttribute('textLength', String(length));
      });

      apply(0);
      start();
    }

    function apply(offset) {
      const partner = offset >= 0 ? offset - length : offset + length;
      head.setAttribute('startOffset', String(offset));
      tail.setAttribute('startOffset', String(partner));
    }

    function start() {
      tween?.kill();

      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced || cfg.speed <= 0 || typeof gsap === 'undefined') return;

      const state = { offset: 0 };
      tween = gsap.to(state, {
        offset: cfg.direction === 'reverse' ? -length : length,
        duration: length / cfg.speed,
        ease: 'none',
        repeat: -1,
        onUpdate: () => apply(state.offset)
      });

      if (cfg.pauseOnHover) {
        root.addEventListener('pointerenter', () => tween && tween.pause());
        root.addEventListener('pointerleave', () => tween && tween.resume());
      }

      const io = new IntersectionObserver(([entry]) => {
        if (!tween) return;
        entry.isIntersecting ? tween.resume() : tween.pause();
      }, { threshold: 0 });
      io.observe(root);
    }

    measure();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure);
    }

    return { refresh: measure, destroy: () => tween?.kill() };
  }

  const loops = [];
  document.querySelectorAll('[data-text-loop]').forEach((el, i) => {
    el.classList.add('text-loop');
    loops.push(createTextLoop(el, i));
  });

  window.portfolioTextLoop = loops;
})();

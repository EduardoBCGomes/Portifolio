(function () {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  };

  const num = (el, attr, fallback) => {
    const raw = el.dataset[attr];
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function createScrollExpand(root) {
    const track = root.querySelector('.scroll-expand__track');
    const stage = root.querySelector('.scroll-expand__stage');
    const frame = root.querySelector('.scroll-expand__frame');
    const media = root.querySelector('.scroll-expand__media');
    const scrim = root.querySelector('.scroll-expand__scrim');
    const title = root.querySelector('.scroll-expand__title');
    const overlay = root.querySelector('.scroll-expand__overlay');
    const hint = root.querySelector('.scroll-expand__hint');

    if (!track || !stage || !frame || !media) return null;

    const cfg = {
      startWidth: num(root, 'startWidth', 42),
      startHeight: num(root, 'startHeight', 58),
      startRadius: num(root, 'startRadius', 24),
      endRadius: num(root, 'endRadius', 0),
      mediaZoom: num(root, 'mediaZoom', 1.35),
      scrollDistance: num(root, 'scrollDistance', 1.2),
      holdDistance: num(root, 'holdDistance', 0.35),
      smoothing: num(root, 'smoothing', 0.1),
      overlayScrim: num(root, 'overlayScrim', 0.45)
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function applyProgress(p) {
      const e = smoothstep(0, 1, p);

      const w = cfg.startWidth + (100 - cfg.startWidth) * e;
      const h = cfg.startHeight + (100 - cfg.startHeight) * e;
      const ix = Math.max(0, (100 - w) / 2);
      const iy = Math.max(0, (100 - h) / 2);
      const r = cfg.startRadius + (cfg.endRadius - cfg.startRadius) * e;

      frame.style.clipPath = `inset(${iy}% ${ix}% ${iy}% ${ix}% round ${r}px)`;
      media.style.transform = `scale(${cfg.mediaZoom + (1 - cfg.mediaZoom) * e})`;

      if (scrim) scrim.style.opacity = String(cfg.overlayScrim * e);

      if (title) {
        const out = smoothstep(0.4, 0.88, p);
        title.style.opacity = String(1 - out);
        title.style.transform = `translate3d(0, ${-28 * out}px, 0) scale(${1 + 0.06 * out})`;
      }

      if (hint) {
        const gone = smoothstep(0, 0.12, p);
        hint.style.opacity = String(1 - gone);
        hint.style.transform = `translate3d(0, ${8 * gone}px, 0)`;
      }

      if (overlay) {
        const inn = smoothstep(0.68, 1, p);
        overlay.style.opacity = String(inn);
        overlay.style.transform = `translate3d(0, ${18 * (1 - inn)}px, 0)`;
        overlay.setAttribute('aria-hidden', inn < 0.5 ? 'true' : 'false');
      }
    }

    let raf = 0;
    let current = 0;
    let target = 0;
    let stageH = 0;
    let running = false;

    function measure() {
      stageH = window.innerHeight;
      if (stageH <= 0) return;

      stage.style.height = `${stageH}px`;
      track.style.height =
        `${stageH * (1 + Math.max(0, cfg.scrollDistance) + Math.max(0, cfg.holdDistance))}px`;

      const w = root.clientWidth || stageH;

      stage.style.setProperty('--se-title-size', `${clamp(w * 0.042, 18, 54)}px`);
      stage.style.setProperty('--se-title-max', `${cfg.startWidth}%`);
    }

    function readProgress() {
      const span = stageH * Math.max(0.01, cfg.scrollDistance);
      return clamp(-track.getBoundingClientRect().top / span, 0, 1);
    }

    function tick() {
      const k = cfg.smoothing <= 0 ? 1 : 1 - Math.exp(-1 / (60 * cfg.smoothing));
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.0004) {
        current = target;
        running = false;
      }
      applyProgress(current);
      raf = running ? requestAnimationFrame(tick) : 0;
    }

    function kick() {
      if (running) return;
      running = true;
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function onScroll() {
      target = readProgress();
      if (cfg.smoothing <= 0) {
        current = target;
        applyProgress(current);
        return;
      }
      kick();
    }

    let lastW = window.innerWidth;
    let lastH = window.innerHeight;

    function onResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mudouDeVerdade = w !== lastW || Math.abs(h - lastH) > 140;
      if (!mudouDeVerdade) return;

      lastW = w;
      lastH = h;

      measure();
      target = readProgress();
      current = target;
      applyProgress(current);
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }

    if (reduceMotion) {
      root.classList.add('is-static');
      stage.style.height = '';
      track.style.height = '';
      applyProgress(1);
      return { destroy() {} };
    }

    measure();
    target = readProgress();
    current = target;
    applyProgress(current);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    if (window.ScrollTrigger) window.ScrollTrigger.refresh();

    return {
      refresh: onResize,
      destroy() {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
      }
    };
  }

  const instances = [];
  document.querySelectorAll('[data-scroll-expand]').forEach((el) => {
    const instance = createScrollExpand(el);
    if (instance) {
      el.classList.add('is-ready');
      instances.push(instance);
    }
  });

  window.portfolioScrollExpand = instances;
})();

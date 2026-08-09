(function () {
  'use strict';

  const CURVES = {
    linear: (p) => p,
    bezier: (p) => p * p * (3 - 2 * p),
    'ease-in': (p) => p * p,
    'ease-out': (p) => 1 - Math.pow(1 - p, 2),
    'ease-in-out': (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
  };

  const DIRECTION = {
    top: 'to top',
    bottom: 'to bottom',
    left: 'to left',
    right: 'to right'
  };

  const PRESETS = {
    subtle: { height: '4rem', strength: 1, opacity: 0.8, divCount: 3 },
    intense: { height: '10rem', strength: 4, divCount: 8, exponential: true },
    smooth: { height: '8rem', curve: 'bezier', divCount: 10 },
    sharp: { height: '5rem', curve: 'linear', divCount: 4 },
    header: { position: 'top', height: '8rem', curve: 'ease-out' },
    footer: { position: 'bottom', height: '8rem', curve: 'ease-out' },
    'page-header': { position: 'top', height: '10rem', target: 'page', strength: 3 },
    'page-footer': { position: 'bottom', height: '10rem', target: 'page', strength: 3 }
  };

  const DEFAULTS = {
    position: 'bottom',
    strength: 2,
    height: '6rem',
    width: null,
    divCount: 5,
    exponential: false,
    zIndex: 1000,
    animated: false,
    duration: '0.3s',
    easing: 'ease-out',
    opacity: 1,
    curve: 'linear',
    target: 'parent',
    hoverIntensity: null
  };

  function readConfig(el) {
    const d = el.dataset;
    const preset = d.preset && PRESETS[d.preset] ? PRESETS[d.preset] : {};
    const cfg = Object.assign({}, DEFAULTS, preset);

    if (d.position) cfg.position = d.position;
    if (d.height) cfg.height = d.height;
    if (d.width) cfg.width = d.width;
    if (d.curve) cfg.curve = d.curve;
    if (d.target) cfg.target = d.target;
    if (d.duration) cfg.duration = d.duration;
    if (d.easing) cfg.easing = d.easing;
    if (d.animated) cfg.animated = d.animated === 'scroll' ? 'scroll' : d.animated !== 'false';
    if (d.exponential) cfg.exponential = d.exponential !== 'false';

    const nums = { strength: 'strength', divCount: 'divCount', opacity: 'opacity', zIndex: 'zIndex', hoverIntensity: 'hoverIntensity' };
    Object.keys(nums).forEach((key) => {
      const raw = d[key];
      if (raw === undefined) return;
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed)) cfg[key] = parsed;
    });

    return cfg;
  }

  function buildLayers(el, cfg, hovered) {
    const inner = el.querySelector('.gradual-blur-inner');
    inner.replaceChildren();

    const increment = 100 / cfg.divCount;
    const strength = hovered && cfg.hoverIntensity ? cfg.strength * cfg.hoverIntensity : cfg.strength;
    const curve = CURVES[cfg.curve] || CURVES.linear;
    const direction = DIRECTION[cfg.position] || 'to bottom';

    for (let i = 1; i <= cfg.divCount; i++) {
      const progress = curve(i / cfg.divCount);

      const blur = cfg.exponential
        ? Math.pow(2, progress * 4) * 0.0625 * strength
        : 0.0625 * (progress * cfg.divCount + 1) * strength;

      const p1 = Math.round((increment * i - increment) * 10) / 10;
      const p2 = Math.round(increment * i * 10) / 10;
      const p3 = Math.round((increment * i + increment) * 10) / 10;
      const p4 = Math.round((increment * i + increment * 2) * 10) / 10;

      let gradient = `transparent ${p1}%, black ${p2}%`;
      if (p3 <= 100) gradient += `, black ${p3}%`;
      if (p4 <= 100) gradient += `, transparent ${p4}%`;

      const mask = `linear-gradient(${direction}, ${gradient})`;
      const layer = document.createElement('div');

      Object.assign(layer.style, {
        position: 'absolute',
        inset: '0',
        maskImage: mask,
        webkitMaskImage: mask,
        backdropFilter: `blur(${blur.toFixed(3)}rem)`,
        webkitBackdropFilter: `blur(${blur.toFixed(3)}rem)`,
        opacity: String(cfg.opacity)
      });

      if (cfg.animated && cfg.animated !== 'scroll') {
        layer.style.transition = `backdrop-filter ${cfg.duration} ${cfg.easing}`;
      }

      inner.appendChild(layer);
    }
  }

  function applyContainerStyle(el, cfg, visible) {
    const isVertical = cfg.position === 'top' || cfg.position === 'bottom';
    const isPage = cfg.target === 'page';

    const s = el.style;
    s.position = isPage ? 'fixed' : 'absolute';
    s.pointerEvents = cfg.hoverIntensity ? 'auto' : 'none';
    s.opacity = visible ? '1' : '0';
    s.zIndex = String(isPage ? cfg.zIndex + 100 : cfg.zIndex);
    if (cfg.animated) s.transition = `opacity ${cfg.duration} ${cfg.easing}`;

    if (isVertical) {
      s.height = cfg.height;
      s.width = cfg.width || '100%';
      s.left = '0';
      s.right = '0';
      s[cfg.position] = '0';
    } else {
      s.width = cfg.width || cfg.height;
      s.height = '100%';
      s.top = '0';
      s.bottom = '0';
      s[cfg.position] = '0';
    }
  }

  document.querySelectorAll('[data-gradual-blur]').forEach((el) => {
    const cfg = readConfig(el);

    el.classList.add('gradual-blur');
    el.classList.add(cfg.target === 'page' ? 'gradual-blur-page' : 'gradual-blur-parent');
    el.setAttribute('aria-hidden', 'true');

    if (!el.querySelector('.gradual-blur-inner')) {
      const inner = document.createElement('div');
      inner.className = 'gradual-blur-inner';
      el.appendChild(inner);
    }

    buildLayers(el, cfg, false);
    applyContainerStyle(el, cfg, cfg.animated !== 'scroll');

    if (cfg.animated === 'scroll') {
      const io = new IntersectionObserver(
        ([entry]) => { el.style.opacity = entry.isIntersecting ? '1' : '0'; },
        { threshold: 0.1 }
      );
      io.observe(el);
    }

    if (cfg.hoverIntensity) {
      el.addEventListener('pointerenter', () => buildLayers(el, cfg, true));
      el.addEventListener('pointerleave', () => buildLayers(el, cfg, false));
    }

    if (cfg.target === 'page' && cfg.position === 'bottom') {
      const fim = document.querySelector('footer');
      if (fim) {
        new IntersectionObserver(
          ([entry]) => el.classList.toggle('is-at-end', entry.isIntersecting),
          { threshold: 0 }
        ).observe(fim);
      }
    }
  });
})();

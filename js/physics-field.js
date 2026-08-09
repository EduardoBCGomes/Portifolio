(function () {
  'use strict';

  const canvas = document.querySelector('[data-physics-field]');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SPACING = 46;
  const STIFFNESS = 26;
  const DAMPING = 3.4;
  const MOUSE_RADIUS = 190;
  const MOUSE_FORCE = 2600;
  const DRIFT = 14;
  const STEP = 1 / 120;

  const ACCENT = [196, 191, 182];
  const ACCENT_2 = [250, 249, 246];

  let points = [];
  let cols = 0;
  let rows = 0;
  let w = 0;
  let h = 0;
  let dpr = 1;

  const mouse = { x: -9999, y: -9999, active: false };

  function build() {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw < 2 || ch < 2) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = cw;
    h = ch;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cols = Math.ceil(w / SPACING) + 1;
    rows = Math.ceil(h / SPACING) + 1;

    const offsetX = (w - (cols - 1) * SPACING) / 2;
    const offsetY = (h - (rows - 1) * SPACING) / 2;

    points = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hx = offsetX + c * SPACING;
        const hy = offsetY + r * SPACING;
        points.push({
          hx, hy,
          x: hx, y: hy,
          vx: 0, vy: 0,

          phase: (c * 0.7 + r * 1.3)
        });
      }
    }
  }

  function simulate(dt, time) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];

      const tx = p.hx + Math.cos(time * 0.6 + p.phase) * DRIFT;
      const ty = p.hy + Math.sin(time * 0.5 + p.phase * 1.4) * DRIFT;

      let ax = (tx - p.x) * STIFFNESS - p.vx * DAMPING;
      let ay = (ty - p.y) * STIFFNESS - p.vy * DAMPING;

      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < MOUSE_RADIUS * MOUSE_RADIUS && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const falloff = 1 - dist / MOUSE_RADIUS;
          const force = (MOUSE_FORCE * falloff * falloff) / dist;
          ax += dx * force;
          ay += dy * force;
        }
      }

      p.vx += ax * dt;
      p.vy += ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.7);
    bg.addColorStop(0, 'rgba(56, 53, 49, 1)');
    bg.addColorStop(1, 'rgba(14, 12, 11, 1)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = points[r * cols + c];

        if (c < cols - 1) strokeLink(p, points[r * cols + c + 1]);
        if (r < rows - 1) strokeLink(p, points[(r + 1) * cols + c]);
      }
    }

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const dx = p.x - p.hx;
      const dy = p.y - p.hy;
      const disp = Math.min(Math.sqrt(dx * dx + dy * dy) / 70, 1);

      const radius = 1.9 + disp * 2.8;
      const alpha = 0.62 + disp * 0.36;
      const col = mix(ACCENT, ACCENT_2, disp);

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${alpha})`;
      ctx.fill();
    }
  }

  function strokeLink(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const stretch = Math.min(Math.abs(dist - SPACING) / 34, 1);
    const alpha = 0.26 + stretch * 0.5;
    const col = mix(ACCENT, ACCENT_2, stretch);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${alpha})`;
    ctx.stroke();
  }

  function mix(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  let paused = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);

    const delta = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (paused || !points.length) return;

    acc += delta;
    let guard = 0;
    while (acc >= STEP && guard < 8) {
      elapsed += STEP;
      simulate(STEP, elapsed);
      acc -= STEP;
      guard++;
    }
    if (guard === 8) acc = 0;

    draw();
  }

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const escalaX = canvas.clientWidth / rect.width;
    const escalaY = canvas.clientHeight / rect.height;

    const x = (e.clientX - rect.left) * escalaX;
    const y = (e.clientY - rect.top) * escalaY;

    mouse.active = x >= 0 && y >= 0 && x <= w && y <= h;
    mouse.x = x;
    mouse.y = y;
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', () => { mouse.active = false; });

  function rebuild() {
    build();
    if (points.length) draw();
  }

  const ro = new ResizeObserver(rebuild);
  ro.observe(canvas);
  rebuild();

  if (prefersReduced) {
    simulate(STEP, 0);
    draw();
    return;
  }

  raf = requestAnimationFrame(frame);

  const io = new IntersectionObserver(
    ([entry]) => {
      paused = !entry.isIntersecting;
      if (!paused) last = performance.now();
    },
    { threshold: 0 }
  );
  io.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (!paused) last = performance.now();
  });
})();

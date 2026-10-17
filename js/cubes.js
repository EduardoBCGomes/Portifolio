(function () {
  'use strict';

  const VERTEX = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aUv;
in vec2 aCenter;
in vec4 aRotation;
in vec2 aState;
uniform mat4 uProjection;
uniform float uSize;
out vec3 vNormal;
out vec2 vUv;
out float vFlash;

vec3 turn(vec4 q, vec3 v) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

void main() {
  vec3 local = turn(aRotation, aPosition * uSize * aState.y);
  vNormal = turn(aRotation, aNormal);
  vUv = aUv;
  vFlash = aState.x;
  gl_Position = uProjection * vec4(vec3(aCenter, 0.0) + local, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUv;
in float vFlash;
uniform vec3 uFace;
uniform vec3 uEdge;
uniform vec3 uRipple;
uniform vec3 uLight;
uniform float uShading;
uniform float uEdgeWidth;
uniform float uStyle;
uniform float uMarks;
uniform float uOpacity;
out vec4 outColor;

void main() {
  vec2 span = max(fwidth(vUv), vec2(0.00001));
  vec2 border = min(vUv, 1.0 - vUv) / span;
  bool vertical = border.x < border.y;
  float distance = min(border.x, border.y);
  float halfWidth = uEdgeWidth * 0.5;
  float cover = 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distance);
  float along = vertical ? vUv.y : vUv.x;
  float phase = along * uMarks;
  float step = max(vertical ? span.y : span.x, 0.00001) * uMarks;
  float offset = abs(fract(phase + 0.5) - 0.5);
  if (uStyle > 0.5 && uStyle < 1.5) {
    cover *= 1.0 - smoothstep(0.25 - step, 0.25 + step, offset);
  } else if (uStyle > 1.5 && uStyle < 2.5) {
    float radius = max(uEdgeWidth * 0.9, 1.0);
    float dot = length(vec2(offset / step, distance));
    cover = 1.0 - smoothstep(radius - 0.75, radius + 0.75, dot);
  } else if (uStyle > 2.5) {
    cover = 0.0;
  }
  vec3 normal = normalize(vNormal);
  cover *= smoothstep(0.06, 0.28, abs(normal.z));
  float side = clamp(1.0 - normal.z, 0.0, 1.0);
  float toward = clamp(0.6 + 0.6 * dot(normalize(normal.xy + vec2(0.00001)), normalize(uLight.xy)), 0.0, 1.0);
  vec3 face = mix(uFace, uEdge, side * mix(0.12, 0.42, toward) * uShading);
  face = mix(face, uRipple, vFlash * 0.22);
  vec3 edge = mix(uEdge, uRipple, vFlash);
  vec3 color = mix(face, edge, cover);
  float alpha = mix(uOpacity, 1.0, cover);
  outColor = vec4(color * alpha, alpha);
}`;

  const FACES = [
    [0, 0, 1, 1, 0, 0, 0, 1, 0],
    [0, 0, -1, -1, 0, 0, 0, 1, 0],
    [1, 0, 0, 0, 0, -1, 0, 1, 0],
    [-1, 0, 0, 0, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 0, 0, 0, -1],
    [0, -1, 0, 1, 0, 0, 0, 0, 1]
  ];

  const STYLES = { solid: 0, dashed: 1, dotted: 2, none: 3 };
  const INTRO_SECONDS = 1.1;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function buildCube() {
    const vertices = [];
    const indices = [];
    FACES.forEach(([nx, ny, nz, ux, uy, uz, vx, vy, vz], face) => {
      [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v]) => {
        vertices.push(
          nx * 0.5 + (u - 0.5) * ux + (v - 0.5) * vx,
          ny * 0.5 + (u - 0.5) * uy + (v - 0.5) * vy,
          nz * 0.5 + (u - 0.5) * uz + (v - 0.5) * vz,
          nx, ny, nz, u, v
        );
      });
      const base = face * 4;
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
  }

  function compile(gl, type, source) {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
    console.error('[cubes]', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }

  function link(gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    ['aPosition', 'aNormal', 'aUv', 'aCenter', 'aRotation', 'aState']
      .forEach((name, i) => gl.bindAttribLocation(program, i, name));
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    const uniforms = {};
    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
    return { program, uniforms };
  }

  function toRotation(rx, ry, out, o) {
    const angle = Math.hypot(rx, ry);
    if (angle < 0.000001) {
      out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 1;
      return;
    }
    const s = Math.sin(angle / 2) / angle;
    out[o] = rx * s;
    out[o + 1] = ry * s;
    out[o + 2] = 0;
    out[o + 3] = Math.cos(angle / 2);
  }

  function multiply(a, b, out, o) {
    const [ax, ay, az, aw] = a;
    const [bx, by, bz, bw] = b;
    out[o] = aw * bx + ax * bw + ay * bz - az * by;
    out[o + 1] = aw * by - ax * bz + ay * bw + az * bx;
    out[o + 2] = aw * bz + ax * by - ay * bx + az * bw;
    out[o + 3] = aw * bw - ax * bx - ay * by - az * bz;
  }

  function projection(width, height, scale, perspective) {
    const hw = width / 2 / scale;
    const hh = height / 2 / scale;
    const depth = Math.max(hw, hh) * 4 + 4;
    if (perspective <= 0.001) {
      return new Float32Array([1 / hw, 0, 0, 0, 0, 1 / hh, 0, 0, 0, 0, -1 / depth, 0, 0, 0, 0, 1]);
    }
    const fov = ((8 + perspective * 52) * Math.PI) / 180;
    const distance = hh / Math.tan(fov / 2);
    const near = Math.max(0.1, distance - depth);
    const far = distance + depth;
    const f = 1 / Math.tan(fov / 2);
    const aspect = hw / hh;
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far) - ((far + near) / (near - far)) * distance, distance
    ]);
  }

  function num(el, k, d) {
    const v = parseFloat(el.dataset[k]);
    return Number.isFinite(v) ? v : d;
  }
  function bool(el, k, d) {
    const v = el.dataset[k];
    return v === undefined ? d : v !== 'false';
  }

  function iniciar(container) {
    const s = {
      gridSize: Math.round(clamp(num(container, 'gridSize', 10), 1, 40)),
      gap: clamp(num(container, 'gap', 0.18), 0, 0.9),
      faceColor: container.dataset.faceColor || '#120F17',
      edgeColor: container.dataset.edgeColor || '#ffffff',
      edgeWidth: Math.max(0, num(container, 'edgeWidth', 1)),
      edgeStyle: container.dataset.edgeStyle || 'solid',
      faceOpacity: clamp(num(container, 'faceOpacity', 1), 0, 1),
      shading: Math.max(0, num(container, 'shading', 0.6)),
      maxAngle: num(container, 'maxAngle', 45),
      radius: Math.max(0.5, num(container, 'radius', 3)),
      speed: Math.max(0.05, num(container, 'speed', 1)),
      bounce: clamp(num(container, 'bounce', 0.4), 0, 1),
      brush: Math.max(0, num(container, 'brush', 1)),
      perspective: clamp(num(container, 'perspective', 0), 0, 1),
      autoAnimate: bool(container, 'autoAnimate', true),
      rippleOnClick: bool(container, 'rippleOnClick', true),
      rippleColor: container.dataset.rippleColor || '#ffffff',
      rippleSpeed: Math.max(0.05, num(container, 'rippleSpeed', 1)),
      intro: bool(container, 'intro', true)
    };

    const canvas = document.createElement('canvas');
    canvas.className = 'cubes-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: false
    });
    if (!gl) { canvas.remove(); return; }
    const shader = link(gl);
    if (!shader) { canvas.remove(); return; }

    const cube = buildCube();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cube.vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube.indices, gl.STATIC_DRAW);
    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    [[3, 2, 0], [4, 4, 8], [5, 2, 24]].forEach(([loc, size, off]) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 32, off);
      gl.vertexAttribDivisor(loc, 1);
    });

    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const toRgb = (value) => {
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = '#ffffff';
      probe.fillStyle = value;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      return [r / 255, g / 255, b / 255];
    };
    const cores = { face: toRgb(s.faceColor), edge: toRgb(s.edgeColor), ripple: toRgb(s.rippleColor) };

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const view = { width: 1, height: 1, ratio: 1, scale: 1 };
    const pointer = { x: 0, y: 0, inside: false, moved: -99 };
    const cursor = { x: 0, y: 0, vx: 0, vy: 0, weight: 0, primed: false };
    // O original usa uma grade quadrada (gridSize x gridSize). Aqui a secao
    // ocupa a tela inteira, que e larga: as linhas vem de gridSize e as
    // colunas da proporcao, para nao sobrar faixa vazia nas laterais.
    const grid = { cols: 0, rows: 0, count: 0 };
    let rx = new Float32Array(0);
    let ry = new Float32Array(0);
    let wx = new Float32Array(0);
    let wy = new Float32Array(0);
    let glow = new Float32Array(0);
    let delays = new Float32Array(0);
    let instances = new Float32Array(0);
    const rings = [];
    let clock = 0;
    let introClock = s.intro && !reduce ? 0 : 99;
    let raf = 0;
    let last = 0;
    let visible = true;

    function allocate(cols, rows) {
      if (grid.cols === cols && grid.rows === rows) return;
      grid.cols = cols;
      grid.rows = rows;
      grid.count = cols * rows;
      rx = new Float32Array(grid.count);
      ry = new Float32Array(grid.count);
      wx = new Float32Array(grid.count);
      wy = new Float32Array(grid.count);
      glow = new Float32Array(grid.count);
      delays = new Float32Array(grid.count);
      instances = new Float32Array(grid.count * 8);
      const ccx = (cols - 1) / 2;
      const ccy = (rows - 1) / 2;
      const norma = Math.max(1, Math.max(cols, rows) / 2);
      for (let i = 0; i < grid.count; i++) {
        delays[i] = Math.hypot((i % cols) - ccx, Math.floor(i / cols) - ccy) / norma;
      }
    }

    const cellOf = (i) => [
      (i % grid.cols) - (grid.cols - 1) / 2,
      (grid.rows - 1) / 2 - Math.floor(i / grid.cols)
    ];

    const toWorld = (x, y) => [(x - view.width / 2) / view.scale, (view.height / 2 - y) / view.scale];

    function render() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!grid.count) return;
      gl.useProgram(shader.program);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, instances, gl.DYNAMIC_DRAW);
      const u = shader.uniforms;
      gl.uniformMatrix4fv(u.uProjection, false, projection(view.width, view.height, view.scale, s.perspective));
      gl.uniform1f(u.uSize, 1 - s.gap);
      gl.uniform3fv(u.uFace, cores.face);
      gl.uniform3fv(u.uEdge, cores.edge);
      gl.uniform3fv(u.uRipple, cores.ripple);
      const light = [-0.42, 0.55, 0.72];
      const len = Math.hypot(...light);
      gl.uniform3f(u.uLight, light[0] / len, light[1] / len, light[2] / len);
      gl.uniform1f(u.uShading, s.shading);
      gl.uniform1f(u.uEdgeWidth, s.edgeWidth * view.ratio);
      gl.uniform1f(u.uStyle, STYLES[s.edgeStyle] ?? 0);
      const cubePixels = (1 - s.gap) * view.scale;
      const spacing = s.edgeStyle === 'dotted' ? Math.max(4, s.edgeWidth * 4) : Math.max(6, s.edgeWidth * 6);
      gl.uniform1f(u.uMarks, Math.max(1, Math.round(cubePixels / spacing)));
      gl.uniform1f(u.uOpacity, s.faceOpacity);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (s.faceOpacity >= 0.999) {
        gl.depthMask(true);
        gl.cullFace(gl.BACK);
        gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, grid.count);
      } else {
        gl.depthMask(false);
        gl.cullFace(gl.FRONT);
        gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, grid.count);
        gl.cullFace(gl.BACK);
        gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, grid.count);
        gl.depthMask(true);
      }
    }

    function step(dt) {
      clock += dt;
      if (introClock < 99) introClock += dt;

      const live = s.autoAnimate && !reduce && (!pointer.inside || clock - pointer.moved > 3);
      let goalX = cursor.x;
      let goalY = cursor.y;
      let engaged = false;
      if (pointer.inside && clock - pointer.moved <= 3) {
        [goalX, goalY] = toWorld(pointer.x, pointer.y);
        engaged = true;
      } else if (live) {
        goalX = Math.sin(clock * 0.37) * grid.cols * 0.42 * Math.cos(clock * 0.11);
        goalY = Math.sin(clock * 0.53 + 1.2) * grid.rows * 0.42;
        engaged = true;
      }
      if (!cursor.primed && engaged) {
        cursor.x = goalX;
        cursor.y = goalY;
        cursor.primed = true;
      }
      const follow = 1 - Math.exp(-dt * 18);
      const px = cursor.x;
      const py = cursor.y;
      cursor.x += (goalX - cursor.x) * follow;
      cursor.y += (goalY - cursor.y) * follow;
      const blend = 1 - Math.exp(-dt * 10);
      cursor.vx += ((cursor.x - px) / Math.max(dt, 0.001) - cursor.vx) * blend;
      cursor.vy += ((cursor.y - py) / Math.max(dt, 0.001) - cursor.vy) * blend;
      cursor.weight += ((engaged ? 1 : 0) - cursor.weight) * (1 - Math.exp(-dt * (engaged ? 6 : 2.5)));

      const stiffness = 160 * s.speed * s.speed;
      const damping = 2 * (1 - 0.82 * s.bounce) * Math.sqrt(stiffness);
      const maxAngle = (s.maxAngle * Math.PI) / 180;
      const lift = 0.8;
      const travel = 8 * s.rippleSpeed;
      const fade = Math.exp(-dt * 3.2);
      const maior = Math.max(grid.cols, grid.rows);
      const reachLimit = maior * 1.5 + 2;
      for (let k = rings.length - 1; k >= 0; k--) {
        if ((clock - rings[k].born) * travel > reachLimit) rings.splice(k, 1);
      }
      const speedNow = Math.hypot(cursor.vx, cursor.vy);
      const sweepX = speedNow > 0.0001 ? -cursor.vy / speedNow : 0;
      const sweepY = speedNow > 0.0001 ? cursor.vx / speedNow : 0;
      const sweep = reduce ? 0 : Math.min(speedNow, 40) * s.brush * 1.6;
      let moving = false;

      for (let i = 0; i < grid.count; i++) {
        const [cx, cy] = cellOf(i);
        const dx = cx - cursor.x;
        const dy = cy - cursor.y;
        const distance = Math.hypot(dx, dy);
        const t = distance / s.radius;
        const falloff = t < 1 ? (1 - t * t) * (1 - t * t) * cursor.weight : 0;
        let targetX = 0;
        let targetY = 0;
        if (falloff > 0 && distance > 0.0001) {
          const tilt = maxAngle * falloff * (distance / Math.hypot(distance, lift));
          targetX = (dy / distance) * tilt;
          targetY = (-dx / distance) * tilt;
        }
        if (falloff > 0 && sweep > 0) {
          wx[i] += sweepX * sweep * falloff * dt * 4;
          wy[i] += sweepY * sweep * falloff * dt * 4;
        }
        glow[i] *= fade;
        for (let k = 0; k < rings.length; k++) {
          const ring = rings[k];
          const ox = cx - ring.x;
          const oy = cy - ring.y;
          const reach = Math.hypot(ox, oy);
          const now = (clock - ring.born) * travel;
          if (reach > now || reach <= now - travel * dt || reach < 0.0001) continue;
          const strength = Math.exp(-reach / (maior * 0.8));
          wx[i] -= (oy / reach) * 13 * strength;
          wy[i] += (ox / reach) * 13 * strength;
          glow[i] = Math.max(glow[i], strength);
        }
        if (glow[i] > 0.01) moving = true;
        if (reduce) {
          rx[i] = targetX; ry[i] = targetY; wx[i] = 0; wy[i] = 0;
        } else {
          wx[i] += (stiffness * (targetX - rx[i]) - damping * wx[i]) * dt;
          wy[i] += (stiffness * (targetY - ry[i]) - damping * wy[i]) * dt;
          rx[i] += wx[i] * dt;
          ry[i] += wy[i] * dt;
        }
        if (Math.abs(targetX - rx[i]) + Math.abs(targetY - ry[i]) > 0.0005 ||
            Math.abs(wx[i]) + Math.abs(wy[i]) > 0.0005) moving = true;

        let grow = 1;
        let tumble = 0;
        if (introClock < 99) {
          const local = clamp((introClock - delays[i] * 0.55) / INTRO_SECONDS, 0, 1);
          const eased = 1 - Math.pow(1 - local, 3);
          grow = eased;
          tumble = (1 - eased) * (Math.PI / 2);
          if (local < 1) moving = true;
        }

        const tilt = [0, 0, 0, 1];
        toRotation(rx[i], ry[i], tilt, 0);
        const turnQ = [Math.sin(tumble / 2), 0, 0, Math.cos(tumble / 2)];
        const base = i * 8;
        instances[base] = cx;
        instances[base + 1] = cy;
        multiply(tilt, turnQ, instances, base + 2);
        instances[base + 6] = glow[i];
        instances[base + 7] = grow;
      }
      if (introClock >= INTRO_SECONDS + 0.6 && introClock < 99) introClock = 99;
      return moving || live || rings.length > 0 || (engaged && speedNow > 0.01) ||
        Math.abs((engaged ? 1 : 0) - cursor.weight) > 0.002;
    }

    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const active = step(dt);
      render();
      if (active) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function wake() {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    function resize() {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const teto = window.innerWidth < 700 ? 1.5 : 2;
      view.ratio = Math.min(window.devicePixelRatio || 1, teto);
      view.width = width;
      view.height = height;
      const rows = s.gridSize;
      view.scale = height / (rows + 0.9);
      const cols = Math.max(rows, Math.ceil(width / view.scale) + 1);
      canvas.width = Math.max(1, Math.round(width * view.ratio));
      canvas.height = Math.max(1, Math.round(height * view.ratio));
      allocate(cols, rows);
      if (!raf) { step(0); render(); }
      wake();
    }

    // O ScrollExpand aplica scale() neste container. clientWidth e o tamanho
    // logico; o rect ja vem escalado — sem converter, o cursor sai deslocado.
    function pontoLocal(e) {
      const rect = container.getBoundingClientRect();
      const kx = rect.width ? container.clientWidth / rect.width : 1;
      const ky = rect.height ? container.clientHeight / rect.height : 1;
      return [(e.clientX - rect.left) * kx, (e.clientY - rect.top) * ky];
    }

    window.addEventListener('pointermove', (e) => {
      const [x, y] = pontoLocal(e);
      pointer.x = x;
      pointer.y = y;
      pointer.inside = x >= 0 && y >= 0 && x <= view.width && y <= view.height;
      if (pointer.inside) pointer.moved = clock;
      wake();
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', () => { pointer.inside = false; wake(); });

    container.addEventListener('pointerdown', (e) => {
      if (!s.rippleOnClick || reduce) return;
      const [x, y] = pontoLocal(e);
      const [ox, oy] = toWorld(x, y);
      rings.push({ x: ox, y: oy, born: clock });
      if (rings.length > 6) rings.shift();
      wake();
    });

    document.addEventListener('visibilitychange', () => { last = 0; wake(); });

    let ultimoW = 0;
    let ultimoH = 0;
    new ResizeObserver(() => {
      if (container.clientWidth === ultimoW && container.clientHeight === ultimoH) return;
      ultimoW = container.clientWidth;
      ultimoH = container.clientHeight;
      resize();
    }).observe(container);

    new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
      if (visible) { last = 0; wake(); }
    }).observe(container);

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); });

    container.classList.add('is-ready');
    resize();
  }

  document.querySelectorAll('[data-cubes]').forEach(iniciar);
})();

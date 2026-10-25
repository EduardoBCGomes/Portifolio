(function () {
  'use strict';

  const VELOCIDADE = 26;
  const LIMIAR_ARRASTO = 6;

  function iniciar(raiz) {
    const janela = raiz.querySelector('.carrossel__janela');
    const trilho = raiz.querySelector('.carrossel__trilho');
    const anuncio = raiz.querySelector('[data-carrossel-anuncio]');
    if (!janela || !trilho || typeof gsap === 'undefined') return;
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    const originais = [...trilho.children];
    const n = originais.length;
    if (!n) return;

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzido) raiz.classList.add('sem-movimento');

    const st = {
      offset: 0,
      periodo: 0,
      passo: 0,
      hover: false,
      foco: false,
      visivel: true,
      arrasto: null,
      tween: null,
      bloquearCliqueAte: 0
    };

    function copia(item) {
      const c = item.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.setAttribute('data-copia', '');
      c.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
      c.querySelectorAll('.projeto').forEach((p) => {
        p.style.removeProperty('opacity');
        p.style.removeProperty('clip-path');
        p.style.removeProperty('transform');
        p.style.removeProperty('translate');
      });
      c.querySelectorAll('.projeto__imagem').forEach((img) => {
        img.style.removeProperty('transform');
        img.style.removeProperty('transition');
      });
      return c;
    }

    function montarCopias() {
      trilho.querySelectorAll('[data-copia]').forEach((c) => c.remove());
      originais.forEach((item) => trilho.insertBefore(copia(item), originais[0]));
      st.periodo = originais[0].offsetLeft - trilho.children[0].offsetLeft;
      const larguraJanela = janela.clientWidth;
      let copias = 0;
      do {
        originais.forEach((item) => trilho.appendChild(copia(item)));
        copias++;
      } while (st.periodo > 0 && st.periodo * copias < larguraJanela * 1.2 && copias < 8);
      st.passo = st.periodo / n;
      aplicar();
    }

    function aplicar() {
      if (st.periodo <= 0) return;
      const p = st.periodo;
      const x = ((st.offset % p) + p) % p;
      gsap.set(trilho, { x: -p - x });
    }

    function indiceAtual() {
      if (!st.passo) return 0;
      return ((Math.round(st.offset / st.passo) % n) + n) % n;
    }

    function anunciar() {
      if (!anuncio) return;
      const i = indiceAtual();
      const link = originais[i].querySelector('.projeto__link');
      const titulo = link && link.firstChild ? link.firstChild.textContent.trim() : '';
      anuncio.textContent = `Projeto ${i + 1} de ${n}: ${titulo}`;
    }

    const parado = () =>
      reduzido || st.hover || st.dedo || st.foco || !st.visivel || st.arrasto || st.tween ||
      document.documentElement.classList.contains('sem-movimento');

    let impulso = 0;
    if (window.ScrollTrigger && !reduzido) {
      ScrollTrigger.create({
        trigger: raiz,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          impulso = gsap.utils.clamp(-2400, 2400, self.getVelocity()) * 0.35;
        }
      });
    }

    const quieto = () => document.documentElement.classList.contains('sem-movimento');
    const inclinar = reduzido ? null : gsap.quickTo(trilho, 'skewX', { duration: .45, ease: 'power3.out' });
    let ultimoOffset = 0;
    let velocidade = 0;
    let inclinacao = 0;

    function tique(_tempo, deltaMs) {
      const dt = Math.min(deltaMs, 64) / 1000;
      impulso *= Math.exp(-dt * 3);
      if (!parado()) {
        st.offset += (VELOCIDADE + impulso) * dt;
        aplicar();
      }
      if (!inclinar || !dt) return;
      const instante = (st.offset - ultimoOffset) / dt;
      ultimoOffset = st.offset;
      velocidade += (instante - velocidade) * (1 - Math.exp(-dt * 10));
      let alvo = quieto() ? 0 : gsap.utils.clamp(-3, 3, velocidade / 420);
      if (Math.abs(alvo) < .2) alvo = 0;
      if (Math.abs(alvo - inclinacao) < .05) return;
      inclinacao = alvo;
      inclinar(alvo);
    }
    gsap.ticker.add(tique);

    function entrada() {
      if (!window.ScrollTrigger || reduzido) return;
      const cartoes = [...trilho.querySelectorAll('.projeto')];
      gsap.set(cartoes, { clipPath: 'inset(14% 0% 0% 0% round 0px)', yPercent: 8, opacity: 0 });
      gsap.to(cartoes, {
        clipPath: 'inset(0% 0% 0% 0% round 0px)',
        yPercent: 0,
        opacity: 1,
        duration: 1.1,
        ease: 'power3.out',
        stagger: 0.09,
        scrollTrigger: { trigger: raiz, start: 'top 82%', once: true },
        onComplete: () => gsap.set(cartoes, { clearProps: 'clipPath,transform,opacity' })
      });
    }

    function irPara(direcao) {
      if (!st.passo) return;
      if (st.tween) st.tween.kill();
      const base = Math.round(st.offset / st.passo) * st.passo;
      const alvo = base + direcao * st.passo;
      st.tween = gsap.to(st, {
        offset: alvo,
        duration: reduzido ? 0.01 : 0.7,
        ease: 'power3.inOut',
        onUpdate: aplicar,
        onComplete: () => { st.tween = null; anunciar(); }
      });
    }

    raiz.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') st.hover = true; });
    raiz.addEventListener('pointerleave', () => { st.hover = false; itemSobMouse = null; });

    const vidro = raiz.querySelector('.carrossel__vidro--esq');
    let itemSobMouse = null;
    trilho.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse' || st.arrasto || !st.passo) return;
      const item = e.target.closest('.carrossel__item');
      if (!item || item === itemSobMouse) return;
      itemSobMouse = item;
      const j = janela.getBoundingClientRect();
      const r = item.getBoundingClientRect();
      const margem = (vidro ? vidro.getBoundingClientRect().width : 0) + 8;
      const min = j.left + margem;
      const max = j.right - margem;
      let delta = 0;
      if (r.width > max - min || r.left < min) delta = r.left - min;
      else if (r.right > max) delta = r.right - max;
      if (Math.abs(delta) < 2) return;
      if (st.tween) st.tween.kill();
      st.tween = gsap.to(st, {
        offset: st.offset + delta,
        duration: reduzido ? 0.01 : 0.55,
        ease: 'power3.out',
        onUpdate: aplicar,
        onComplete: () => { st.tween = null; }
      });
    });

    let retomar = 0;
    raiz.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      clearTimeout(retomar);
      st.dedo = true;
    });
    const soltarDedo = (e) => {
      if (e.pointerType === 'mouse') return;
      clearTimeout(retomar);
      retomar = setTimeout(() => { st.dedo = false; }, 1500);
    };
    raiz.addEventListener('pointerup', soltarDedo);
    raiz.addEventListener('pointercancel', soltarDedo);
    raiz.addEventListener('focusin', (e) => {
      st.foco = true;
      const item = e.target.closest('.carrossel__item');
      const i = originais.indexOf(item);
      if (i < 0 || !st.passo) return;
      const voltas = Math.round((st.offset - i * st.passo) / st.periodo);
      const alvo = voltas * st.periodo + i * st.passo;
      if (st.tween) st.tween.kill();
      st.tween = gsap.to(st, {
        offset: alvo,
        duration: reduzido ? 0.01 : 0.6,
        ease: 'power3.out',
        onUpdate: aplicar,
        onComplete: () => { st.tween = null; }
      });
    });
    raiz.addEventListener('focusout', (e) => {
      if (!raiz.contains(e.relatedTarget)) st.foco = false;
    });

    raiz.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); irPara(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); irPara(-1); }
    });

    trilho.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      st.arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY, inicio: st.offset, ativo: false, amostras: [] };
    });

    trilho.addEventListener('pointermove', (e) => {
      const d = st.arrasto;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      if (!d.ativo) {
        if (Math.abs(dx) < LIMIAR_ARRASTO) return;
        if (Math.abs(e.clientY - d.y) > Math.abs(dx)) { st.arrasto = null; return; }
        d.ativo = true;
        if (st.tween) { st.tween.kill(); st.tween = null; }
        d.inicio = st.offset + dx;
        try { trilho.setPointerCapture(e.pointerId); } catch (err) { }
        raiz.setAttribute('data-arrastando', '');
      }
      st.offset = d.inicio - dx;
      const agora = performance.now();
      d.amostras.push([agora, dx]);
      while (d.amostras.length > 2 && agora - d.amostras[0][0] > 100) d.amostras.shift();
      aplicar();
    });

    function soltar(e, cancelado) {
      const d = st.arrasto;
      if (!d || e.pointerId !== d.id) return;
      st.arrasto = null;
      if (!d.ativo) return;
      raiz.removeAttribute('data-arrastando');
      try { trilho.releasePointerCapture(e.pointerId); } catch (err) { }
      st.bloquearCliqueAte = performance.now() + 350;

      let v = 0;
      const s = d.amostras;
      if (!cancelado && s.length > 1) {
        const [t0, a0] = s[0];
        const [t1, a1] = s[s.length - 1];
        if (t1 > t0) v = -(a1 - a0) / (t1 - t0) * 1000;
      }
      const solto = st.offset + gsap.utils.clamp(-1600, 1600, v) * 0.25;
      const alvo = st.passo ? Math.round(solto / st.passo) * st.passo : solto;
      st.tween = gsap.to(st, {
        offset: alvo,
        duration: reduzido ? 0.01 : 0.8,
        ease: 'power3.out',
        onUpdate: aplicar,
        onComplete: () => { st.tween = null; anunciar(); }
      });
    }
    trilho.addEventListener('pointerup', (e) => soltar(e, false));
    trilho.addEventListener('pointercancel', (e) => soltar(e, true));
    trilho.addEventListener('lostpointercapture', (e) => soltar(e, true));
    trilho.addEventListener('click', (e) => {
      if (performance.now() < st.bloquearCliqueAte) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    trilho.addEventListener('dragstart', (e) => e.preventDefault());

    if (!reduzido && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      raiz.classList.add('is-interativo');
      let imagemAtual = null;

      const soltarImagem = () => {
        if (!imagemAtual) return;
        const img = imagemAtual;
        imagemAtual = null;
        img.style.transition = 'none';
        gsap.to(img, {
          x: 0, y: 0, scale: 1.001,
          duration: .7,
          ease: 'power3.out',
          overwrite: 'auto',
          onComplete: () => gsap.set(img, { clearProps: 'transform,transition' })
        });
      };

      trilho.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        if ((st.arrasto && st.arrasto.ativo) || quieto()) { soltarImagem(); return; }
        const projeto = e.target.closest('.projeto');
        const img = projeto && projeto.querySelector('.projeto__imagem');
        if (!img) { soltarImagem(); return; }
        if (img !== imagemAtual) soltarImagem();
        imagemAtual = img;
        const r = projeto.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(img, {
          x: -nx * 26,
          y: -ny * 14,
          scale: 1.07,
          duration: .7,
          ease: 'power3.out',
          overwrite: 'auto'
        });
      });
      trilho.addEventListener('pointerleave', soltarImagem);
    }

    trilho.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const link = e.target.closest('.projeto')?.querySelector('.projeto__link');
      if (link) link.click();
    });

    new IntersectionObserver(([en]) => { st.visivel = en.isIntersecting; }, { threshold: 0 }).observe(raiz);

    let larguraAnterior = janela.clientWidth;
    new ResizeObserver(() => {
      if (janela.clientWidth === larguraAnterior) return;
      larguraAnterior = janela.clientWidth;
      montarCopias();
    }).observe(janela);

    montarCopias();
    entrada();
    raiz.classList.add('is-pronto');
  }

  document.querySelectorAll('[data-carrossel]').forEach(iniciar);
})();

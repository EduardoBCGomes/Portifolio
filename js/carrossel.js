(function () {
  'use strict';

  // Carrossel infinito de projetos com GSAP. A faixa anda devagar sozinha,
  // dá para arrastar e usar as setas do teclado. Para quando o mouse ou o
  // foco do teclado está nela.

  const VELOCIDADE = 26; // px/s, devagar o bastante para ler
  const LIMIAR_ARRASTO = 6;

  function iniciar(raiz) {
    const janela = raiz.querySelector('.carrossel__janela');
    const trilho = raiz.querySelector('.carrossel__trilho');
    const anuncio = raiz.querySelector('[data-carrossel-anuncio]');
    const botaoPausa = raiz.querySelector('[data-pausa]');
    if (!janela || !trilho || typeof gsap === 'undefined') return;
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    const originais = [...trilho.children];
    const n = originais.length;
    if (!n) return;

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzido) raiz.classList.add('sem-movimento');
    // Na tela de toque não há hover para pausar, e o toque já abre o projeto.
    // Ali a faixa não anda sozinha: fica alinhada no cartão, com o próximo
    // aparecendo na borda, e só se move com o arrasto (WCAG 2.2.2).
    const toque = window.matchMedia('(hover: none)');

    const st = {
      offset: 0,
      periodo: 0,
      passo: 0,
      hover: false,
      foco: false,
      pausadoPeloUsuario: false,
      visivel: true,
      arrasto: null,
      tween: null,
      bloquearCliqueAte: 0
    };

    // Cópias suficientes para a faixa nunca acabar na tela. Ficam fora da
    // leitura de tela e do Tab (quem navega assim vê só os originais), mas
    // continuam clicáveis e com o hover: para quem usa o mouse, toda cópia
    // é um cartão de verdade.
    function montarCopias() {
      [...trilho.children].slice(n).forEach((c) => c.remove());
      st.periodo = 0;
      const larguraJanela = janela.clientWidth;
      let copias = 0;
      do {
        originais.forEach((item) => {
          const c = item.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          c.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
          // a cópia nasce visível mesmo se o original estiver no meio da entrada
          c.querySelectorAll('.projeto').forEach((p) => {
            p.style.removeProperty('opacity');
            p.style.removeProperty('clip-path');
            p.style.removeProperty('transform');
            p.style.removeProperty('translate');
          });
          trilho.appendChild(c);
        });
        copias++;
        st.periodo = trilho.children[n].offsetLeft - originais[0].offsetLeft;
      } while (st.periodo > 0 && st.periodo * copias < larguraJanela * 1.5 && copias < 8);
      st.passo = st.periodo / n;
      aplicar();
    }

    function aplicar() {
      if (st.periodo <= 0) return;
      const p = st.periodo;
      const x = ((st.offset % p) + p) % p;
      gsap.set(trilho, { x: -x });
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
      reduzido || st.hover || st.foco || st.pausadoPeloUsuario || !st.visivel || st.arrasto || st.tween;

    // Rolagem da página empurra a faixa (ScrollTrigger): rolar para baixo
    // acelera para a esquerda, rolar para cima inverte. O impulso decai
    // sozinho, então a faixa volta à velocidade de cruzeiro quando a página para.
    let impulso = 0;
    if (window.ScrollTrigger && !reduzido) {
      ScrollTrigger.create({
        trigger: raiz,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          // no toque o empurrão deixaria a faixa parada entre dois cartões
          if (toque.matches) return;
          impulso = gsap.utils.clamp(-2400, 2400, self.getVelocity()) * 0.35;
        }
      });
    }

    // Movimento contínuo no ticker do GSAP (mesmo relógio das outras animações).
    function tique(_tempo, deltaMs) {
      const dt = Math.min(deltaMs, 64) / 1000;
      impulso *= Math.exp(-dt * 3);
      if (parado()) return;
      st.offset += ((toque.matches ? 0 : VELOCIDADE) + impulso) * dt;
      aplicar();
    }
    gsap.ticker.add(tique);

    // Entrada com ScrollTrigger: os cartões sobem e se abrem de baixo para
    // cima, um depois do outro, quando a seção chega na tela.
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

    // Setas: vão para o projeto vizinho, alinhado pela borda do cartão.
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

    raiz.querySelector('[data-anterior]')?.addEventListener('click', () => irPara(-1));
    raiz.querySelector('[data-proximo]')?.addEventListener('click', () => irPara(1));

    botaoPausa?.addEventListener('click', () => {
      st.pausadoPeloUsuario = !st.pausadoPeloUsuario;
      botaoPausa.setAttribute('aria-pressed', String(st.pausadoPeloUsuario));
      botaoPausa.setAttribute('aria-label', st.pausadoPeloUsuario ? 'Retomar o movimento' : 'Pausar o movimento');
    });

    raiz.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') st.hover = true; });
    raiz.addEventListener('pointerleave', () => { st.hover = false; });
    // Foco do teclado num cartão: a faixa leva esse cartão até o início da
    // vista, para ninguém tabular para um projeto escondido na borda.
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

    // Arrastar (mouse e toque). Só vira arrasto se o gesto for horizontal;
    // no toque vertical a página rola normalmente.
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
        try { trilho.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
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
      try { trilho.releasePointerCapture(e.pointerId); } catch (err) { /* já solto */ }
      st.bloquearCliqueAte = performance.now() + 350;

      // arremesso: continua na direção do gesto e encaixa no cartão
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

    // Clique em qualquer ponto do cartão (original ou cópia) abre o projeto.
    trilho.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const link = e.target.closest('.projeto')?.querySelector('.projeto__link');
      if (link) link.click();
    });

    new IntersectionObserver(([en]) => { st.visivel = en.isIntersecting; }, { threshold: 0 }).observe(raiz);

    // começa com a largura atual: o observador dispara uma vez ao iniciar e
    // não deve refazer as cópias que acabaram de ser montadas
    let larguraAnterior = janela.clientWidth;
    new ResizeObserver(() => {
      if (janela.clientWidth === larguraAnterior) return;
      larguraAnterior = janela.clientWidth;
      montarCopias();
    }).observe(janela);

    montarCopias();
    entrada(); // depois das cópias, para elas entrarem junto
    raiz.classList.add('is-pronto');
  }

  document.querySelectorAll('[data-carrossel]').forEach(iniciar);
})();

(function () {
  'use strict';

  // Entrada do site: "zoom através do logo". A cortina preta do HTML segura a
  // tela até aqui; este script monta o EB em SVG por cima dela e a remove.
  //  1. encenação e máscara: o EB sobe de trás de uma linha invisível;
  //  2. comprimir e esticar: cada letra estica ao subir e assenta no lugar;
  //  3. ação secundária: a linha embaixo mostra o carregamento real;
  //  4. antecipação: pronto o carregamento, o EB recua como quem pega impulso;
  //  5. exagero e transformação: as letras viram janelas e a câmera mergulha
  //     pela haste do B (perto do centro do logo) até a página ocupar a tela;
  //  6. continuação e sobreposição: o topo chega ampliado e desfocado e
  //     assenta, com a entrada do título começando ainda durante o zoom.

  const cortina = document.getElementById('eb-preloader');
  const raiz = document.documentElement;

  let liberar;
  const done = new Promise((r) => { liberar = r; });
  window.portfolioPreloader = { done };

  function soltarSemAnimacao() {
    cortina?.remove();
    raiz.classList.remove('is-loading');
    liberar();
  }

  // sem cortina ou sem GSAP (CDN fora do ar), a página entra direto
  if (!cortina || typeof gsap === 'undefined') {
    soltarSemAnimacao();
    return;
  }

  raiz.classList.add('is-loading');

  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const CREME = '#faf9f6';
  const FUNDO = '#0c0a09';
  const MIN_VISIVEL = 900; // ms: o EB precisa entrar e ser lido
  const MAX_ESPERA = 5000;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const fs = Math.round(Math.min(150, Math.max(72, W * 0.14)));
  const base = Math.round(H / 2 + fs * 0.36); // linha de base: caixa alta centrada

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'revelar');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = `
    <defs>
      <mask id="revelar-mascara" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
        <rect width="${W}" height="${H}" fill="#fff"/>
        <g class="revelar__furo" opacity="0">
          <text class="revelar__e" y="${base}" fill="#000">E</text>
          <text class="revelar__b" y="${base}" fill="#000">B</text>
        </g>
      </mask>
      <clipPath id="revelar-corte">
        <rect width="${W}" height="${base + fs * 0.04}"/>
      </clipPath>
    </defs>
    <rect class="revelar__fundo" width="${W}" height="${H}" fill="${FUNDO}" mask="url(#revelar-mascara)"/>
    <g class="revelar__marca" clip-path="url(#revelar-corte)">
      <text class="revelar__e" y="${base}" fill="${CREME}">E</text>
      <text class="revelar__b" y="${base}" fill="none" stroke="${CREME}" stroke-width="2">B</text>
    </g>
    <line class="revelar__linha" x1="${W / 2 - fs * 0.7}" x2="${W / 2 + fs * 0.7}"
          y1="${base + fs * 0.22}" y2="${base + fs * 0.22}" stroke="${CREME}" stroke-width="1.5"/>
  `;
  svg.querySelectorAll('text').forEach((t) => {
    t.setAttribute('font-family', '"Archivo Black", "Archivo", sans-serif');
    t.setAttribute('font-size', fs);
  });
  document.body.appendChild(svg);

  // o SVG já cobre a tela: a cortina do HTML cumpriu o papel
  cortina.remove();

  const furo = svg.querySelector('.revelar__furo');
  const marca = svg.querySelector('.revelar__marca');
  const linha = svg.querySelector('.revelar__linha');
  const letrasVisiveis = [...marca.querySelectorAll('text')];

  // E e B lado a lado, centrados, iguais na máscara e na marca visível
  function posicionar() {
    const e = marca.querySelector('.revelar__e');
    const b = marca.querySelector('.revelar__b');
    const le = e.getComputedTextLength();
    const lb = b.getComputedTextLength();
    const x0 = W / 2 - (le + lb) / 2;
    svg.querySelectorAll('.revelar__e').forEach((t) => t.setAttribute('x', x0));
    svg.querySelectorAll('.revelar__b').forEach((t) => t.setAttribute('x', x0 + le));
    // Ponto de mergulho: o meio da haste do B. É um traço cheio (na máscara o
    // B é um furo inteiro) e fica a poucos pixels do centro do logo; a haste
    // do E, mais à esquerda, fazia o zoom puxar o EB para o lado.
    return { x: x0 + le + fs * 0.17, y: base - fs * 0.36 };
  }

  function espera(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ---- carregamento real, mostrado pela linha (ação secundária) ----
  // A entrada espera a primeira tela pronta: estrutura da página, foto do
  // topo e fontes (do EB e do texto), para nada trocar de fonte na frente
  // da pessoa. O "load" inteiro (imagens dos projetos) não segura nada.
  const etapas = [];
  const progresso = { p: 0 };
  let feitas = 0;
  gsap.set(linha, { scaleX: 0, svgOrigin: `${W / 2} 0` });
  const contar = (promessa) => {
    etapas.push(promessa);
    promessa.then(() => {
      feitas++;
      gsap.to(progresso, {
        p: feitas / etapas.length,
        duration: 0.5,
        ease: 'power2.out',
        onUpdate: () => gsap.set(linha, { scaleX: progresso.p })
      });
    });
  };

  const temFontes = Boolean(document.fonts && document.fonts.load);
  const fonteMarca = temFontes
    ? Promise.race([document.fonts.load('1em "Archivo Black"', 'EB').catch(() => {}), espera(1500)])
    : Promise.resolve();

  contar(new Promise((r) => {
    if (document.readyState !== 'loading') return r();
    document.addEventListener('DOMContentLoaded', r, { once: true });
  }));
  const foto = document.querySelector('.hero__photo');
  contar(new Promise((r) => {
    if (!foto || foto.complete) return r();
    foto.addEventListener('load', r, { once: true });
    foto.addEventListener('error', r, { once: true });
  }));
  contar(fonteMarca);
  contar(temFontes
    ? Promise.race([
        Promise.all([
          document.fonts.load('700 1em "Archivo"'),
          document.fonts.load('400 1em "Atkinson Hyperlegible Next"')
        ]).catch(() => {}),
        espera(2000)
      ])
    : Promise.resolve());

  const inicio = performance.now();
  const pronto = Promise.race([Promise.all(etapas), espera(MAX_ESPERA)]);

  if (reduzido) {
    pronto.then(() => {
      raiz.classList.remove('is-loading');
      liberar();
      gsap.to(svg, { opacity: 0, duration: 0.3, onComplete: () => svg.remove() });
    });
    return;
  }

  fonteMarca.then(() => {
    const mergulho = posicionar();

    // ---- 1 e 2: entrada por máscara, esticando e assentando ----
    gsap.set(letrasVisiveis, { y: fs * 1.05, scaleY: 1.35, transformOrigin: '50% 100%' });
    const entrada = gsap.timeline();
    entrada.to(letrasVisiveis, { y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.09 }, 0.1);
    entrada.to(letrasVisiveis, { scaleY: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)', stagger: 0.09 }, 0.22);

    pronto
      .then(() => espera(Math.max(0, MIN_VISIVEL - (performance.now() - inicio))))
      .then(() => sair(mergulho));
  });

  function sair(mergulho) {
    const hero = document.querySelector('.hero');
    const ambos = [marca, furo];
    gsap.set(ambos, { svgOrigin: `${mergulho.x} ${mergulho.y}` });

    const tl = gsap.timeline({
      onComplete: () => {
        svg.remove();
        if (camadas.length) gsap.set(camadas, { clearProps: 'transform,filter' });
      }
    });

    // a linha cumpriu o papel: recolhe para o centro
    tl.to(linha, { scaleX: 0, opacity: 0, duration: 0.35, ease: 'power3.in' }, 0);

    // 4: antecipação, o EB recua antes do salto
    tl.to(ambos, { scale: 0.86, duration: 0.45, ease: 'power2.inOut' }, 0.1);

    // 5: as letras viram janelas para a página
    tl.to(furo, { attr: { opacity: 1 }, duration: 0.01 }, 0.42);
    tl.to(letrasVisiveis, { opacity: 0, duration: 0.3, ease: 'power1.out' }, 0.42);
    tl.set(svg, { pointerEvents: 'none' }, 0.42);

    // 6: a página chega ampliada e desfocada e assenta, por baixo do zoom.
    // Amplia o fundo e o conteúdo DENTRO do topo, que recorta o que passa da
    // borda: ampliar o próprio .hero deixava a página mais larga que a tela,
    // e o celular afastava a página inteira e voltava ("explodia"). A origem
    // é o centro da tela, não o meio de um topo mais alto que ela.
    const camadas = hero ? [...hero.querySelectorAll(':scope > .hero__bg, :scope > .hero__inner')] : [];
    if (camadas.length) {
      const ampliado = W < 700 ? 1.08 : 1.18;
      tl.fromTo(camadas,
        {
          scale: ampliado,
          filter: 'blur(10px)',
          transformOrigin: (i, el) => `50% ${Math.round(H / 2 - el.getBoundingClientRect().top)}px`
        },
        { scale: 1, filter: 'blur(0px)', duration: 1.5, ease: 'expo.out' },
        0.5);
    }

    // 5: o mergulho pela haste do B, levando esse ponto até o centro exato
    // da tela enquanto cresce: o zoom fica centrado
    tl.to(ambos, {
      scale: 110,
      x: W / 2 - mergulho.x,
      y: H / 2 - mergulho.y,
      duration: 1.15,
      ease: 'expo.in'
    }, 0.55);

    // a entrada do título começa quando as letras viram janelas: o texto já
    // vai aparecendo por dentro do EB e termina junto com o mergulho
    tl.call(() => {
      raiz.classList.remove('is-loading');
      liberar();
    }, null, 0.42);
  }
})();

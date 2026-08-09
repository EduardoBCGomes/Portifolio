(function () {
  'use strict';

  const wrapper = document.querySelector('[data-staggered-menu]');
  const toggleBtn = document.querySelector('.sm-toggle');
  if (!wrapper || !toggleBtn || typeof gsap === 'undefined') return;

  const panel = wrapper.querySelector('.staggered-menu-panel');
  const preContainer = wrapper.querySelector('.sm-prelayers');
  const icon = toggleBtn.querySelector('.sm-icon');
  const plusH = toggleBtn.querySelector('.sm-icon-line:not(.sm-icon-line-v)');
  const plusV = toggleBtn.querySelector('.sm-icon-line-v');
  const textInner = toggleBtn.querySelector('.sm-toggle-textInner');
  if (!panel || !icon || !plusH || !plusV || !textInner) return;

  const LABEL_CLOSED = 'Menu';
  const LABEL_OPEN = 'Fechar';

  const position = wrapper.dataset.position === 'left' ? 'left' : 'right';
  const offscreen = position === 'left' ? -100 : 100;

  const preLayers = Array.from(preContainer ? preContainer.querySelectorAll('.sm-prelayer') : []);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const d = (value) => (reduce ? 0 : value);

  let open = false;
  let busy = false;
  let openTl = null;
  let closeTween = null;
  let spinTween = null;
  let textTween = null;

  function ajustarLarguraDoRotulo() {
    const regua = document.createElement('span');
    const estilo = getComputedStyle(textInner);
    Object.assign(regua.style, {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'nowrap',
      font: estilo.font,
      letterSpacing: estilo.letterSpacing
    });
    toggleBtn.appendChild(regua);

    let maior = 0;
    [LABEL_CLOSED, LABEL_OPEN].forEach((palavra) => {
      regua.textContent = palavra;
      maior = Math.max(maior, regua.getBoundingClientRect().width);
    });

    regua.remove();
    if (maior > 0) {
      toggleBtn.style.setProperty('--sm-toggle-width', `${Math.ceil(maior) + 2}px`);
    }
  }

  ajustarLarguraDoRotulo();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(ajustarLarguraDoRotulo);
  }

  gsap.set([panel, ...preLayers], { xPercent: offscreen });
  gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
  gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
  gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });
  gsap.set(textInner, { yPercent: 0 });

  function buildOpenTimeline() {
    openTl?.kill();
    if (closeTween) { closeTween.kill(); closeTween = null; }

    const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'));
    const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));
    const socialTitle = panel.querySelector('.sm-socials-title');
    const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link'));

    if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
    if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
    if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
    if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    preLayers.forEach((el, i) => {
      tl.fromTo(el, { xPercent: offscreen },
        { xPercent: 0, duration: d(0.5), ease: 'power4.out' }, i * d(0.07));
    });

    const lastTime = preLayers.length ? (preLayers.length - 1) * d(0.07) : 0;
    const panelInsertTime = lastTime + (preLayers.length ? d(0.08) : 0);
    const panelDuration = d(0.65);

    tl.fromTo(panel, { xPercent: offscreen },
      { xPercent: 0, duration: panelDuration, ease: 'power4.out' }, panelInsertTime);

    if (itemEls.length) {
      const itemsStart = panelInsertTime + panelDuration * 0.15;
      tl.to(itemEls, {
        yPercent: 0,
        rotate: 0,
        duration: d(1),
        ease: 'power4.out',
        stagger: { each: d(0.1), from: 'start' }
      }, itemsStart);

      if (numberEls.length) {
        tl.to(numberEls, {
          '--sm-num-opacity': 1,
          duration: d(0.6),
          ease: 'power2.out',
          stagger: { each: d(0.08), from: 'start' }
        }, itemsStart + d(0.1));
      }
    }

    if (socialTitle || socialLinks.length) {
      const socialsStart = panelInsertTime + panelDuration * 0.4;
      if (socialTitle) {
        tl.to(socialTitle, { opacity: 1, duration: d(0.5), ease: 'power2.out' }, socialsStart);
      }
      if (socialLinks.length) {
        tl.to(socialLinks, {
          y: 0,
          opacity: 1,
          duration: d(0.55),
          ease: 'power3.out',
          stagger: { each: d(0.08), from: 'start' },
          onComplete: () => gsap.set(socialLinks, { clearProps: 'opacity' })
        }, socialsStart + d(0.04));
      }
    }

    openTl = tl;
    return tl;
  }

  function playOpen() {
    if (busy) return;
    busy = true;
    const tl = buildOpenTimeline();
    if (!tl) { busy = false; return; }
    tl.eventCallback('onComplete', () => { busy = false; });
    tl.play(0);
  }

  function playClose() {
    openTl?.kill();
    openTl = null;
    closeTween?.kill();

    closeTween = gsap.to([...preLayers, panel], {
      xPercent: offscreen,
      duration: d(0.32),
      ease: 'power3.in',
      overwrite: 'auto',
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'));
        const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));
        const socialTitle = panel.querySelector('.sm-socials-title');
        const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link'));

        if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
        if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
        if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
        if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

        wrapper.removeAttribute('data-open');
        busy = false;
      }
    });
  }

  function animateIcon(opening) {
    spinTween?.kill();
    spinTween = opening
      ? gsap.to(icon, { rotate: 225, duration: d(0.8), ease: 'power4.out', overwrite: 'auto' })
      : gsap.to(icon, { rotate: 0, duration: d(0.35), ease: 'power3.inOut', overwrite: 'auto' });
  }

  function animateText(opening) {
    textTween?.kill();

    const currentLabel = opening ? LABEL_CLOSED : LABEL_OPEN;
    const targetLabel = opening ? LABEL_OPEN : LABEL_CLOSED;

    const seq = [currentLabel];
    let last = currentLabel;
    for (let i = 0; i < 3; i++) {
      last = last === LABEL_CLOSED ? LABEL_OPEN : LABEL_CLOSED;
      seq.push(last);
    }
    if (last !== targetLabel) seq.push(targetLabel);
    seq.push(targetLabel);

    textInner.innerHTML = seq
      .map((l) => `<span class="sm-toggle-line">${l}</span>`)
      .join('');

    gsap.set(textInner, { yPercent: 0 });
    const finalShift = ((seq.length - 1) / seq.length) * 100;
    textTween = gsap.to(textInner, {
      yPercent: -finalShift,
      duration: d(0.5 + seq.length * 0.07),
      ease: 'power4.out'
    });
  }

  const FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';
  let lastFocused = null;

  function onKeydown(e) {
    if (e.key === 'Escape') {
      closeMenu();
      toggleBtn.focus();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusables = [toggleBtn, ...panel.querySelectorAll(FOCUSABLE)];
    const first = focusables[0];
    const lastEl = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      first.focus();
    }
  }

  function onPointerDownAway(e) {
    if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) closeMenu();
  }

  function openMenu() {
    if (open) return;
    open = true;
    lastFocused = document.activeElement;

    wrapper.setAttribute('data-open', '');
    panel.setAttribute('aria-hidden', 'false');
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.setAttribute('aria-label', 'Fechar menu');
    document.body.classList.add('is-locked');
    document.getElementById('nav')?.classList.add('nav--menu-open');

    playOpen();
    animateIcon(true);
    animateText(true);

    document.addEventListener('keydown', onKeydown);
    document.addEventListener('pointerdown', onPointerDownAway);

    panel.querySelector(FOCUSABLE)?.focus({ preventScroll: true });
  }

  function closeMenu() {
    if (!open) return;
    open = false;

    panel.setAttribute('aria-hidden', 'true');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-label', 'Abrir menu');
    document.body.classList.remove('is-locked');
    document.getElementById('nav')?.classList.remove('nav--menu-open');

    playClose();
    animateIcon(false);
    animateText(false);

    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('pointerdown', onPointerDownAway);

    if (lastFocused && document.contains(lastFocused)) {
      lastFocused.focus({ preventScroll: true });
    }
  }

  toggleBtn.addEventListener('click', () => (open ? closeMenu() : openMenu()));

  panel.querySelectorAll('.sm-panel-item').forEach((link) => {
    link.addEventListener('click', () => closeMenu());
  });

  window.portfolioStaggeredMenu = { open: openMenu, close: closeMenu, isOpen: () => open };
})();

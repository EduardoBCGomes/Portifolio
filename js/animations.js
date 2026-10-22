(function () {
  'use strict';

  if (typeof gsap === 'undefined') {
    document.documentElement.classList.remove('anim-ready');
    return;
  }

  window.__animsStarted = true;
  gsap.registerPlugin(ScrollTrigger);

  const hasSplit = typeof SplitText !== 'undefined';
  if (hasSplit) gsap.registerPlugin(SplitText);

  const EASE = 'power3.out';

  function init() {
  const mm = gsap.matchMedia();

  mm.add({
    isDesktop: '(min-width: 900px)',
    isMobile: '(max-width: 899px)',
    motionOk: '(prefers-reduced-motion: no-preference)'
  }, (context) => {
    const { isDesktop, motionOk } = context.conditions;
    if (!motionOk) return;

    const cleanups = [];

    const tituloY = 100;
    const onAnchorClick = (e) => {
      const target = document.querySelector(e.currentTarget.getAttribute('href'));
      if (!target) return;
      e.preventDefault();

      const respiro = parseFloat(getComputedStyle(target).paddingTop) || 0;
      const top = target.getBoundingClientRect().top + window.scrollY + respiro - tituloY;
      window.scrollTo({ top, behavior: 'smooth' });
    };

    const anchors = gsap.utils
      .toArray('a[href^="#"]:not(.skip-link)')
      .filter((a) => a.getAttribute('href').length > 1);
    anchors.forEach((a) => a.addEventListener('click', onAnchorClick));

    const heroTitles = gsap.utils.toArray('[data-hero-title]');
    let splits = [];

    const intro = gsap.timeline({
      defaults: { ease: EASE },
      delay: .05,
      onComplete: () => ScrollTrigger.refresh()
    });

    intro.to('.hero__photo-frame', {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.15,
      ease: 'power4.inOut'
    }, 0);

    intro.from('.hero__photo', { scale: 1.25, duration: 1.4, ease: 'power3.out' }, 0);

    if (hasSplit && heroTitles.length) {
      intro.set('.hero__title', { opacity: 1 }, 0);

      heroTitles.forEach((line, i) => {
        const split = new SplitText(line, { type: 'chars', aria: 'none' });
        splits.push(split);
        intro.from(split.chars, {
          yPercent: 115,
          duration: .9,
          stagger: .035
        }, i === 0 ? .1 : .22);
      });
    } else {
      intro.to('.hero__title', { opacity: 1, y: 0, duration: .9 }, .1);
    }

    intro.to('[data-hero="lead"]',    { opacity: 1, y: 0, duration: .8 }, .3)
         .to('[data-hero="actions"]', { opacity: 1, y: 0, duration: .8 }, .4)
         .to('[data-hero="media"]',   { opacity: 1, duration: .8 }, .1)
         .to('[data-hero="hint"]',    { opacity: 1, y: 0, duration: .6 }, .75);

    gsap.to('.hero__media', {
      yPercent: -7,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });

    gsap.to('.hero__text', {
      yPercent: -8,
      opacity: .25,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });

    gsap.to('[data-hero="hint"]', {
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: '+=280',
        scrub: true
      }
    });

    const nav = document.getElementById('nav');

    let navEscondida = false;
    let navGrudada = false;

    ScrollTrigger.create({
      start: 'top -60',
      end: 99999,
      onUpdate: (self) => {
        const y = self.scroll();

        const grudar = y > 60;
        if (grudar !== navGrudada) {
          navGrudada = grudar;
          nav.classList.toggle('is-stuck', grudar);
        }

        const esconder = isDesktop && self.direction === 1 && y > 400;
        if (esconder !== navEscondida) {
          navEscondida = esconder;
          gsap.to(nav, {
            yPercent: esconder ? -140 : 0,
            duration: .45,
            ease: 'power2.out',
            overwrite: 'auto'
          });
        }
      }
    });

    gsap.to('.scroll-progress__bar', {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: .3 }
    });

    gsap.utils.toArray('[data-reveal]').forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: .9,
        ease: EASE,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });

    gsap.utils.toArray('[data-stagger]').forEach((group) => {
      gsap.to(group.children, {
        opacity: 1,
        y: 0,
        duration: .6,
        ease: EASE,
        stagger: .06,
        scrollTrigger: { trigger: group, start: 'top 88%', once: true }
      });
    });

    gsap.utils.toArray('[data-split-lines]').forEach((el) => {
      if (!hasSplit) {
        gsap.to(el, {
          opacity: 1, y: 0, duration: .9, ease: EASE,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true }
        });
        return;
      }

      gsap.set(el, { opacity: 1, y: 0 });
      const split = SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        aria: 'none',
        autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, {
          yPercent: 110,
          duration: .95,
          ease: EASE,
          stagger: .08,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true }
        })
      });
      splits.push(split);
    });

    gsap.fromTo('[data-about-photo]',
      { scale: 1.2 },
      {
        scale: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.sobre__photo-wrap',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      }
    );

    if (isDesktop) {
      gsap.utils.toArray('[data-magnetic]').forEach((el) => {
        const xTo = gsap.quickTo(el, 'x', { duration: .55, ease: 'elastic.out(1, .4)' });
        const yTo = gsap.quickTo(el, 'y', { duration: .55, ease: 'elastic.out(1, .4)' });

        const onMove = (e) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * .35);
          yTo((e.clientY - (r.top + r.height / 2)) * .45);
        };
        const onLeave = () => { xTo(0); yTo(0); };

        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);

        cleanups.push(() => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerleave', onLeave);
        });
      });
    }

    return () => {
      anchors.forEach((a) => a.removeEventListener('click', onAnchorClick));
      cleanups.forEach((fn) => fn());
      splits.forEach((s) => s.revert());
      splits = [];
      gsap.set(nav, { clearProps: 'transform' });
    };
  });
  }

  const cortinaFora = (window.portfolioPreloader && window.portfolioPreloader.done)
    ? window.portfolioPreloader.done
    : Promise.resolve();

  function fontesDoTexto() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('700 1em "Archivo"'),
      document.fonts.load('400 1em "Archivo"')
    ]).then(() => document.fonts.ready);
  }

  const comTeto = (promessa, ms) =>
    Promise.race([promessa.catch(() => {}), new Promise((r) => setTimeout(r, ms))]);

  cortinaFora
    .then(() => comTeto(fontesDoTexto(), 1500))
    .then(init, init);

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();

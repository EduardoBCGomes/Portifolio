(function () {
  'use strict';

  const raiz = document.documentElement;
  const R = window.portfolioRevelar;

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const CHAVE_PAUSA = 'portfolio:pausado';
  const botoesPausa = document.querySelectorAll('[data-pausar-animacoes]');

  function definirMovimento(pausado, salvar) {
    raiz.classList.toggle('sem-movimento', pausado);
    botoesPausa.forEach((botao) => {
      botao.textContent = pausado ? 'Retomar animações' : 'Pausar animações';
    });
    if (salvar) {
      try { localStorage.setItem(CHAVE_PAUSA, pausado ? '1' : '0'); } catch (e) { }
    }
    document.dispatchEvent(new CustomEvent('portfolio:movimento', { detail: { pausado } }));
  }

  let pausadoAntes = false;
  try { pausadoAntes = localStorage.getItem(CHAVE_PAUSA) === '1'; } catch (e) { }
  if (pausadoAntes) definirMovimento(true, false);

  botoesPausa.forEach((botao) => {
    botao.addEventListener('click', () => {
      definirMovimento(!raiz.classList.contains('sem-movimento'), true);
    });
  });

  function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto);
    }
    return new Promise((resolve, reject) => {
      const campo = document.createElement('textarea');
      campo.value = texto;
      campo.setAttribute('readonly', '');
      campo.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(campo);
      campo.select();
      const ok = document.execCommand('copy');
      campo.remove();
      ok ? resolve() : reject(new Error('copy'));
    });
  }

  document.querySelectorAll('[data-copiar]').forEach((botao) => {
    const rotulo = botao.querySelector('.contato__copy-label');
    const status = botao.parentElement.querySelector('[data-copiar-status]');
    const textoOriginal = rotulo ? rotulo.textContent : '';
    let timer = 0;

    botao.addEventListener('click', () => {
      copiarTexto(botao.dataset.copiar).then(() => {
        botao.classList.add('is-copied');
        if (rotulo) rotulo.textContent = 'Copiado!';
        if (status) status.textContent = 'E-mail copiado para a área de transferência.';
      }).catch(() => {
        if (rotulo) rotulo.textContent = 'Não deu para copiar';
      }).finally(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          botao.classList.remove('is-copied');
          if (rotulo) rotulo.textContent = textoOriginal;
          if (status) status.textContent = '';
        }, 2200);
      });
    });
  });

  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');

  if (form && status) {
    const EMAIL = 'eduardo26eduardo@gmail.com';
    const LIMITE_MAILTO = 1900;
    const botaoEnviar = form.querySelector('button[type="submit"]');
    const rotuloBotao = botaoEnviar ? botaoEnviar.querySelector('.btn__rotulo') || botaoEnviar : null;
    const rotuloEnviar = rotuloBotao ? rotuloBotao.textContent.trim() : '';
    const contador = form.querySelector('[data-contador]');
    const MINIMO = 10;
    let animandoEnvio = false;

    const rules = {
      nome: (v) => (v.trim().length >= 2 ? '' : 'Escreva seu nome, com pelo menos 2 letras.'),
      mensagem: (v) => (v.trim().length >= MINIMO ? '' : 'Conte um pouco mais, com pelo menos ' + MINIMO + ' caracteres.')
    };

    function validateField(input) {
      const rule = rules[input.name];
      if (!rule) return true;

      const message = rule(input.value);
      const field = input.closest('.field');
      const errorEl = form.querySelector(`[data-error-for="${input.name}"]`);

      field.classList.toggle('has-error', Boolean(message));
      field.classList.toggle('is-valido', !message && input.value.trim() !== '');
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (errorEl) errorEl.textContent = message;

      return !message;
    }

    form.querySelectorAll('input, textarea').forEach((input) => {
      input.addEventListener('input', () => {
        input.dataset.editado = '1';
        const field = input.closest('.field');
        if (field.classList.contains('has-error')) validateField(input);
        else field.classList.toggle('is-valido', !rules[input.name](input.value));
        if (input.name === 'mensagem') atualizarContador();
      });
      input.addEventListener('blur', () => {
        if (input.dataset.editado || form.dataset.tentou) validateField(input);
      });
    });

    function atualizarContador() {
      if (!contador) return;
      const n = form.querySelector('#mensagem').value.trim().length;
      contador.textContent = n === 0
        ? 'mínimo de ' + MINIMO + ' caracteres'
        : n < MINIMO ? 'faltam ' + (MINIMO - n) : n + ' caracteres';
      contador.classList.toggle('is-ok', n >= MINIMO);
    }

    const espera = (ms) => new Promise((r) => setTimeout(r, ms));

    async function animarEnvio() {
      if (!botaoEnviar || !R || !R.ativo() || animandoEnvio) return;
      animandoEnvio = true;
      await R.sumir(botaoEnviar, { duracao: .32, ease: 'power2.in' });
      rotuloBotao.textContent = 'Abrindo seu e-mail…';
      await R.revelar(botaoEnviar, { duracao: .4, ease: 'power2.out' });
      await espera(2200);
      await R.sumir(botaoEnviar, { duracao: .32, ease: 'power2.in' });
      rotuloBotao.textContent = rotuloEnviar;
      await R.revelar(botaoEnviar, { duracao: .4, ease: 'power2.out' });
      animandoEnvio = false;
    }

    function mostrarStatus(html, tipo) {
      status.className = 'form-status';
      if (tipo) status.classList.add(tipo);
      status.innerHTML = html;
      if (R && tipo === 'is-info') R.revelarTexto(status, { duracao: .7 });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      form.dataset.tentou = '1';

      const inputs = [...form.querySelectorAll('input, textarea')];
      const allValid = inputs.map(validateField).every(Boolean);

      if (!allValid) {
        mostrarStatus('Confira os campos destacados.', 'is-error');
        inputs.find((i) => i.closest('.field').classList.contains('has-error'))?.focus();
        return;
      }

      const data = new FormData(form);
      const nome = String(data.get('nome')).trim();
      const mensagem = String(data.get('mensagem')).trim();
      const subject = encodeURIComponent(`Contato pelo portfólio: ${nome}`);
      const body = encodeURIComponent(`${mensagem}\n\n${nome}`);
      const url = `mailto:${EMAIL}?subject=${subject}&body=${body}`;
      const longa = url.length > LIMITE_MAILTO;

      if (!longa) {
        window.location.href = url;
        animarEnvio();
      }

      const copiar = '<button type="button" class="form-status__copy">copie a mensagem</button>';
      mostrarStatus(
        longa
          ? `Sua mensagem é longa demais para abrir direto no app de e-mail: ${copiar} e envie para ${EMAIL}.`
          : `Falta só tocar em Enviar no seu app de e-mail. Se ele não abriu, ${copiar} e envie para ${EMAIL}.`,
        'is-info'
      );

      status.querySelector('.form-status__copy').addEventListener('click', (ev) => {
        const botao = ev.currentTarget;
        copiarTexto(`${mensagem}\n\n${nome}`)
          .then(() => { botao.textContent = 'mensagem copiada'; })
          .catch(() => { botao.textContent = 'não deu para copiar'; });
      });
    });
  }
})();

(function () {
  'use strict';

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Nem todo mundo tem um app de e-mail configurado: o mailto abre o nada.
  // Copiar o endereço resolve esse caso com um clique.
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
    const rules = {
      nome: (v) => (v.trim().length >= 2 ? '' : 'Escreva pelo menos 2 caracteres.'),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Informe um e-mail válido.'),
      mensagem: (v) => (v.trim().length >= 10 ? '' : 'Escreva pelo menos 10 caracteres.')
    };

    function validateField(input) {
      const rule = rules[input.name];
      if (!rule) return true;

      const message = rule(input.value);
      const field = input.closest('.field');
      const errorEl = form.querySelector(`[data-error-for="${input.name}"]`);

      field.classList.toggle('has-error', Boolean(message));
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (errorEl) errorEl.textContent = message;

      return !message;
    }

    form.querySelectorAll('input, textarea').forEach((input) => {
      input.addEventListener('blur', () => validateField(input));
      input.addEventListener('input', () => {
        if (input.closest('.field').classList.contains('has-error')) validateField(input);
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      status.className = 'form-status';

      const inputs = [...form.querySelectorAll('input, textarea')];
      const allValid = inputs.map(validateField).every(Boolean);

      if (!allValid) {
        status.textContent = 'Confira os campos destacados.';
        status.classList.add('is-error');
        inputs.find((i) => i.closest('.field').classList.contains('has-error'))?.focus();
        return;
      }

      const data = new FormData(form);
      const subject = encodeURIComponent(`Contato do portfólio — ${data.get('nome')}`);
      const body = encodeURIComponent(
        `${data.get('mensagem')}\n\n—\n${data.get('nome')}\n${data.get('email')}`
      );

      window.location.href = `mailto:eduardo26eduardo@gmail.com?subject=${subject}&body=${body}`;

      status.textContent = 'Abrindo seu app de e-mail com a mensagem pronta…';
      status.classList.add('is-success');
      form.reset();
    });
  }
})();

// Vista Calendario: due schede, Settimana e Mese (le viste vere arrivano nelle prossime tappe)

import * as week from './week.js';
import * as month from './month.js';

export const title = 'Calendario';

// Scheda scelta: resta finché la pagina è aperta
let tab = 'settimana';

export function eyebrow() {
  return tab === 'settimana' ? week.eyebrow() : month.eyebrow();
}

export function render(container) {
  container.innerHTML = `
    <div class="segmented" role="group" aria-label="Vista del calendario">
      ${['settimana', 'mese'].map((name) => `
        <button class="segmented__tab" type="button" data-tab="${name}"
                aria-pressed="${tab === name}">${name === 'settimana' ? 'Settimana' : 'Mese'}</button>`).join('')}
    </div>
    <div id="calendar-body"></div>`;

  (tab === 'settimana' ? week : month).render(container.querySelector('#calendar-body'));

  container.onclick = (e) => {
    const button = e.target.closest('[data-tab]');
    if (!button || button.dataset.tab === tab) return;
    tab = button.dataset.tab;
    // ridisegno completo tramite main.js: si aggiorna anche la data in alto
    document.dispatchEvent(new CustomEvent('agenda:changed', { detail: {} }));
    container.querySelector(`[data-tab="${tab}"]`)?.focus();
  };
}

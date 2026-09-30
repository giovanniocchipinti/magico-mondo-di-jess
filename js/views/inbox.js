// Vista Da pianificare: gli elementi senza data.
// Fase 1: solo elenco. Filtri, modifica e "Pianifica" arrivano nella Fase 3.

import { items } from '../data/fake-data.js';
import { itemRow, restoreFocus } from '../ui.js';

export const title = 'Da pianificare';

export function eyebrow() {
  const count = items.filter((i) => !i.scheduled_date && !i.done).length;
  return count === 1 ? '1 elemento' : `${count} elementi`;
}

export function render(container) {
  const rank = { high: 0, medium: 1, low: 2 };
  const list = items
    .filter((i) => !i.scheduled_date)
    .sort((a, b) => (a.done - b.done) || ((rank[a.priority] ?? 3) - (rank[b.priority] ?? 3)));

  container.innerHTML = list.length
    ? `<ul class="group">${list.map((i) => itemRow(i)).join('')}</ul>`
    : `<div class="placeholder"><p>Niente da pianificare</p><p>Usa il pulsante + per aggiungere un'idea.</p></div>`;

  container.onchange = (e) => {
    if (e.target.dataset.action !== 'toggle') return;
    const item = items.find((i) => i.id === e.target.closest('[data-id]').dataset.id);
    item.done = e.target.checked;
    item.done_at = item.done ? new Date().toISOString() : null;
    render(container);
    restoreFocus(container, item.id, 'input[type="checkbox"]');
  };
}

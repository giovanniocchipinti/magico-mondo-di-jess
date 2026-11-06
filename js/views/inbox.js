// Vista Da pianificare: gli elementi senza data.
// Fase 1: solo elenco. Filtri, modifica e "Pianifica" arrivano nella Fase 3.

import { items, updateItem } from '../data/db.js';
import { itemRow, restoreFocus, showToast } from '../ui.js';

export const title = 'Da pianificare';

export function eyebrow() {
  const count = items.filter((i) => !i.scheduled_date && !i.parent_id && !i.done).length;
  return count === 1 ? '1 elemento' : `${count} elementi`;
}

export function render(container) {
  const rank = { high: 0, medium: 1, low: 2 };
  const list = items
    .filter((i) => !i.scheduled_date && !i.parent_id) // i sotto-elementi compaiono dentro il genitore (Fase 3)
    .sort((a, b) => (a.done - b.done) || ((rank[a.priority] ?? 3) - (rank[b.priority] ?? 3)));

  container.innerHTML = list.length
    ? `<ul class="group">${list.map((i) => itemRow(i)).join('')}</ul>`
    : `<div class="placeholder"><p>Niente da pianificare</p><p>Usa il pulsante + per aggiungere un'idea.</p></div>`;

  container.onchange = (e) => {
    if (e.target.dataset.action !== 'toggle') return;
    const item = items.find((i) => i.id === e.target.closest('[data-id]').dataset.id);
    const done = e.target.checked;
    updateItem(item, { done, done_at: done ? new Date().toISOString() : null }).catch(() => {
      render(container);
      showToast('Modifica non salvata. Controlla la connessione e riprova.');
    });
    render(container);
    restoreFocus(container, item.id, 'input[type="checkbox"]');
  };
}

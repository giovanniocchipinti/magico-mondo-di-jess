// Vista Da pianificare: gli elementi senza data, filtrabili per area e priorità.
// Da qui si assegnano a un giorno con "Pianifica".

import { items, areas, setDone } from '../data/db.js';
import { icon } from '../icons.js';
import { itemRow, restoreFocus, showToast, areaAttrs, escapeHtml, saveErrorMessage, childStats } from '../ui.js';
import { openEditor } from '../item-editor.js';

export const title = 'Da pianificare';

// Filtri attivi: restano finché la pagina è aperta (null = nessun filtro)
let filterArea = null;
let filterPriority = null;

const priorityFilters = [['high', 'Alta'], ['medium', 'Media'], ['low', 'Bassa'], ['none', 'Senza priorità']];

function unscheduled() {
  // i sotto-elementi compaiono dentro il loro genitore, non qui
  return items.filter((i) => !i.scheduled_date && !i.parent_id);
}

export function eyebrow() {
  const count = unscheduled().filter((i) => !i.done).length;
  return count === 1 ? '1 elemento' : `${count} elementi`;
}

function matchesFilters(item) {
  if (filterArea && item.area_id !== filterArea) return false;
  if (filterPriority === 'none') return !item.priority;
  if (filterPriority) return item.priority === filterPriority;
  return true;
}

export function render(container) {
  const rank = { high: 0, medium: 1, low: 2 };
  const all = unscheduled();
  const list = all
    .filter(matchesFilters)
    .sort((a, b) => (a.done - b.done) || ((rank[a.priority] ?? 3) - (rank[b.priority] ?? 3)));

  const stats = childStats();
  const rows = list.map((item) => itemRow(item, {
    stats,
    actions: item.done ? '' : `<button class="btn btn--sm" type="button" data-action="plan">${icon('calendar')}Pianifica</button>`,
  })).join('');

  let body;
  if (!all.length) {
    body = `<div class="placeholder"><p>Niente da pianificare</p><p>Usa il pulsante + per annotare un'idea o una cosa da fare.</p></div>`;
  } else if (!list.length) {
    body = `<div class="placeholder"><p>Nessun elemento con questi filtri</p><p>Tocca di nuovo un filtro attivo per toglierlo.</p></div>`;
  } else {
    body = `<ul class="group">${rows}</ul>`;
  }

  container.innerHTML = `
    <div class="filters">
      <div class="chip-group" role="group" aria-label="Filtra per area">
        ${areas.map((a) => `
          <button class="chip" type="button" data-filter-area="${a.id}" aria-pressed="${filterArea === a.id}" ${areaAttrs(a)}>
            <span class="dot"></span>${escapeHtml(a.name)}
          </button>`).join('')}
      </div>
      <div class="chip-group" role="group" aria-label="Filtra per priorità">
        ${priorityFilters.map(([value, label]) => `
          <button class="chip" type="button" data-filter-priority="${value}" aria-pressed="${filterPriority === value}">${label}</button>`).join('')}
      </div>
    </div>
    ${body}`;

  container.onclick = (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    // Filtri: toccare il filtro attivo lo toglie
    if (button.dataset.filterArea) {
      filterArea = filterArea === button.dataset.filterArea ? null : button.dataset.filterArea;
      render(container);
      container.querySelector(`[data-filter-area="${button.dataset.filterArea}"]`).focus();
      return;
    }
    if (button.dataset.filterPriority) {
      filterPriority = filterPriority === button.dataset.filterPriority ? null : button.dataset.filterPriority;
      render(container);
      container.querySelector(`[data-filter-priority="${button.dataset.filterPriority}"]`).focus();
      return;
    }

    const row = button.closest('[data-id]');
    if (!row) return;
    if (button.dataset.action === 'open') openEditor(row.dataset.id);
    // "Pianifica" apre il dettaglio con il cursore già sul giorno
    if (button.dataset.action === 'plan') openEditor(row.dataset.id, { focus: 'date' });
  };

  container.onchange = (e) => {
    if (e.target.dataset.action !== 'toggle') return;
    const item = items.find((i) => i.id === e.target.closest('[data-id]').dataset.id);
    setDone(item, e.target.checked).catch((error) => {
      render(container);
      showToast(saveErrorMessage(error));
    });
    render(container);
    restoreFocus(container, item.id, 'input[type="checkbox"]');
  };
}

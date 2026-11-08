// Vista Mese: griglia del mese (da lunedì) con un pallino per ogni area che ha impegni quel giorno.
// Toccando un giorno, sotto la griglia compare la lista di quel giorno.

import { items, areas, setDone } from '../data/db.js';
import { icon } from '../icons.js';
import { itemRow, areaAttrs, restoreFocus, showToast, saveErrorMessage, childStats } from '../ui.js';
import { todayISO, addDays, addMonths, startOfWeek, monthKey, formatDayLong, formatMonth } from '../dates.js';
import { openEditor } from '../item-editor.js';
import { openQuickAdd } from '../quick-add.js';

export const title = 'Mese';

let month = null;     // mese visualizzato, "YYYY-MM"
let selected = null;  // giorno scelto, "YYYY-MM-DD"

function ensureState() {
  if (!selected) {
    selected = todayISO();
    month = monthKey(selected);
  }
}

export function eyebrow() {
  ensureState();
  const label = formatMonth(month + '-01');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Dopo un ridisegno il contenitore del calendario è un elemento NUOVO: il focus va cercato lì
const currentBody = () => document.getElementById('calendar-body');

function refreshView() {
  document.dispatchEvent(new CustomEvent('agenda:changed', { detail: {} }));
}

const weekdays = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const weekdayNames = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

export function render(container) {
  ensureState();
  const today = todayISO();
  const first = month + '-01';
  const last = addDays(addMonths(first, 1), -1);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(startOfWeek(last), 6);

  // elementi principali per giorno (i sotto-elementi stanno dentro il loro genitore)
  const byDate = new Map();
  for (const item of items) {
    if (!item.scheduled_date || item.parent_id) continue;
    if (!byDate.has(item.scheduled_date)) byDate.set(item.scheduled_date, []);
    byDate.get(item.scheduled_date).push(item);
  }

  const cells = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    const list = byDate.get(d) ?? [];
    // un pallino per area, nell'ordine delle aree
    const dots = areas.filter((a) => list.some((i) => i.area_id === a.id));
    const open = list.filter((i) => !(i.type === 'task' && i.done)).length;
    const label = `${formatDayLong(d)}${list.length ? `, ${list.length} ${list.length === 1 ? 'impegno' : 'impegni'}` : ''}`;
    cells.push(`
      <button class="month__day ${monthKey(d) !== month ? 'is-outside' : ''} ${d === today ? 'is-today' : ''} ${list.length && !open ? 'is-clear' : ''}"
              type="button" data-date="${d}" aria-pressed="${d === selected}" aria-label="${label}">
        <span class="month__num num">${Number(d.slice(8))}</span>
        <span class="month__dots" aria-hidden="true">${dots.map((a) => `<span class="dot" ${areaAttrs(a)}></span>`).join('')}</span>
      </button>`);
  }

  const dayList = (byDate.get(selected) ?? [])
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
  const stats = childStats();

  container.innerHTML = `
    <div class="month-nav">
      <button class="icon-btn" type="button" data-action="prev-month" aria-label="Mese precedente">${icon('chevronLeft')}</button>
      <button class="btn btn--sm" type="button" data-action="today">Oggi</button>
      <button class="icon-btn" type="button" data-action="next-month" aria-label="Mese successivo">${icon('chevronRight')}</button>
    </div>

    <div class="month" role="group" aria-label="Giorni del mese">
      ${weekdays.map((w, i) => `<span class="month__weekday" aria-hidden="true" title="${weekdayNames[i]}">${w}</span>`).join('')}
      ${cells.join('')}
    </div>

    <section class="section" aria-labelledby="h-month-day">
      <div class="section__head">
        <h2 id="h-month-day" class="month__day-title">${formatDayLong(selected)}</h2>
        <button class="btn btn--sm btn--ghost section__range" type="button" data-action="add-day">${icon('plus')}Aggiungi</button>
      </div>
      ${dayList.length
        ? `<ul class="group">${dayList.map((i) => itemRow(i, { showTime: Boolean(i.start_time), stats })).join('')}</ul>`
        : '<p class="empty">Niente in programma.</p>'}
    </section>`;

  container.onclick = (e) => {
    const day = e.target.closest('[data-date]');
    if (day) {
      selected = day.dataset.date;
      if (monthKey(selected) !== month) month = monthKey(selected); // giorno del mese vicino: ci si sposta
      refreshView();
      currentBody().querySelector(`[data-date="${selected}"]`)?.focus();
      return;
    }
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'prev-month' || action === 'next-month') {
      month = monthKey(addMonths(month + '-01', action === 'prev-month' ? -1 : 1));
      selected = month === monthKey(todayISO()) ? todayISO() : month + '-01';
      refreshView();
      currentBody().querySelector(`[data-action="${action}"]`)?.focus();
    }
    if (action === 'today') {
      selected = todayISO();
      month = monthKey(selected);
      refreshView();
    }
    if (action === 'add-day') openQuickAdd({ date: selected, time: null });
    if (action === 'open') openEditor(button.closest('[data-id]').dataset.id);
  };

  container.onchange = (e) => {
    if (e.target.dataset.action !== 'toggle') return;
    const item = items.find((i) => i.id === e.target.closest('[data-id]').dataset.id);
    setDone(item, e.target.checked).catch((error) => {
      refreshView();
      showToast(saveErrorMessage(error));
    });
    refreshView();
    restoreFocus(currentBody(), item.id, 'input[type="checkbox"]');
  };
}

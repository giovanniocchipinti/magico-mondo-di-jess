// Vista Settimana: griglia a ore con i giorni affiancati.
// Telefono: 3 giorni alla volta. Tablet e computer: tutta la settimana, da lunedì.
// Blocchi trascinabili (vedi week-drag.js); tocco su uno spazio vuoto = nuovo impegno a quell'ora.

import { items, workHours, updateItem } from '../data/db.js';
import { icon } from '../icons.js';
import { areaById, areaAttrs, escapeHtml, showToast, saveErrorMessage, priorityRank } from '../ui.js';
import { todayISO, addDays, startOfWeek, isoWeekday, formatDayShort, formatDayLong, timeToMin, minToTime, nowMinutes } from '../dates.js';
import { openEditor } from '../item-editor.js';
import { openQuickAdd } from '../quick-add.js';
import { enableDrag, consumeDragClick } from '../week-drag.js';

export const title = 'Settimana';

// La griglia va dalle 7:00 alle 23:00, ma si allarga se nei giorni visibili
// c'è qualcosa prima o dopo (così nessun impegno resta schiacciato ai bordi)
let START = 7 * 60;
let END = 23 * 60;
const HOUR_H = 52;      // altezza di un'ora, in pixel

let anchor = null;      // primo giorno visibile (YYYY-MM-DD)

const isWide = () => window.matchMedia('(min-width: 768px)').matches;

function visibleDays() {
  const today = todayISO();
  if (!anchor) anchor = today;
  // su schermi larghi la settimana parte sempre di lunedì
  const first = isWide() ? startOfWeek(anchor) : anchor;
  const count = isWide() ? 7 : 3;
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

export function eyebrow() {
  const days = visibleDays();
  return `${formatDayShort(days[0])} – ${formatDayShort(days[days.length - 1])}`;
}

// minuti dalla mezzanotte -> pixel dall'alto della griglia (fuori orario: schiacciato ai bordi)
const toY = (minutes) => ((clampMin(minutes) - START) / 60) * HOUR_H;
const clampMin = (minutes) => Math.min(Math.max(minutes, START), END);

const weekdayFormat = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'short' });

// Dopo un ridisegno il contenitore del calendario è un elemento NUOVO: il focus va cercato lì
const currentBody = () => document.getElementById('calendar-body');

function refreshView() {
  document.dispatchEvent(new CustomEvent('agenda:changed', { detail: {} }));
}

// ---------- Disposizione dei blocchi che si sovrappongono ----------
// Gli elementi che si accavallano formano un "gruppo"; dentro il gruppo ognuno prende
// la prima corsia libera, e tutti si dividono la larghezza della colonna.
function layout(list) {
  const sorted = [...list].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const result = [];
  let group = [];
  let groupEnd = -1;

  const closeGroup = () => {
    const lanes = Math.max(...group.map((g) => g.lane)) + 1;
    group.forEach((g) => result.push({ ...g, lanes }));
    group = [];
    groupEnd = -1;
  };

  for (const item of sorted) {
    const start = timeToMin(item.start_time);
    const end = start + (item.duration_min ?? 30);
    if (group.length && start >= groupEnd) closeGroup();
    const busy = group.filter((g) => g.end > start).map((g) => g.lane);
    let lane = 0;
    while (busy.includes(lane)) lane++;
    group.push({ item, lane, end });
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length) closeGroup();
  return result;
}

function block({ item, lane, lanes }) {
  const area = areaById(item.area_id);
  const start = timeToMin(item.start_time);
  const duration = item.duration_min ?? 30;
  const top = toY(start);
  const height = Math.max(toY(start + duration) - top, 22);
  const classes = ['block', item.done ? 'is-done' : '', item.type === 'appointment' ? 'block--appt' : ''].join(' ');
  return `
    <div class="${classes}" data-id="${item.id}" data-start="${start}" data-duration="${duration}"
         ${areaAttrs(area, `top:${top}px;height:${height}px;left:calc(${lane} * 100% / ${lanes});width:calc(100% / ${lanes})`)}>
      <button class="block__open" type="button" data-action="open">
        <span class="block__time num">${item.start_time}</span>
        <span class="block__title">${escapeHtml(item.title)}</span>
      </button>
      <span class="block__resize" aria-hidden="true"></span>
    </div>`;
}

function column(date, today, now) {
  const hours = workHours[isoWeekday(date)];
  const work = hours
    ? `<div class="week__work" style="top:${toY(timeToMin(hours.start))}px;height:${toY(timeToMin(hours.end)) - toY(timeToMin(hours.start))}px"></div>`
    : '';
  const nowLine = date === today && now >= START && now < END
    ? `<div class="week__now" style="top:${toY(now)}px"></div>`
    : '';
  const timed = items.filter((i) => i.scheduled_date === date && i.start_time);
  return `
    <div class="week__col ${date === today ? 'is-today' : ''}" data-date="${date}">
      ${work}${nowLine}${layout(timed).map(block).join('')}
    </div>`;
}

// Cose "in giornata" (senza orario), in una fascia sopra le ore
function allDayCell(date) {
  const list = items.filter((i) => i.scheduled_date === date && !i.start_time && !i.parent_id);
  return `
    <div class="week__allday-cell" data-date="${date}">
      ${list.map((item) => `
        <button class="allday-chip ${item.done ? 'is-done' : ''}" type="button" data-action="open" data-id="${item.id}" ${areaAttrs(areaById(item.area_id))}>
          ${escapeHtml(item.title)}
        </button>`).join('')}
    </div>`;
}

// Lista "Da fare" accanto al calendario (solo schermi molto larghi): si trascina sulla griglia
function inboxPanel() {
  const list = items
    .filter((i) => i.type === 'task' && !i.done && !i.scheduled_date && !i.parent_id)
    .sort((a, b) => priorityRank(a) - priorityRank(b));
  return `
    <aside class="week-inbox" aria-labelledby="h-week-inbox">
      <h2 class="section__head" id="h-week-inbox">${icon('inbox')}Da fare</h2>
      <p class="form-hint">Trascina sul calendario per pianificare.</p>
      ${list.length ? `<ul class="week-inbox__list">${list.map((item) => `
        <li class="inbox-item" data-id="${item.id}" data-duration="${item.duration_min ?? 30}" ${areaAttrs(areaById(item.area_id))}>
          <span class="dot"></span>${escapeHtml(item.title)}
        </li>`).join('')}</ul>` : '<p class="empty">Niente da pianificare.</p>'}
    </aside>`;
}

function fitRange(days) {
  START = 7 * 60;
  END = 23 * 60;
  for (const item of items) {
    if (!item.start_time || !days.includes(item.scheduled_date)) continue;
    const start = timeToMin(item.start_time);
    START = Math.min(START, Math.floor(start / 60) * 60);
    END = Math.max(END, Math.min(24 * 60, Math.ceil((start + (item.duration_min ?? 30)) / 60) * 60));
  }
}

export function render(container) {
  const days = visibleDays();
  fitRange(days);
  const today = todayISO();
  const now = nowMinutes();
  const showInbox = isWide() && window.matchMedia('(min-width: 1200px)').matches;

  const hourLabels = [];
  for (let m = START; m < END; m += 60) hourLabels.push(`<span class="num" style="top:${toY(m)}px">${minToTime(m)}</span>`);

  container.innerHTML = `
    <div class="week-toolbar">
      <button class="icon-btn" type="button" data-action="prev" aria-label="Giorni precedenti">${icon('chevronLeft')}</button>
      <button class="btn btn--sm" type="button" data-action="today">Oggi</button>
      <button class="icon-btn" type="button" data-action="next" aria-label="Giorni successivi">${icon('chevronRight')}</button>
      <p class="week-toolbar__hint">${isWide() ? 'Trascina un impegno per spostarlo' : 'Tieni premuto un impegno per spostarlo'}</p>
    </div>

    <div class="week-layout">
      <div class="week" style="--days: ${days.length}; --hour-h: ${HOUR_H}px; --grid-h: ${toY(END)}px">
        <div class="week__head">
          <span></span>
          ${days.map((d) => `
            <div class="week__day ${d === today ? 'is-today' : ''}">
              <span>${weekdayFormat.format(new Date(d + 'T00:00:00Z'))}</span>
              <strong class="num">${Number(d.slice(8))}</strong>
            </div>`).join('')}
        </div>
        <div class="week__allday">
          <span class="week__label">In giornata</span>
          ${days.map(allDayCell).join('')}
        </div>
        <div class="week__grid">
          <div class="week__hours" aria-hidden="true">${hourLabels.join('')}</div>
          ${days.map((d) => column(d, today, now)).join('')}
        </div>
      </div>
      ${showInbox ? inboxPanel() : ''}
    </div>`;

  container.onclick = (e) => {
    // il click che segue un trascinamento non deve aprire niente
    if (consumeDragClick()) return;

    const button = e.target.closest('button[data-action]');
    if (button) {
      const action = button.dataset.action;
      const step = isWide() ? 7 : 3;
      if (action === 'prev' || action === 'next') {
        anchor = addDays(visibleDays()[0], action === 'prev' ? -step : step);
        refreshView();
        currentBody().querySelector(`[data-action="${action}"]`)?.focus();
      }
      if (action === 'today') {
        anchor = todayISO();
        refreshView();
      }
      if (action === 'open') openEditor(button.closest('[data-id]').dataset.id);
      return;
    }

    // tocco su uno spazio vuoto della griglia: nuovo impegno a quell'ora (arrotondata alla mezz'ora)
    const col = e.target.closest('.week__col');
    if (col && !e.target.closest('.block')) {
      const y = e.clientY - col.getBoundingClientRect().top;
      const minutes = Math.min(Math.floor((START + (y / HOUR_H) * 60) / 30) * 30, END - 60);
      openQuickAdd({ date: col.dataset.date, time: minToTime(minutes) });
      return;
    }
    // tocco sulla fascia "in giornata" vuota: nuova cosa da fare per quel giorno, senza orario
    const allDay = e.target.closest('.week__allday-cell');
    if (allDay) openQuickAdd({ date: allDay.dataset.date, time: null });
  };

  enableDrag({
    root: container,
    start: START,
    end: END,
    hourHeight: HOUR_H,
    onDrop: (result) => {
      if (!result) return refreshView(); // gesto annullato: si rimette tutto a posto
      const item = items.find((i) => i.id === result.id);
      const changes = result.mode === 'resize'
        ? { duration_min: result.duration }
        : { scheduled_date: result.date, start_time: minToTime(result.start), duration_min: item.duration_min ?? 30 };
      updateItem(item, changes).catch((error) => {
        refreshView();
        showToast(saveErrorMessage(error));
      });
      refreshView();
      if (result.mode === 'move') showToast(`${item.title}: ${formatDayLong(result.date)}, ${minToTime(result.start)}`);
    },
  });
}

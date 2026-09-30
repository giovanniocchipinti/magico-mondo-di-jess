// Vista Oggi: cosa c'è adesso, cosa viene dopo, e la giornata divisa in fasce

import { items, workHours } from '../data/fake-data.js';
import { icon } from '../icons.js';
import { itemRow, areaById, areaAttrs, escapeHtml, endTime, restoreFocus } from '../ui.js';
import { todayISO, isoWeekday, formatDayLong, nowMinutes, timeToMin, minToTime, formatIn } from '../dates.js';

export const title = 'Oggi';

export function eyebrow() {
  return formatDayLong(todayISO());
}

export function render(container) {
  const today = todayISO();
  const now = nowMinutes();

  const dayItems = items.filter((i) => i.scheduled_date === today);
  const allDay = dayItems.filter((i) => !i.start_time);
  const timed = dayItems
    .filter((i) => i.start_time)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const overdue = items
    .filter((i) => i.type === 'task' && !i.done && i.scheduled_date && i.scheduled_date < today)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  container.innerHTML = `
    ${nowCard(timed, allDay, now)}
    ${progress(dayItems)}
    ${overdue.length ? overdueSection(overdue) : ''}
    ${allDay.length ? allDaySection(allDay) : ''}
    ${daySlots(timed, workHours[isoWeekday(today)], now)}
  `;

  // Un solo gestore per tutta la vista ("event delegation"):
  // guardiamo su quale elemento è avvenuto l'evento tramite data-action
  container.onchange = (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const item = items.find((i) => i.id === row.dataset.id);

    if (e.target.dataset.action === 'toggle') {
      item.done = e.target.checked;
      item.done_at = item.done ? new Date().toISOString() : null;
      render(container);
      restoreFocus(container, item.id, 'input[type="checkbox"]');
    }

    if (e.target.dataset.action === 'move' && e.target.value) {
      item.scheduled_date = e.target.value;
      render(container);
      focusAfterMove(container, item.id);
    }
  };

  container.onclick = (e) => {
    const button = e.target.closest('[data-action]');
    if (!button || button.tagName !== 'BUTTON') return;
    const row = button.closest('[data-id]');
    const item = items.find((i) => i.id === row.dataset.id);

    if (button.dataset.action === 'to-today') {
      item.scheduled_date = todayISO();
      render(container);
      focusAfterMove(container, item.id);
    }

    // "Sposta": apre il calendario nativo del browser collegato all'input nascosto
    if (button.dataset.action === 'pick-date') {
      const dateInput = row.querySelector('[data-action="move"]');
      try {
        dateInput.showPicker();
      } catch {
        // browser vecchi: mostriamo direttamente l'input
        dateInput.classList.remove('date-input-hidden');
        dateInput.focus();
      }
    }
  };
}

// Dopo uno spostamento il pulsante premuto non esiste più: porta il focus
// sull'elemento spostato (se è ancora in pagina) o sulla prossima rimasta indietro
function focusAfterMove(container, id) {
  const target = container.querySelector(`[data-id="${id}"] input[type="checkbox"]`)
    ?? container.querySelector('[data-action="to-today"]')
    ?? container.querySelector('#h-allday, #h-work');
  if (target?.tagName === 'H2') target.tabIndex = -1;
  target?.focus();
}

// ---------- Adesso / Dopo ----------
function nowCard(timed, allDay, now) {
  const current = timed.find((i) => {
    const start = timeToMin(i.start_time);
    return start <= now && now < start + (i.duration_min ?? 0) && !i.done;
  });
  const next = timed.find((i) => timeToMin(i.start_time) > now && !i.done);
  const openAllDay = allDay.filter((i) => i.type === 'task' && !i.done).length;

  const nowCol = current
    ? cardEntry('Adesso', current, `${current.start_time}–${endTime(current)}`)
    : `<div class="now-card__col">
        <p class="eyebrow">Adesso</p>
        <p class="now-card__title">Nessun impegno in corso</p>
        <p class="now-card__sub">${openAllDay
          ? `${openAllDay} task in giornata da fare`
          : 'Tempo libero'}</p>
      </div>`;

  const nextCol = next
    ? cardEntry(`Dopo · ${formatIn(timeToMin(next.start_time) - now)}`, next, `alle ${next.start_time}`)
    : `<div class="now-card__col">
        <p class="eyebrow">Dopo</p>
        <p class="now-card__title">Niente altro in programma</p>
      </div>`;

  return `<section class="now-card" aria-label="Adesso e prossimo impegno">${nowCol}${nextCol}</section>`;
}

function cardEntry(label, item, time) {
  const area = areaById(item.area_id);
  const where = item.location ? ` · ${escapeHtml(item.location)}` : '';
  return `
    <div class="now-card__col" ${areaAttrs(area)}>
      <p class="eyebrow">${label}</p>
      <p class="now-card__title"><span class="dot"></span>${escapeHtml(item.title)}</p>
      <p class="now-card__sub"><span class="num">${time}</span>${where}</p>
    </div>`;
}

// ---------- Avanzamento: conta solo le task (gli appuntamenti non si spuntano) ----------
function progress(dayItems) {
  const tasks = dayItems.filter((i) => i.type === 'task');
  const done = tasks.filter((i) => i.done).length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return `
    <div class="progress">
      <div class="progress__label">
        <span><strong class="num">${done}</strong> di <span class="num">${tasks.length}</span> task completate</span>
        <span class="num">${percent}%</span>
      </div>
      <div class="progress__track" role="progressbar" aria-label="Avanzamento della giornata"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <div class="progress__fill" style="width: ${percent}%"></div>
      </div>
    </div>`;
}

// ---------- Rimaste indietro ----------
function overdueSection(overdue) {
  const rows = overdue.map((item) => itemRow(item, {
    showDate: true,
    lateDate: true,
    actions: `
      <button class="btn btn--sm" type="button" data-action="to-today">${icon('sun')}Oggi</button>
      <button class="btn btn--sm btn--ghost" type="button" data-action="pick-date">${icon('calendar')}Altro giorno</button>
      <input class="date-input-hidden" type="date" data-action="move" tabindex="-1" aria-label="Nuova data per ${escapeHtml(item.title)}">`,
  })).join('');

  return `
    <section class="section" aria-labelledby="h-overdue">
      <h2 class="section__head" id="h-overdue">${icon('history')}Rimaste indietro <span class="count count--warning num">${overdue.length}</span></h2>
      <ul class="group">${rows}</ul>
    </section>`;
}

// ---------- In giornata (senza orario): prima le non fatte, poi per priorità ----------
function allDaySection(allDay) {
  const rank = { high: 0, medium: 1, low: 2 };
  const sorted = [...allDay].sort((a, b) =>
    (a.done - b.done) || ((rank[a.priority] ?? 3) - (rank[b.priority] ?? 3)));

  return `
    <section class="section" aria-labelledby="h-allday">
      <h2 class="section__head" id="h-allday">${icon('listTodo')}In giornata</h2>
      <ul class="group">${sorted.map((i) => itemRow(i)).join('')}</ul>
    </section>`;
}

// ---------- Fasce orarie: prima del lavoro, lavoro, dopo lavoro ----------
function daySlots(timed, hours, now) {
  if (!hours) {
    return slot({ id: 'free', label: 'Giornata libera', iconName: 'sun', list: timed, from: 0, to: 1440, now });
  }

  const start = timeToMin(hours.start);
  const end = timeToMin(hours.end);
  const minOf = (i) => timeToMin(i.start_time);
  const before = timed.filter((i) => minOf(i) < start);

  return `
    ${before.length ? slot({ id: 'before', label: 'Prima del lavoro', iconName: 'sunrise', list: before, from: 0, to: start, now }) : ''}
    ${slot({ id: 'work', label: 'Lavoro', iconName: 'briefcase', list: timed.filter((i) => minOf(i) >= start && minOf(i) < end), from: start, to: end, now, work: true })}
    ${slot({ id: 'after', label: 'Dopo lavoro', iconName: 'sunset', list: timed.filter((i) => minOf(i) >= end), from: end, to: 1440, now })}
  `;
}

function slot({ id, label, iconName, list, from, to, now, work = false }) {
  let range = `${minToTime(from)}–${minToTime(to)}`;
  if (from === 0 && to === 1440) range = '';
  else if (from === 0) range = `fino alle ${minToTime(to)}`;
  else if (to === 1440) range = `dalle ${minToTime(from)}`;

  const rows = list.map((i) => itemRow(i, { showTime: true }));

  // Linea "ora attuale", solo nella fascia in cui ci troviamo adesso
  if (now >= from && now < to) {
    const index = list.findIndex((i) => timeToMin(i.start_time) > now);
    const line = `<li class="now-line" aria-label="Ora attuale ${minToTime(now)}"><span class="num" aria-hidden="true">${minToTime(now)}</span></li>`;
    rows.splice(index === -1 ? rows.length : index, 0, line);
  }

  const body = list.length
    ? `<ul class="group">${rows.join('')}</ul>`
    : `<div class="group"><p class="empty">Niente in programma</p></div>`;

  return `
    <section class="section ${work ? 'slot--work' : ''}" aria-labelledby="h-${id}">
      <h2 class="section__head" id="h-${id}">${icon(iconName)}${label}<span class="section__range num">${range}</span></h2>
      ${body}
    </section>`;
}

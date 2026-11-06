// Vista Oggi: frase del giorno, cosa c'è adesso e dopo, il punto della situazione,
// le priorità, e la giornata divisa in fasce con i buchi liberi e cosa farci

import { items, workHours, updateItem, setDone } from '../data/db.js';
import { openEditor } from '../item-editor.js';
import { icon } from '../icons.js';
import { itemRow, areaById, areaAttrs, escapeHtml, endTime, restoreFocus, showToast, saveErrorMessage, childStats, priorityRank } from '../ui.js';
import { todayISO, isoWeekday, formatDayLong, nowMinutes, timeToMin, minToTime, formatIn, formatDuration, addDays, startOfWeek } from '../dates.js';
import { freeGaps, suggestionsFor } from '../planning.js';
import { quoteOfDay } from '../data/quotes.js';

export const title = 'Oggi';

export function eyebrow() {
  return formatDayLong(todayISO());
}

// Contatori dei sotto-elementi, ricalcolati a ogni render (vedi childStats in ui.js)
let stats = new Map();

// ---------- Aggiornamento automatico ----------
// Ogni minuto (e quando si torna sull'app dal telefono) "Adesso", la linea dell'ora e i buchi liberi
// devono seguire l'orologio. Chiediamo a main.js di ridisegnare con lo stesso evento del pannello.
let refreshTimer = null;

function canAutoRefresh(container) {
  if (container.dataset.view !== 'oggi' || document.hidden) return false;
  // non disturbare chi sta facendo qualcosa: pannello aperto o calendario "Altro giorno" in uso
  if (document.querySelector('dialog[open]')) return false;
  return !document.activeElement?.matches('input[type="date"], input[type="text"], textarea, select');
}

// Ridisegna e rimette il focus sullo stesso controllo (stessa riga, stessa azione, stessa sezione):
// così l'aggiornamento non fa perdere il punto a chi usa la tastiera
function autoRefresh(container) {
  if (!canAutoRefresh(container)) return;
  const active = document.activeElement;
  const id = active?.closest('[data-id]')?.dataset.id;
  const action = active?.dataset.action;
  const section = active?.closest('section')?.getAttribute('aria-labelledby');

  document.dispatchEvent(new CustomEvent('agenda:changed', { detail: {} }));

  if (id && action) {
    const root = container.querySelector(`section[aria-labelledby="${section}"]`) ?? container;
    root.querySelector(`[data-id="${id}"] [data-action="${action}"]`)?.focus({ preventScroll: true });
  }
}

function scheduleRefresh(container) {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (container.dataset.view !== 'oggi') return clearInterval(refreshTimer);
    autoRefresh(container);
  }, 60 * 1000);
}

document.addEventListener('visibilitychange', () => autoRefresh(document.getElementById('main')));

export function render(container) {
  stats = childStats();
  const today = todayISO();
  const now = nowMinutes();

  // i sotto-elementi (parent_id) compaiono dentro il loro genitore, non nell'elenco principale
  const topLevel = items.filter((i) => !i.parent_id);
  const dayItems = topLevel.filter((i) => i.scheduled_date === today);
  const allDay = dayItems.filter((i) => !i.start_time);
  const timed = dayItems
    .filter((i) => i.start_time)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const overdue = topLevel
    .filter((i) => i.type === 'task' && !i.done && i.scheduled_date && i.scheduled_date < today)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  container.innerHTML = `
    <p class="quote">${escapeHtml(quoteOfDay(today))}</p>
    ${nowCard(timed, allDay, now)}
    ${situation(topLevel, dayItems, overdue, today)}
    ${focusSection(topLevel, today)}
    ${overdue.length ? overdueSection(overdue) : ''}
    ${allDay.length ? allDaySection(allDay) : ''}
    ${daySlots(timed, workHours[isoWeekday(today)], now, today)}
  `;
  scheduleRefresh(container);

  // Un solo gestore per tutta la vista ("event delegation"):
  // guardiamo su quale elemento è avvenuto l'evento tramite data-action
  // Salva una modifica: la vista si aggiorna subito, e se il database rifiuta
  // la ridisegniamo con i valori di prima e mostriamo l'errore
  // saving = la promessa restituita da updateItem/setDone (che hanno già aggiornato la memoria)
  function save(saving, afterRender) {
    saving.catch((error) => {
      render(container);
      showToast(saveErrorMessage(error));
    });
    render(container);
    afterRender();
  }

  // Una task può comparire in due liste (es. "Prima di tutto" e "In giornata"):
  // dopo il render il focus torna nella stessa sezione in cui si è agito
  function sectionOf(element) {
    const id = element.closest('section')?.getAttribute('aria-labelledby');
    return () => container.querySelector(`section[aria-labelledby="${id}"]`) ?? container;
  }

  container.onchange = (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const item = items.find((i) => i.id === row.dataset.id);

    if (e.target.dataset.action === 'toggle') {
      const section = sectionOf(e.target);
      save(setDone(item, e.target.checked), () => restoreFocus(section(), item.id, 'input[type="checkbox"]'));
    }

    if (e.target.dataset.action === 'move' && e.target.value) {
      save(updateItem(item, { scheduled_date: e.target.value }), () => focusAfterMove(container, item.id));
    }
  };

  container.onclick = (e) => {
    const button = e.target.closest('[data-action]');
    if (!button || button.tagName !== 'BUTTON') return;
    const row = button.closest('[data-id]');
    const item = items.find((i) => i.id === row.dataset.id);

    if (button.dataset.action === 'open') openEditor(item.id);

    // "Metti qui": la task suggerita prende l'inizio del buco libero
    if (button.dataset.action === 'place') {
      const gap = button.closest('[data-gap-start]');
      const start = Number(gap.dataset.gapStart);
      const length = Number(gap.dataset.gapEnd) - start;
      save(updateItem(item, {
        scheduled_date: todayISO(),
        start_time: minToTime(start),
        duration_min: Math.min(item.duration_min ?? 30, length),
      }), () => restoreFocus(container, item.id, '[data-action="open"]'));
      showToast(`${item.title}: alle ${minToTime(start)}`);
    }

    if (button.dataset.action === 'to-today') {
      save(updateItem(item, { scheduled_date: todayISO() }), () => focusAfterMove(container, item.id));
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
    ? cardEntry(`Dopo, ${formatIn(timeToMin(next.start_time) - now)}`, next, `alle ${next.start_time}`)
    : `<div class="now-card__col">
        <p class="eyebrow">Dopo</p>
        <p class="now-card__title">Niente altro in programma</p>
      </div>`;

  return `<section class="now-card" aria-label="Adesso e prossimo impegno">${nowCol}${nextCol}</section>`;
}

function cardEntry(label, item, time) {
  const area = areaById(item.area_id);
  const where = item.location ? `, ${escapeHtml(item.location)}` : '';
  return `
    <div class="now-card__col" ${areaAttrs(area)}>
      <p class="eyebrow">${label}</p>
      <p class="now-card__title"><span class="dot"></span>${escapeHtml(item.title)}</p>
      <p class="now-card__sub"><span class="num">${time}</span>${where}</p>
    </div>`;
}

// ---------- Il punto della situazione: frasi invece di una griglia di numeri ----------
// (gli obiettivi si aggiungeranno qui nella Fase 11)
function situation(topLevel, dayItems, overdue, today) {
  const isTask = (i) => i.type === 'task';
  const dayTasks = dayItems.filter(isTask);
  const dayDone = dayTasks.filter((i) => i.done).length;

  const monday = startOfWeek(today);
  const sunday = addDays(monday, 6);
  const weekTasks = topLevel.filter((i) => isTask(i) && i.scheduled_date >= monday && i.scheduled_date <= sunday);
  const weekDone = weekTasks.filter((i) => i.done).length;

  const dueSoon = topLevel.filter((i) => isTask(i) && !i.done && i.due_date
    && i.due_date >= today && i.due_date <= addDays(today, 3)).length;

  let first = dayTasks.length
    ? `Oggi hai fatto <strong class="num">${dayDone}</strong> task su <span class="num">${dayTasks.length}</span>`
    : 'Oggi non hai task in programma';
  first += weekTasks.length
    ? `, questa settimana <strong class="num">${weekDone}</strong> su <span class="num">${weekTasks.length}</span>.`
    : '.';

  const parts = [];
  if (overdue.length) parts.push(`${overdue.length} ${overdue.length === 1 ? 'è rimasta' : 'sono rimaste'} indietro`);
  if (dueSoon) parts.push(`${dueSoon} ${dueSoon === 1 ? 'scade' : 'scadono'} entro 3 giorni`);
  let second = '';
  if (parts.length) second = parts.join(' e ') + '.';
  else if (dayTasks.length && dayDone === dayTasks.length) second = 'Sei in pari con tutto: bel lavoro.';
  second = second.charAt(0).toUpperCase() + second.slice(1);

  const percent = dayTasks.length ? Math.round((dayDone / dayTasks.length) * 100) : 0;

  return `
    <section class="section situation" aria-labelledby="h-situation">
      <h2 class="section__head" id="h-situation">Il punto</h2>
      <p class="situation__text">${first} ${second}</p>
      <div class="progress__track" role="progressbar" aria-label="Task di oggi completate"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <div class="progress__fill" style="width: ${percent}%"></div>
      </div>
    </section>`;
}

// ---------- Prima di tutto: al massimo 3 task, le più importanti o urgenti ----------
function focusSection(topLevel, today) {
  const soon = addDays(today, 1);
  const list = topLevel
    .filter((i) => i.type === 'task' && !i.done)
    // di oggi o rimaste indietro, oppure senza data ma in scadenza entro domani
    .filter((i) => (i.scheduled_date && i.scheduled_date <= today) || (!i.scheduled_date && i.due_date && i.due_date <= soon))
    .filter((i) => i.priority === 'high' || (i.due_date && i.due_date <= soon))
    .sort((a, b) => (priorityRank(a) - priorityRank(b))
      || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
    .slice(0, 3);

  if (!list.length) return '';
  return `
    <section class="section" aria-labelledby="h-focus">
      <h2 class="section__head" id="h-focus">${icon('flag')}Prima di tutto</h2>
      <ul class="group group--focus">${list.map((i) => itemRow(i, { stats, showDate: i.scheduled_date !== today })).join('')}</ul>
    </section>`;
}

// ---------- Rimaste indietro ----------
function overdueSection(overdue) {
  const rows = overdue.map((item) => itemRow(item, {
    stats,
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
  const sorted = [...allDay].sort((a, b) =>
    (a.done - b.done) || (priorityRank(a) - priorityRank(b)));

  return `
    <section class="section" aria-labelledby="h-allday">
      <h2 class="section__head" id="h-allday">${icon('listTodo')}In giornata</h2>
      <ul class="group">${sorted.map((i) => itemRow(i, { stats })).join('')}</ul>
    </section>`;
}

// ---------- Fasce orarie: prima del lavoro, lavoro, dopo lavoro ----------
function daySlots(timed, hours, now, today) {
  // Buchi liberi da adesso in poi, con i suggerimenti (senza ripetere la stessa task in due buchi)
  const used = new Set();
  const gaps = freeGaps(today, now).map((gap) => {
    const suggestions = suggestionsFor(gap.slot, today, { exclude: used });
    suggestions.forEach((s) => used.add(s.id));
    return { ...gap, suggestions };
  });

  if (!hours) {
    return slot({ id: 'free', label: 'Giornata libera', iconName: 'sun', list: timed, gaps, from: 0, to: 1440, now });
  }

  const start = timeToMin(hours.start);
  const end = timeToMin(hours.end);
  const minOf = (i) => timeToMin(i.start_time);
  const before = timed.filter((i) => minOf(i) < start);

  return `
    ${before.length ? slot({ id: 'before', label: 'Prima del lavoro', iconName: 'sunrise', list: before, gaps, from: 0, to: start, now }) : ''}
    ${slot({ id: 'work', label: 'Lavoro', iconName: 'briefcase', list: timed.filter((i) => minOf(i) >= start && minOf(i) < end), gaps, from: start, to: end, now, work: true })}
    ${slot({ id: 'after', label: 'Dopo lavoro', iconName: 'sunset', list: timed.filter((i) => minOf(i) >= end), gaps, from: end, to: 1440, now })}
  `;
}

function slot({ id, label, iconName, list, gaps, from, to, now, work = false }) {
  let range = `${minToTime(from)}–${minToTime(to)}`;
  if (from === 0 && to === 1440) range = '';
  else if (from === 0) range = `fino alle ${minToTime(to)}`;
  else if (to === 1440) range = `dalle ${minToTime(from)}`;

  // Righe ordinate per minuto: elementi, buchi liberi e linea dell'ora attuale
  // (a parità di minuto: prima la linea, poi il buco, poi l'elemento)
  const rows = list.map((i) => ({ min: timeToMin(i.start_time), order: 2, html: itemRow(i, { showTime: true, stats }) }));
  for (const gap of gaps.filter((g) => g.start >= from && g.start < to)) {
    rows.push({ min: gap.start, order: 1, html: gapRow(gap) });
  }
  if (now >= from && now < to) {
    rows.push({ min: now, order: 0, html: `<li class="now-line" aria-label="Ora attuale ${minToTime(now)}"><span class="num" aria-hidden="true">${minToTime(now)}</span></li>` });
  }
  rows.sort((a, b) => a.min - b.min || a.order - b.order);

  const hasContent = rows.some((r) => r.order > 0);
  const body = hasContent
    ? `<ul class="group">${rows.map((r) => r.html).join('')}</ul>`
    : `<div class="group"><p class="empty">Niente in programma</p></div>`;

  return `
    <section class="section ${work ? 'slot--work' : ''}" aria-labelledby="h-${id}">
      <h2 class="section__head" id="h-${id}">${icon(iconName)}${label}<span class="section__range num">${range}</span></h2>
      ${body}
    </section>`;
}

// Un buco libero con i suggerimenti: "Metti qui" pianifica la task all'inizio del buco
function gapRow(gap) {
  const length = gap.end - gap.start;
  const suggestions = gap.suggestions.length
    ? `<ul class="gap__list">${gap.suggestions.map((item) => {
        const area = areaById(item.area_id);
        return `
          <li class="suggestion" data-id="${item.id}" ${areaAttrs(area)}>
            <span class="dot"></span>
            <button class="suggestion__title" type="button" data-action="open">${escapeHtml(item.title)}</button>
            <button class="btn btn--sm" type="button" data-action="place">Metti qui</button>
          </li>`;
      }).join('')}</ul>`
    : `<p class="gap__empty">Niente da suggerire per questa fascia.</p>`;

  return `
    <li class="gap" data-gap-start="${gap.start}" data-gap-end="${gap.end}">
      <p class="gap__head"><span class="num">${minToTime(gap.start)}–${minToTime(gap.end)}</span> libero, <span class="num">${formatDuration(length)}</span></p>
      ${suggestions}
    </li>`;
}

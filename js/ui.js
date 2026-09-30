// Pezzi di interfaccia condivisi tra le viste

import { areas } from './data/fake-data.js';
import { icon } from './icons.js';
import { todayISO, addDays, formatDayShort, timeToMin, minToTime } from './dates.js';

// Evita che un titolo come "<b>ciao</b>" venga interpretato come HTML (protezione XSS)
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function areaById(id) {
  return areas.find((a) => a.id === id) ?? { id: 'none', name: 'Senza area', color: '#8a857d' };
}

// Attributi da mettere su ogni elemento colorato per area (vedi [data-area] in tokens.css)
// Il colore viene accettato solo nel formato #rrggbb: così nessun testo strano finisce nell'attributo style
export function areaAttrs(area) {
  const color = /^#[0-9a-f]{6}$/i.test(area.color) ? area.color : '#8a857d';
  return `data-area="${escapeHtml(area.id)}" style="--area: ${color}"`;
}

export function endTime(item) {
  return minToTime(timeToMin(item.start_time) + (item.duration_min ?? 0));
}

const priorityLabels = { high: 'alta', medium: 'media', low: 'bassa' };

function dueLabel(due) {
  const today = todayISO();
  if (due < today) return { text: 'Scaduta', late: true };
  if (due === today) return { text: 'Scade oggi', late: true };
  if (due === addDays(today, 1)) return { text: 'Scade domani', late: false };
  return { text: `Scade ${formatDayShort(due)}`, late: false };
}

// Una riga di elenco per task o appuntamento.
// Opzioni: showTime (colonna orario), showDate (data pianificata nei meta), lateDate, actions (HTML extra)
export function itemRow(item, { showTime = false, showDate = false, lateDate = false, actions = '' } = {}) {
  const area = areaById(item.area_id);
  const title = escapeHtml(item.title);
  const meta = [];

  if (showDate && item.scheduled_date) {
    meta.push(`<span class="${lateDate ? 'is-late' : ''}">${icon('calendar')}${formatDayShort(item.scheduled_date)}</span>`);
  }
  meta.push(`<span><span class="dot"></span>${escapeHtml(area.name)}</span>`);
  if (item.location) {
    meta.push(`<span>${icon('mapPin')}${escapeHtml(item.location)}</span>`);
  }
  if (item.due_date && !item.done) {
    const due = dueLabel(item.due_date);
    meta.push(`<span class="${due.late ? 'is-late' : ''}">${icon('flag')}${due.text}</span>`);
  }

  const time = showTime && item.start_time
    ? `<div class="item__time num">${item.start_time}<small>${endTime(item)}</small></div>`
    : '';

  // Le task hanno la checkbox, gli appuntamenti un'icona (non si "spuntano")
  const control = item.type === 'task'
    ? `<label class="check">
        <input type="checkbox" data-action="toggle" ${item.done ? 'checked' : ''} aria-label="Fatto: ${title}">
        <span class="check__box">${icon('check')}</span>
      </label>`
    : `<span class="item__marker" title="Appuntamento">${icon('calendar')}<span class="visually-hidden">Appuntamento:</span></span>`;

  const flag = item.priority
    ? `<span class="item__flag item__flag--${item.priority}" title="Priorità ${priorityLabels[item.priority]}">${icon('flag')}<span class="visually-hidden">Priorità ${priorityLabels[item.priority]}</span></span>`
    : '';

  return `
    <li class="item ${item.done ? 'is-done' : ''}" data-id="${item.id}" ${areaAttrs(area)}>
      ${time}
      ${control}
      <div class="item__body">
        <p class="item__title">${title}</p>
        <p class="item__meta">${meta.join('')}</p>
        ${actions ? `<div class="item__actions">${actions}</div>` : ''}
      </div>
      ${flag}
    </li>`;
}

// Dopo un nuovo render il focus andrebbe perso: lo rimettiamo sulla stessa checkbox/pulsante
export function restoreFocus(container, id, selector) {
  container.querySelector(`[data-id="${id}"] ${selector}`)?.focus();
}

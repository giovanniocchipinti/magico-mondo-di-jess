// Pezzi di interfaccia condivisi tra le viste

import { areas, items, goals } from './data/db.js';
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
// extraStyle: altre regole CSS da aggiungere allo stesso attributo style (es. la posizione di un blocco)
export function areaAttrs(area, extraStyle = '') {
  const color = /^#[0-9a-f]{6}$/i.test(area.color) ? area.color : '#8a857d';
  return `data-area="${escapeHtml(area.id)}" style="--area: ${color};${extraStyle}"`;
}

export function endTime(item) {
  return minToTime(timeToMin(item.start_time) + (item.duration_min ?? 0));
}

const priorityLabels = { high: 'alta', medium: 'media', low: 'bassa' };

// Importi in euro all'italiana: 1234.5 -> "1.234,50 €"
// useGrouping 'always': in italiano il separatore delle migliaia di default parte da 10.000
const moneyFormat = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
export function formatMoney(amount) {
  return moneyFormat.format(amount);
}

// Ordine di importanza per ordinare le liste: alta 0, media 1, bassa 2, nessuna 3
const priorityOrder = { high: 0, medium: 1, low: 2 };
export function priorityRank(item) {
  return priorityOrder[item.priority] ?? 3;
}

function dueLabel(due) {
  const today = todayISO();
  if (due < today) return { text: 'Scaduta', late: true };
  if (due === today) return { text: 'Scade oggi', late: true };
  if (due === addDays(today, 1)) return { text: 'Scade domani', late: false };
  return { text: `Scade ${formatDayShort(due)}`, late: false };
}

// Una riga di elenco per task o appuntamento.
// Opzioni: showTime (colonna orario), showDate (data pianificata nei meta), lateDate, actions (HTML extra),
// stats (risultato di childStats(), per il contatore dei sotto-elementi)
export function itemRow(item, { showTime = false, showDate = false, lateDate = false, actions = '', stats } = {}) {
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
  // Avanzamento dei sotto-elementi, es. "2/5"
  if (item.goal_id) {
    const goal = goals.find((g) => g.id === item.goal_id);
    if (goal) meta.push(`<span class="item__goal">${icon('target')}${escapeHtml(goal.title)}</span>`);
  }
  const children = stats?.get(item.id);
  if (children) {
    meta.push(`<span>${icon('listTodo')}<span class="num">${children.done}/${children.total}</span><span class="visually-hidden"> sotto-elementi fatti</span></span>`);
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
        <button class="item__title" type="button" data-action="open">${title}</button>
        <p class="item__meta">${meta.join('')}</p>
        ${actions ? `<div class="item__actions">${actions}</div>` : ''}
      </div>
      ${flag}
    </li>`;
}

// Messaggio breve in basso, con un'azione facoltativa (es. "Annulla").
// role="status" lo fa leggere agli screen reader.
//   onAction: chiamata se l'utente preme l'azione (o Cmd/Ctrl+Z)
//   onExpire: chiamata se l'avviso si chiude SENZA azione (tempo scaduto o sostituito da un altro)
let toastTimer = null;
let toastState = null; // { onAction, onExpire } dell'avviso visibile

function closeToast(byAction) {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimer);
  toast.hidden = true;
  const state = toastState;
  toastState = null;
  if (!state) return;
  if (byAction) state.onAction?.();
  else state.onExpire?.();
}

function startToastTimer() {
  clearTimeout(toastTimer);
  // con un'azione lasciamo più tempo per leggerla e raggiungerla
  toastTimer = setTimeout(() => closeToast(false), toastState?.onAction ? 8000 : 5000);
}

export function showToast(message, { actionLabel, onAction, onExpire } = {}) {
  // Un avviso precedente ancora aperto "scade": la sua operazione va conclusa
  if (toastState) closeToast(false);

  const toast = document.getElementById('toast');
  const text = document.createElement('span');
  text.textContent = message; // textContent, non innerHTML: il messaggio può contenere un titolo scritto dall'utente
  toast.replaceChildren(text);

  if (actionLabel) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast__action';
    button.textContent = actionLabel;
    button.setAttribute('aria-keyshortcuts', 'Control+Z Meta+Z');
    button.addEventListener('click', () => closeToast(true));
    toast.append(button);
  }

  toastState = { onAction, onExpire };
  toast.hidden = false;
  startToastTimer();
}

// Chiude subito l'avviso aperto, concludendo la sua operazione (es. prima del logout)
export function flushToast() {
  if (toastState) closeToast(false);
}

// Una volta sola: il tempo si ferma mentre l'avviso è sotto il mouse o ha il focus,
// e Cmd/Ctrl+Z esegue l'azione (es. Annulla) senza doverla raggiungere con Tab
export function initToast() {
  const toast = document.getElementById('toast');
  const pause = () => clearTimeout(toastTimer);
  const resume = () => { if (toastState) startToastTimer(); };
  toast.addEventListener('mouseenter', pause);
  toast.addEventListener('mouseleave', resume);
  toast.addEventListener('focusin', pause);
  toast.addEventListener('focusout', resume);

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, select, [contenteditable]');
    if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !typing && toastState?.onAction) {
      e.preventDefault();
      closeToast(true);
    }
  });
}

// Messaggio per un salvataggio fallito: i problemi di rete si risolvono riprovando,
// i rifiuti del database (error.code, es. 23514 = vincolo CHECK) no
export function saveErrorMessage(error) {
  if (error?.code) return `Il database ha rifiutato la modifica (codice ${error.code}). Controlla i campi.`;
  return 'Non salvato. Controlla la connessione e riprova.';
}

// Quanti sotto-elementi (fatti / totali) ha ogni genitore: si calcola una volta per render,
// invece di scorrere tutti gli elementi per ogni riga
export function childStats() {
  const stats = new Map();
  for (const item of items) {
    if (!item.parent_id) continue;
    const entry = stats.get(item.parent_id) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (item.done) entry.done += 1;
    stats.set(item.parent_id, entry);
  }
  return stats;
}

// Dopo un nuovo render il focus andrebbe perso: lo rimettiamo sulla stessa checkbox/pulsante
export function restoreFocus(container, id, selector) {
  container.querySelector(`[data-id="${id}"] ${selector}`)?.focus();
}

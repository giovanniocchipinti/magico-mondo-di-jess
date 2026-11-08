// Vista Soldi: riepilogo del mese, scadenze in arrivo, grafici e movimenti

import { transactions, recurring, categories, ensureCategories } from '../data/db.js';
import { icon } from '../icons.js';
import { escapeHtml, formatMoney, saveErrorMessage } from '../ui.js';
import { todayISO, addDays, addMonths, monthKey, formatDayLong, formatDayShort, formatTimeLeft } from '../dates.js';
import { openTransactionEditor, openRecurringEditor, payRecurring } from '../money-editor.js';

export const title = 'Soldi';

// Mese visualizzato, "YYYY-MM": resta finché la pagina è aperta
let month = monthKey(todayISO());

function monthLabel(key, options = { month: 'long', year: 'numeric' }) {
  const text = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', ...options }).format(new Date(key + '-01T00:00:00Z'));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function eyebrow() {
  return monthLabel(month);
}

const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? 'Senza categoria';

// Somme di un mese: { in, out }
function totals(key) {
  const sum = { in: 0, out: 0 };
  for (const t of transactions) if (monthKey(t.date) === key) sum[t.kind] += t.amount;
  return sum;
}

export function render(container) {
  // le categorie iniziali si creano la prima volta che si apre questa pagina
  if (!categories.length) {
    container.innerHTML = '<p class="empty">Preparo le categorie…</p>';
    ensureCategories()
      // nel frattempo si potrebbe essere passati a un'altra vista: ridisegniamo solo se Soldi è ancora aperta
      .then(() => { if (container.dataset.view === 'soldi') render(container); })
      .catch((error) => { container.innerHTML = `<p class="empty">${saveErrorMessage(error)}</p>`; });
    return;
  }

  const today = todayISO();
  const isCurrentMonth = month === monthKey(today);
  const sum = totals(month);
  const balance = sum.in - sum.out;

  container.innerHTML = `
    <div class="month-nav">
      <button class="icon-btn" type="button" data-action="prev-month" aria-label="Mese precedente">${icon('chevronLeft')}</button>
      <p class="month-nav__label">${monthLabel(month)}</p>
      <button class="icon-btn" type="button" data-action="next-month" aria-label="Mese successivo">${icon('chevronRight')}</button>
    </div>

    <dl class="money-summary">
      <div><dt>Entrate</dt><dd class="num">${formatMoney(sum.in)}</dd></div>
      <div><dt>Uscite</dt><dd class="num">${formatMoney(sum.out)}</dd></div>
      <div><dt>Saldo</dt><dd class="num ${balance < 0 ? 'is-negative' : ''}">${formatMoney(balance)}</dd></div>
    </dl>

    ${isCurrentMonth ? dueSection(today) : ''}
    ${categoryChart()}
    ${monthsChart()}
    ${transactionList()}
    ${recurringSection()}
  `;

  container.onclick = (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const id = button.closest('[data-id]')?.dataset.id;
    const action = button.dataset.action;

    if (action === 'prev-month' || action === 'next-month') {
      month = monthKey(addMonths(month + '-01', action === 'prev-month' ? -1 : 1));
      // ridisegno completo tramite main.js: si aggiorna anche il mese in alto
      document.dispatchEvent(new CustomEvent('agenda:changed', { detail: {} }));
      container.querySelector(`[data-action="${action}"]`)?.focus();
    }
    if (action === 'pay') payRecurring(id);
    if (action === 'open-recurring') openRecurringEditor(id);
    if (action === 'new-recurring') openRecurringEditor(null);
    if (action === 'open-transaction') openTransactionEditor(id);
  };
}

// ---------- Scadenze: pagamenti ricorrenti scaduti o entro 30 giorni ----------
export function dueSoon(today, withinDays) {
  const limit = addDays(today, withinDays);
  return recurring
    .filter((r) => r.active && r.next_due <= limit)
    .sort((a, b) => a.next_due.localeCompare(b.next_due));
}

export function dueRow(r, today) {
  const late = r.next_due < today;
  const when = r.next_due === today ? 'scade oggi' : late ? formatTimeLeft(today, r.next_due) : `entro ${formatDayShort(r.next_due)}`;
  return `
    <li class="due ${late ? 'is-late' : ''}" data-id="${r.id}">
      <button class="due__title" type="button" data-action="open-recurring">
        <span>${escapeHtml(r.title)}</span>
        <span class="due__when">${late ? icon('history') : icon('calendar')}${when}</span>
      </button>
      <span class="due__amount num">${r.kind === 'in' ? '+' : ''}${formatMoney(r.amount)}</span>
      <button class="btn btn--sm" type="button" data-action="pay">${r.kind === 'in' ? 'Incassato' : 'Pagato'}</button>
    </li>`;
}

function dueSection(today) {
  const list = dueSoon(today, 30);
  if (!list.length) return '';
  return `
    <section class="section" aria-labelledby="h-due">
      <h2 class="section__head" id="h-due">${icon('calendar')}Scadenze in arrivo</h2>
      <ul class="group">${list.map((r) => dueRow(r, today)).join('')}</ul>
    </section>`;
}

// ---------- Grafico 1: dove vanno i soldi (uscite del mese per categoria) ----------
// Barre orizzontali in HTML: una sola serie, quindi un solo colore e nessuna legenda;
// il valore è scritto accanto a ogni barra, così il colore non serve a leggere il dato.
function categoryChart() {
  const byCategory = new Map();
  for (const t of transactions) {
    if (t.kind !== 'out' || monthKey(t.date) !== month) continue;
    const name = categoryName(t.category_id);
    byCategory.set(name, (byCategory.get(name) ?? 0) + t.amount);
  }
  if (!byCategory.size) return '';

  let rows = [...byCategory].sort((a, b) => b[1] - a[1]);
  // oltre 6 categorie, le più piccole finiscono in "Altre"
  if (rows.length > 6) {
    const rest = rows.slice(5).reduce((s, [, v]) => s + v, 0);
    rows = [...rows.slice(0, 5), ['Altre', rest]];
  }
  const max = rows[0][1];

  return `
    <section class="section" aria-labelledby="h-cat">
      <h2 class="section__head" id="h-cat">Dove vanno i soldi</h2>
      <ul class="bars">
        ${rows.map(([name, value]) => `
          <li class="bars__row">
            <span class="bars__label">${escapeHtml(name)}</span>
            <span class="bars__track"><span class="bars__fill" style="width: ${Math.max(2, (value / max) * 100)}%"></span></span>
            <span class="bars__value num">${formatMoney(value)}</span>
          </li>`).join('')}
      </ul>
    </section>`;
}

// ---------- Grafico 2: entrate e uscite degli ultimi 6 mesi ----------
// SVG disegnato a mano: per ogni mese due barre affiancate. Legenda sempre presente (2 serie),
// suggerimento al passaggio del mouse (<title>) e una tabella nascosta per gli screen reader.
function monthsChart() {
  const keys = [];
  for (let i = 5; i >= 0; i--) keys.push(monthKey(addMonths(month + '-01', -i)));
  const data = keys.map((key) => ({ key, ...totals(key) }));
  const max = Math.max(...data.map((d) => Math.max(d.in, d.out)));
  if (max === 0) return '';

  const width = 320;
  const height = 150;
  const top = 8;
  const bottom = 22;              // spazio per i nomi dei mesi
  const plot = height - top - bottom;
  const group = width / data.length;
  const bar = 14;
  const gap = 2;                  // 2px tra le due barre dello stesso mese

  // barra con gli angoli in alto arrotondati (4px) e la base piatta sull'asse
  const barPath = (x, h) => {
    const r = Math.min(4, h / 2, bar / 2);
    const y = top + plot - h;
    return `M${x},${top + plot} V${y + r} Q${x},${y} ${x + r},${y} H${x + bar - r} Q${x + bar},${y} ${x + bar},${y + r} V${top + plot} Z`;
  };

  const bars = data.map((d, i) => {
    const center = i * group + group / 2;
    const xIn = center - bar - gap / 2;
    const xOut = center + gap / 2;
    const hIn = (d.in / max) * plot;
    const hOut = (d.out / max) * plot;
    const label = monthLabel(d.key, { month: 'short' });
    return `
      <g class="chart__month">
        <title>${monthLabel(d.key)}: entrate ${formatMoney(d.in)}, uscite ${formatMoney(d.out)}</title>
        <rect class="chart__hit" x="${i * group}" y="0" width="${group}" height="${height}"></rect>
        ${hIn > 0 ? `<path class="chart__in" d="${barPath(xIn, Math.max(hIn, 2))}"></path>` : ''}
        ${hOut > 0 ? `<path class="chart__out" d="${barPath(xOut, Math.max(hOut, 2))}"></path>` : ''}
        <text class="chart__label" x="${center}" y="${height - 6}" text-anchor="middle">${label}</text>
      </g>`;
  }).join('');

  return `
    <section class="section" aria-labelledby="h-months">
      <h2 class="section__head" id="h-months">Ultimi 6 mesi</h2>
      <div class="chart">
        <ul class="chart__legend" aria-hidden="true">
          <li><span class="chart__key chart__key--in"></span>Entrate</li>
          <li><span class="chart__key chart__key--out"></span>Uscite</li>
        </ul>
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="h-months">
          <line class="chart__axis" x1="0" x2="${width}" y1="${top + plot}" y2="${top + plot}"></line>
          ${bars}
        </svg>
        <table class="visually-hidden">
          <caption>Entrate e uscite degli ultimi 6 mesi</caption>
          <thead><tr><th>Mese</th><th>Entrate</th><th>Uscite</th></tr></thead>
          <tbody>${data.map((d) => `<tr><td>${monthLabel(d.key)}</td><td>${formatMoney(d.in)}</td><td>${formatMoney(d.out)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </section>`;
}

// ---------- Movimenti del mese, giorno per giorno (dal più recente) ----------
function transactionList() {
  const list = transactions
    .filter((t) => monthKey(t.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));

  if (!list.length) {
    return `<div class="placeholder"><p>Nessun movimento in ${monthLabel(month, { month: 'long' }).toLowerCase()}</p>
      <p>Usa il pulsante + per registrare un'entrata o un'uscita.</p></div>`;
  }

  // raggruppa per giorno
  const days = new Map();
  for (const t of list) {
    if (!days.has(t.date)) days.set(t.date, []);
    days.get(t.date).push(t);
  }

  return `
    <section class="section" aria-labelledby="h-tx">
      <h2 class="section__head" id="h-tx">Movimenti</h2>
      ${[...days].map(([date, rows]) => `
        <h3 class="day-head">${formatDayLong(date)}</h3>
        <ul class="group">
          ${rows.map((t) => `
            <li class="tx" data-id="${t.id}">
              <span class="tx__dot tx__dot--${t.kind}" aria-hidden="true"></span>
              <button class="tx__main" type="button" data-action="open-transaction">
                <span class="tx__title">${escapeHtml(t.description || categoryName(t.category_id))}</span>
                ${t.description ? `<span class="tx__meta">${escapeHtml(categoryName(t.category_id))}</span>` : ''}
              </button>
              <span class="tx__amount num">${t.kind === 'in' ? '+' : '−'}${formatMoney(t.amount)}
                <span class="visually-hidden">${t.kind === 'in' ? 'entrata' : 'uscita'}</span></span>
            </li>`).join('')}
        </ul>`).join('')}
    </section>`;
}

// ---------- Tutti i pagamenti ricorrenti ----------
function recurringSection() {
  const list = [...recurring].sort((a, b) => a.next_due.localeCompare(b.next_due));
  const every = (n) => (n === 1 ? 'ogni mese' : n === 12 ? 'ogni anno' : `ogni ${n} mesi`);
  return `
    <details class="archive" ${list.length ? '' : 'open'}>
      <summary class="section__head">${icon('history')}Pagamenti ricorrenti <span class="count num">${list.length}</span></summary>
      ${list.length ? `<ul class="group">${list.map((r) => `
        <li class="tx" data-id="${r.id}">
          <span class="tx__dot tx__dot--${r.kind}" aria-hidden="true"></span>
          <button class="tx__main" type="button" data-action="open-recurring">
            <span class="tx__title">${escapeHtml(r.title)}</span>
            <span class="tx__meta">${every(r.every_months)}, prossima ${formatDayShort(r.next_due)}</span>
          </button>
          <span class="tx__amount num">${formatMoney(r.amount)}</span>
        </li>`).join('')}</ul>` : '<p class="form-hint">Affitto, bollette, abbonamenti: impostali una volta e l\'app ti ricorda le scadenze.</p>'}
      <button class="btn" type="button" data-action="new-recurring">${icon('plus')}Aggiungi pagamento ricorrente</button>
    </details>`;
}

// Pannello dei soldi, in due modalità:
//   movimento  = un'entrata o un'uscita (nuova, da modificare, o il pagamento di una scadenza)
//   ricorrente = un pagamento che si ripete (affitto, luce, abbonamenti) con la prossima scadenza

import {
  areas, goals, categories, transactions, recurring, currentGeneration,
  createTransaction, updateTransaction, deleteTransaction,
  createRecurring, updateRecurring, deleteRecurring,
} from './data/db.js';
import { icon } from './icons.js';
import { escapeHtml, areaAttrs, showToast, saveErrorMessage, formatMoney } from './ui.js';
import { todayISO, addMonths } from './dates.js';

const dialog = document.getElementById('money-editor');
const form = document.getElementById('money-form');

// Cosa c'è aperto nel pannello
let mode = 'transaction';  // 'transaction' | 'recurring'
let current = null;        // la riga che si modifica; null = nuova
let paying = null;         // la scadenza ricorrente che si sta pagando (solo modalità movimento)

const frequencies = [[1, 'Ogni mese'], [2, 'Ogni 2 mesi'], [3, 'Ogni 3 mesi'], [6, 'Ogni 6 mesi'], [12, 'Ogni anno']];

function notifyChange() {
  document.dispatchEvent(new CustomEvent('agenda:changed', { detail: {} }));
}

// ---------- Apertura ----------

export function openTransactionEditor(id = null) {
  mode = 'transaction';
  current = id ? transactions.find((t) => t.id === id) : null;
  paying = null;
  render();
}

export function openRecurringEditor(id = null) {
  mode = 'recurring';
  current = id ? recurring.find((r) => r.id === id) : null;
  paying = null;
  render();
}

// "Pagato": un movimento nuovo già compilato con i dati della scadenza
export function payRecurring(id) {
  mode = 'transaction';
  current = null;
  paying = recurring.find((r) => r.id === id);
  render();
}

function render() {
  form.innerHTML = mode === 'transaction' ? transactionForm() : recurringForm();
  renderCategories();
  if (!dialog.open) dialog.showModal();
  form.elements.amount.focus();
}

// ---------- Pezzi di form ----------

function radio(name, value, label, checkedValue) {
  return `
    <label class="segmented__option">
      <input type="radio" name="${name}" value="${value}" ${String(value) === String(checkedValue) ? 'checked' : ''}>
      <span>${label}</span>
    </label>`;
}

function kindField(kind) {
  return `
    <fieldset class="form-field">
      <legend class="visually-hidden">Tipo</legend>
      <div class="segmented">
        ${radio('kind', 'out', 'Uscita', kind)}
        ${radio('kind', 'in', 'Entrata', kind)}
      </div>
    </fieldset>`;
}

function amountField(amount, label) {
  return `
    <div class="form-field">
      <label for="money-amount">${label}</label>
      <div class="amount-field">
        <input class="field field--amount num" id="money-amount" name="amount" type="text" inputmode="decimal"
               autocomplete="off" placeholder="0,00" value="${amount ? String(amount).replace('.', ',') : ''}">
        <span class="amount-field__unit" aria-hidden="true">€</span>
      </div>
    </div>`;
}

function areaField(areaId) {
  return `
    <fieldset class="form-field">
      <legend>Di cosa fa parte</legend>
      <div class="chip-group">
        ${areas.map((a) => `
          <label class="chip" ${areaAttrs(a)}>
            <input type="radio" name="area_id" value="${a.id}" ${a.id === areaId ? 'checked' : ''}>
            <span class="dot"></span>${escapeHtml(a.name)}
          </label>`).join('')}
      </div>
    </fieldset>`;
}

// Le categorie dipendono dal tipo (entrata/uscita): si ridisegnano quando cambia
function renderCategories() {
  const box = form.querySelector('[data-section="categories"]');
  const kind = form.elements.kind.value;
  const selected = box.dataset.selected;
  const list = categories.filter((c) => c.kind === kind);
  box.innerHTML = list.map((c) => `
    <label class="chip">
      <input type="radio" name="category_id" value="${c.id}" ${c.id === selected ? 'checked' : ''}>${escapeHtml(c.name)}
    </label>`).join('');
}

function footer(canDelete, saveLabel) {
  return `
    <p class="form-error" id="money-error" role="alert"></p>
    <div class="sheet__footer">
      ${canDelete ? `<button class="btn btn--ghost btn--danger" type="button" data-action="delete">${icon('trash')}Elimina</button>` : '<span></span>'}
      <button class="btn btn--primary" type="submit">${saveLabel}</button>
    </div>`;
}

function header(title) {
  return `
    <div class="sheet__head">
      <h2 class="sheet__title" id="money-editor-title">${title}</h2>
      <button class="icon-btn" type="button" data-action="close" aria-label="Chiudi senza salvare">${icon('x')}</button>
    </div>`;
}

// Area proposta per una riga nuova: la prima della vita privata, se c'è
function defaultArea() {
  return (areas.find((a) => a.face === 'personal') ?? areas[0])?.id ?? null;
}

function transactionForm() {
  // valori di partenza: la riga da modificare, la scadenza da pagare, oppure vuoti
  const t = current ?? (paying
    ? { kind: paying.kind, amount: paying.amount, description: paying.title, category_id: paying.category_id, area_id: paying.area_id, date: todayISO(), goal_id: null }
    : { kind: 'out', amount: null, description: '', category_id: null, area_id: defaultArea(), date: todayISO(), goal_id: null });
  // solo obiettivi misurati in euro: 300 € non devono finire in "20 libri"
  const isEuro = (g) => /^(€|eur|euro)$/i.test((g.unit ?? '').trim());
  const moneyGoals = goals.filter((g) => g.kind === 'number' && isEuro(g) && (!g.achieved_at || g.id === t.goal_id));

  let title = current ? 'Movimento' : 'Nuovo movimento';
  if (paying) title = `Pagamento: ${escapeHtml(paying.title)}`;

  return `
    ${header(title)}
    ${kindField(t.kind)}
    ${amountField(t.amount, paying ? 'Importo pagato' : 'Importo')}
    <div class="form-field">
      <label for="money-desc">Descrizione</label>
      <input class="field" id="money-desc" name="description" type="text" maxlength="200" autocomplete="off"
             placeholder="Es. Spesa al mercato" value="${escapeHtml(t.description)}">
    </div>
    <fieldset class="form-field">
      <legend>Categoria</legend>
      <div class="chip-group" data-section="categories" data-selected="${t.category_id ?? ''}"></div>
    </fieldset>
    <div class="form-field">
      <label for="money-date">Giorno</label>
      <input class="field num" id="money-date" name="date" type="date" value="${t.date}">
    </div>
    ${areaField(t.area_id)}
    ${moneyGoals.length ? `
      <div class="form-field">
        <label for="money-goal">Fa parte di un obiettivo?</label>
        <select class="field" id="money-goal" name="goal_id">
          <option value="">No</option>
          ${moneyGoals.map((g) => `<option value="${g.id}" ${g.id === t.goal_id ? 'selected' : ''}>${escapeHtml(g.title)}</option>`).join('')}
        </select>
      </div>` : ''}
    ${paying ? `<p class="form-hint">Dopo il salvataggio la prossima scadenza passa da sola alla volta successiva.</p>` : ''}
    ${footer(Boolean(current), paying ? 'Segna come pagato' : 'Salva')}`;
}

function recurringForm() {
  const r = current ?? { title: '', kind: 'out', amount: null, category_id: null, area_id: defaultArea(), every_months: 1, next_due: todayISO() };
  return `
    ${header(current ? 'Pagamento ricorrente' : 'Nuovo pagamento ricorrente')}
    <div class="form-field">
      <label for="rec-title">Cosa</label>
      <input class="field" id="rec-title" name="title" type="text" maxlength="200" autocomplete="off"
             placeholder="Es. Affitto, Luce, Netflix" value="${escapeHtml(r.title)}">
    </div>
    ${kindField(r.kind)}
    ${amountField(r.amount, 'Importo previsto')}
    <fieldset class="form-field">
      <legend>Categoria</legend>
      <div class="chip-group" data-section="categories" data-selected="${r.category_id ?? ''}"></div>
    </fieldset>
    <div class="field-row">
      <label class="field-inline">Ogni quanto
        <select class="field" name="every_months">
          ${frequencies.map(([value, label]) => `<option value="${value}" ${value === r.every_months ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </label>
      <label class="field-inline">Prossima scadenza
        <input class="field num" name="next_due" type="date" value="${r.next_due}">
      </label>
    </div>
    ${areaField(r.area_id)}
    ${footer(Boolean(current), 'Salva')}`;
}

// ---------- Lettura e salvataggio ----------

// Accetta "12,50", "12.50", "1.234,50" e "1.500" (punto delle migliaia):
// restituisce un numero con 2 decimali, oppure NaN
function parseAmount(text) {
  let clean = String(text).trim().replace(/\s|€/g, '');
  if (clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) clean = clean.replace(/\./g, ''); // "1.500" = millecinquecento
  const value = Number(clean);
  return clean && Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
}

function showError(message) {
  form.querySelector('#money-error').textContent = message;
}

async function saveTransaction() {
  const data = new FormData(form);
  const fields = {
    kind: data.get('kind'),
    amount: parseAmount(data.get('amount')),
    description: data.get('description').trim(),
    category_id: data.get('category_id') || null,
    date: data.get('date'),
    area_id: data.get('area_id') || null,
    goal_id: data.get('goal_id') || null,
  };
  if (!(fields.amount > 0)) return showError('Scrivi un importo maggiore di zero, per esempio 12,50.');
  if (!fields.date) return showError('Scegli il giorno.');

  try {
    if (current) {
      await updateTransaction(current, fields);
    } else {
      await createTransaction({ ...fields, recurring_id: paying?.id ?? null });
      // pagata una scadenza: la prossima passa alla volta successiva
      if (paying) {
        const rec = paying;
        dialog.close(); // il movimento è salvato: niente doppioni premendo di nuovo
        try {
          await updateRecurring(rec, { next_due: addMonths(rec.next_due, rec.every_months, rec.day_of_month) });
          showToast(`Pagato: ${rec.title}, ${formatMoney(fields.amount)}`);
        } catch {
          showToast(`Pagamento registrato, ma la scadenza di "${rec.title}" non è stata spostata: aprila e aggiorna la data.`);
        }
        return;
      }
    }
    dialog.close();
  } catch (error) {
    showError(saveErrorMessage(error));
  }
}

async function saveRecurring() {
  const data = new FormData(form);
  const nextDue = data.get('next_due');
  const fields = {
    title: data.get('title').trim(),
    kind: data.get('kind'),
    amount: parseAmount(data.get('amount')),
    category_id: data.get('category_id') || null,
    area_id: data.get('area_id') || null,
    every_months: Number(data.get('every_months')),
    next_due: nextDue,
  };
  if (!fields.title) return showError('Scrivi cosa paghi, per esempio Affitto.');
  if (!(fields.amount > 0)) return showError('Scrivi un importo maggiore di zero, per esempio 80.');
  if (!nextDue) return showError('Scegli la prossima scadenza.');
  // il giorno del mese si ricava dalla scadenza; se la data non è cambiata teniamo quello salvato
  // (così "il 31" non diventa "il 28" dopo febbraio)
  fields.day_of_month = current && current.next_due === nextDue ? current.day_of_month : Number(nextDue.slice(8, 10));

  try {
    if (current) await updateRecurring(current, fields);
    else await createRecurring(fields);
    dialog.close();
  } catch (error) {
    showError(saveErrorMessage(error));
  }
}

// Elimina un movimento con "Annulla" (come per gli elementi dell'agenda)
function deleteTransactionWithUndo(row) {
  const generation = currentGeneration();
  transactions.splice(transactions.indexOf(row), 1);
  notifyChange();

  showToast(`Eliminato: ${formatMoney(row.amount)}${row.description ? `, ${row.description}` : ''}`, {
    actionLabel: 'Annulla',
    onAction: () => {
      transactions.push(row);
      notifyChange();
    },
    onExpire: () => {
      deleteTransaction(row.id).catch(() => {
        if (generation !== currentGeneration()) return;
        transactions.push(row);
        notifyChange();
        showToast('Eliminazione non riuscita: il movimento è tornato al suo posto.');
      });
    },
  });
}

export function initMoneyEditor() {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (mode === 'transaction') saveTransaction();
    else saveRecurring();
  });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'kind') {
      // le categorie di un'uscita non valgono per un'entrata: si riparte da nessuna selezionata
      form.querySelector('[data-section="categories"]').dataset.selected = '';
      renderCategories();
    }
  });

  form.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'close') dialog.close();

    if (button.dataset.action === 'delete') {
      if (mode === 'transaction') {
        const row = current;
        dialog.close();
        deleteTransactionWithUndo(row);
      } else {
        // conferma nativa: eliminare una scadenza è raro; i movimenti già pagati restano
        if (!confirm(`Eliminare il pagamento ricorrente "${current.title}"? I movimenti già registrati restano.`)) return;
        try {
          await deleteRecurring(current);
          dialog.close();
        } catch (error) {
          showError(saveErrorMessage(error));
        }
      }
    }
  });

  dialog.addEventListener('close', notifyChange);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

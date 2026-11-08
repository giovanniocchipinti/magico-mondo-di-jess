// Pannello di dettaglio: modifica completa di un elemento, sotto-elementi ed eliminazione.
//
// Le modifiche ai campi si salvano solo con "Salva" (chiudere = annullare).
// I sotto-elementi invece sono righe a sé nel database e si salvano subito.

import { items, areas, goals, updateItem, setDone, createItem, deleteItem, removeLocally, restoreItems, currentGeneration } from './data/db.js';
import { icon } from './icons.js';
import { escapeHtml, areaAttrs, showToast, saveErrorMessage } from './ui.js';
import { todayISO, addDays, formatDuration } from './dates.js';

const dialog = document.getElementById('item-editor');
const form = document.getElementById('item-form');
let current = null; // l'elemento aperto nel pannello

const durations = [15, 30, 45, 60, 90, 120, 180, 240];
const priorities = [['', 'Nessuna'], ['low', 'Bassa'], ['medium', 'Media'], ['high', 'Alta']];

// Avvisa il resto dell'app che i dati sono cambiati: main.js ridisegna la vista.
// Un evento invece di una chiamata diretta: il pannello non deve sapere quale vista è aperta.
function notifyChange(focusId = null) {
  document.dispatchEvent(new CustomEvent('agenda:changed', { detail: { focusId } }));
}

export function openEditor(itemId, { focus } = {}) {
  current = items.find((i) => i.id === itemId);
  if (!current) return;
  renderForm();
  if (!dialog.open) dialog.showModal();
  (focus === 'date' ? form.elements.scheduled_date : form.elements.title).focus();
}

// Elimina subito dalla pagina, ma sul database solo quando l'avviso con "Annulla" si chiude
// (tempo scaduto, nuovo avviso o logout). Se si chiude l'app prima, l'elemento resta:
// meglio così che perderlo per sbaglio.
export function deleteWithUndo(item) {
  const removed = removeLocally(item);
  const generation = currentGeneration();
  notifyChange();

  showToast(`Eliminato: ${item.title}`, {
    actionLabel: 'Annulla',
    onAction: () => {
      restoreItems(removed);
      notifyChange(item.id);
    },
    onExpire: () => {
      deleteItem(item.id).catch(() => {
        // Dopo un logout la memoria appartiene a un'altra sessione: non rimettiamo niente
        if (generation !== currentGeneration()) return;
        restoreItems(removed);
        notifyChange(item.id);
        showToast('Eliminazione non riuscita: l\'elemento è tornato al suo posto.');
      });
    },
  });
}

// ---------- Costruzione del form ----------

function radio(name, value, label, checkedValue) {
  return `
    <label class="segmented__option">
      <input type="radio" name="${name}" value="${value}" ${value === checkedValue ? 'checked' : ''}>
      <span>${label}</span>
    </label>`;
}

function renderForm() {
  const item = current;
  const isAppointment = item.type === 'appointment';
  const timing = item.start_time ? 'timed' : 'allday';
  const duration = item.duration_min ?? 60;
  // se la durata salvata non è tra quelle proposte, la aggiungiamo alla lista
  const durationOptions = durations.includes(duration) ? durations : [...durations, duration].sort((a, b) => a - b);

  form.innerHTML = `
    <div class="sheet__head">
      <h2 class="sheet__title" id="item-editor-title">${isAppointment ? 'Appuntamento' : 'Task'}</h2>
      <button class="icon-btn" type="button" data-action="close" aria-label="Chiudi senza salvare">${icon('x')}</button>
    </div>

    ${item.parent_id ? parentLink() : ''}

    <div class="form-field">
      <label for="ed-title">Titolo</label>
      <input class="field" id="ed-title" name="title" type="text" maxlength="200" autocomplete="off" value="${escapeHtml(item.title)}">
    </div>

    <fieldset class="form-field">
      <legend>Tipo</legend>
      <div class="segmented">
        ${radio('type', 'task', 'Task', item.type)}
        ${radio('type', 'appointment', 'Appuntamento', item.type)}
      </div>
    </fieldset>

    <fieldset class="form-field">
      <legend>Area</legend>
      <div class="chip-group">
        ${areas.map((a) => `
          <label class="chip" ${areaAttrs(a)}>
            <input type="radio" name="area_id" value="${a.id}" ${a.id === item.area_id ? 'checked' : ''}>
            <span class="dot"></span>${escapeHtml(a.name)}
          </label>`).join('')}
      </div>
    </fieldset>

    <div class="form-field">
      <label for="ed-date">Giorno</label>
      <div class="field-row">
        <input class="field num" id="ed-date" name="scheduled_date" type="date" value="${item.scheduled_date ?? ''}">
        <button class="btn btn--sm" type="button" data-action="date-today">Oggi</button>
        <button class="btn btn--sm" type="button" data-action="date-tomorrow">Domani</button>
      </div>
      <p class="form-hint">Senza giorno resta in Da fare.</p>
    </div>

    <fieldset class="form-field">
      <legend>Orario</legend>
      <div class="segmented">
        ${radio('timing', 'allday', 'In giornata', timing)}
        ${radio('timing', 'timed', 'Con orario', timing)}
      </div>
      <div class="field-row" data-section="time-fields">
        <label class="field-inline">Inizio
          <input class="field num" name="start_time" type="time" value="${item.start_time ?? '09:00'}">
        </label>
        <label class="field-inline">Durata
          <select class="field" name="duration_min">
            ${durationOptions.map((d) => `<option value="${d}" ${d === duration ? 'selected' : ''}>${formatDuration(d)}</option>`).join('')}
          </select>
        </label>
      </div>
    </fieldset>

    <div class="form-field" data-section="location">
      <label for="ed-location">Luogo</label>
      <input class="field" id="ed-location" name="location" type="text" autocomplete="off" placeholder="Facoltativo" value="${escapeHtml(item.location ?? '')}">
    </div>

    ${goalField(item)}

    <fieldset class="form-field">
      <legend>Priorità</legend>
      <div class="segmented">
        ${priorities.map(([value, label]) => radio('priority', value, label, item.priority ?? '')).join('')}
      </div>
    </fieldset>

    <div class="form-field">
      <label for="ed-due">Scadenza</label>
      <input class="field num" id="ed-due" name="due_date" type="date" value="${item.due_date ?? ''}">
    </div>

    <div class="form-field">
      <label for="ed-notes">Note</label>
      <textarea class="field field--area" id="ed-notes" name="notes" rows="4" placeholder="Argomento, dettagli, link…">${escapeHtml(item.notes ?? '')}</textarea>
    </div>

    ${item.parent_id ? '' : '<section class="subitems" id="ed-subitems" aria-labelledby="ed-sub-title"></section>'}

    <p class="form-error" id="ed-error" role="alert"></p>

    <div class="sheet__footer">
      <button class="btn btn--ghost btn--danger" type="button" data-action="delete">${icon('trash')}Elimina</button>
      <button class="btn btn--primary" type="submit">Salva</button>
    </div>`;

  syncSections();
  if (!item.parent_id) renderSubItems();
}

// "Fa parte di un obiettivo": solo per gli elementi principali e se ci sono obiettivi in corso
function goalField(item) {
  const active = goals.filter((g) => !g.achieved_at || g.id === item.goal_id);
  if (item.parent_id || !active.length) return '';
  return `
    <div class="form-field">
      <label for="ed-goal">Obiettivo</label>
      <select class="field" id="ed-goal" name="goal_id">
        <option value="">Nessuno</option>
        ${active.map((g) => `<option value="${g.id}" ${g.id === item.goal_id ? 'selected' : ''}>${escapeHtml(g.title)}</option>`).join('')}
      </select>
    </div>`;
}

// Per un sotto-elemento: link per tornare al genitore
function parentLink() {
  const parent = items.find((i) => i.id === current.parent_id);
  if (!parent) return '';
  return `<p class="form-hint">Fa parte di
    <button class="link-btn" type="button" data-action="open-parent">${escapeHtml(parent.title)}</button></p>`;
}

// La sezione dei sotto-elementi si ridisegna da sola, senza toccare il resto del form:
// così le modifiche non ancora salvate ai campi non vanno perse.
function renderSubItems() {
  const section = form.querySelector('#ed-subitems');
  if (!section) return; // l'elemento aperto è a sua volta un sotto-elemento: niente sezione
  const children = items.filter((i) => i.parent_id === current.id);
  const doneCount = children.filter((c) => c.done).length;
  const draft = form.elements.new_sub?.value ?? ''; // non perdere quello che si sta scrivendo

  section.innerHTML = `
    <h3 class="subitems__title" id="ed-sub-title">Sotto-elementi
      ${children.length ? `<span class="num">${doneCount}/${children.length}</span>` : ''}</h3>
    ${children.length ? `<ul class="subitems__list">${children.map(subItemRow).join('')}</ul>` : ''}
    <div class="field-row">
      <input class="field" name="new_sub" type="text" autocomplete="off" maxlength="200"
             placeholder="${current.type === 'appointment' ? 'Cosa preparare, cosa portare…' : 'Aggiungi un passo'}"
             aria-label="Nuovo sotto-elemento">
      <button class="btn" type="button" data-action="add-sub">Aggiungi</button>
    </div>
    <p class="form-hint">I sotto-elementi si salvano subito. Toccane uno per dargli un orario.</p>`;
  form.elements.new_sub.value = draft;
}

function subItemRow(child) {
  const title = escapeHtml(child.title);
  const control = child.type === 'task'
    ? `<label class="check">
        <input type="checkbox" data-action="toggle-sub" ${child.done ? 'checked' : ''} aria-label="Fatto: ${title}">
        <span class="check__box">${icon('check')}</span>
      </label>`
    : `<span class="item__marker" title="Appuntamento">${icon('calendar')}</span>`;

  return `
    <li class="subitem ${child.done ? 'is-done' : ''}" data-id="${child.id}">
      ${control}
      <button class="subitem__title" type="button" data-action="open-sub">
        ${title}${child.start_time ? ` <span class="num">${child.start_time}</span>` : ''}
      </button>
      <button class="icon-btn" type="button" data-action="delete-sub" aria-label="Elimina ${title}">${icon('x')}</button>
    </li>`;
}

// Mostra/nasconde le parti del form che dipendono dal tipo e dall'orario
function syncSections() {
  const isAppointment = form.elements.type.value === 'appointment';
  const allDay = form.querySelector('input[name="timing"][value="allday"]');

  // Un appuntamento ha sempre un orario: "In giornata" non è possibile
  if (isAppointment) form.elements.timing.value = 'timed';
  allDay.disabled = isAppointment;

  form.querySelector('[data-section="time-fields"]').hidden = form.elements.timing.value !== 'timed';
  form.querySelector('[data-section="location"]').hidden = !isAppointment;
  form.querySelector('#item-editor-title').textContent = isAppointment ? 'Appuntamento' : 'Task';
}

// ---------- Salvataggio ----------

function readForm() {
  const data = new FormData(form);
  const type = data.get('type');
  const timed = data.get('timing') === 'timed';

  const startTime = timed ? data.get('start_time') || null : null; // "" -> null
  const changes = {
    title: data.get('title').trim(),
    type,
    area_id: data.get('area_id'),
    scheduled_date: data.get('scheduled_date') || null,
    start_time: startTime,
    // la durata ha senso solo con un orario d'inizio
    duration_min: startTime ? Number(data.get('duration_min')) : null,
    location: type === 'appointment' ? data.get('location').trim() || null : null,
    priority: data.get('priority') || null,
    // se il campo non c'è (sotto-elemento o nessun obiettivo) il collegamento resta com'era
    goal_id: form.elements.goal_id ? data.get('goal_id') || null : current.goal_id ?? null,
    due_date: data.get('due_date') || null,
    notes: data.get('notes').trim(),
  };
  // Un appuntamento non si "spunta" (vincolo nel database)
  if (type === 'appointment') {
    changes.done = false;
    changes.done_at = null;
  }
  return changes;
}

// Gli stessi controlli dei vincoli CHECK nel database, ma con un messaggio chiaro
function validate(changes) {
  if (!changes.title) return 'Scrivi un titolo.';
  if (!changes.area_id) return 'Scegli un\'area.';
  // prima i controlli degli appuntamenti: per loro "In giornata" non è una via d'uscita
  if (changes.type === 'appointment' && !changes.scheduled_date) return 'Un appuntamento ha bisogno di un giorno.';
  if (changes.type === 'appointment' && !changes.start_time) return 'Un appuntamento ha bisogno di un orario.';
  if (form.elements.timing.value === 'timed' && !changes.start_time) return 'Scegli l\'ora di inizio, oppure "In giornata".';
  if (changes.start_time && !changes.scheduled_date) return 'Per dare un orario scegli prima il giorno, oppure scegli "In giornata".';
  return '';
}

// Salva i campi. Restituisce true se è andato tutto bene.
async function save() {
  const errorEl = form.querySelector('#ed-error');
  const changes = readForm();
  const problem = validate(changes);
  if (problem) {
    errorEl.textContent = problem;
    return false;
  }

  errorEl.textContent = '';
  try {
    await updateItem(current, changes);
    return true;
  } catch (error) {
    errorEl.textContent = saveErrorMessage(error);
    return false;
  }
}

// ---------- Eventi (registrati una volta sola: il form resta, cambia solo il contenuto) ----------

export function initItemEditor() {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await save()) dialog.close();
  });

  form.addEventListener('change', (e) => {
    const { name } = e.target;
    if (name === 'type' || name === 'timing') syncSections();

    if (e.target.dataset.action === 'toggle-sub') {
      const child = items.find((i) => i.id === e.target.closest('[data-id]').dataset.id);
      const parentId = current.id;
      setDone(child, e.target.checked)
        .catch((error) => showToast(saveErrorMessage(error)))
        // nel frattempo si potrebbe aver aperto un altro elemento: ridisegniamo solo se è ancora lo stesso
        .finally(() => { if (current?.id === parentId) renderSubItems(); });
      renderSubItems();
      form.querySelector(`[data-id="${child.id}"] input`)?.focus();
    }
  });

  form.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const row = button.closest('[data-id]');

    if (action === 'close') dialog.close();
    if (action === 'date-today') form.elements.scheduled_date.value = todayISO();
    if (action === 'date-tomorrow') form.elements.scheduled_date.value = addDays(todayISO(), 1);

    if (action === 'delete') {
      const item = current;
      dialog.close();
      deleteWithUndo(item);
    }

    if (action === 'add-sub') addSubItem();

    if (action === 'delete-sub') {
      const child = items.find((i) => i.id === row.dataset.id);
      deleteWithUndo(child);
      renderSubItems();
      form.elements.new_sub.focus();
    }

    // Prima di passare a un altro elemento salviamo questo, così non si perdono modifiche
    if (action === 'open-sub' || action === 'open-parent') {
      const targetId = action === 'open-sub' ? row.dataset.id : current.parent_id;
      if (await save()) openEditor(targetId);
    }
  });

  // Invio nel campo "nuovo sotto-elemento" aggiunge il sotto-elemento invece di salvare tutto
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.name === 'new_sub') {
      e.preventDefault();
      addSubItem();
    }
  });

  // Dati cambiati da fuori (es. "Annulla" di un sotto-elemento eliminato): aggiorniamo la lista nel pannello
  document.addEventListener('agenda:changed', () => {
    if (dialog.open) renderSubItems();
  });

  // Chiusura in qualsiasi modo (X, Esc, Salva, sfondo): ridisegniamo la vista sotto
  dialog.addEventListener('close', () => notifyChange(current?.id));

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

async function addSubItem() {
  const input = form.elements.new_sub;
  const title = input.value.trim();
  if (!title) return;

  input.disabled = true;
  try {
    await createItem({ title, area_id: current.area_id, parent_id: current.id });
    input.value = ''; // prima di ridisegnare, così il testo non viene ripristinato
    renderSubItems();
  } catch {
    showToast('Sotto-elemento non salvato. Controlla la connessione e riprova.');
  } finally {
    // renderSubItems crea un input nuovo: il focus va sempre sul campo attuale
    form.elements.new_sub.disabled = false;
    form.elements.new_sub.focus();
  }
}

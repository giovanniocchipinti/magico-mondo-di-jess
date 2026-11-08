// Pannello di un obiettivo: crea o modifica, passi, "raggiunto", eliminazione.
// Stessa logica del pannello degli elementi: i campi si salvano con "Salva", i passi subito.

import { goals, items, areas, createGoal, updateGoal, deleteGoal, createItem, setDone } from './data/db.js';
import { icon } from './icons.js';
import { escapeHtml, areaAttrs, showToast, saveErrorMessage } from './ui.js';
import { openEditor, deleteWithUndo } from './item-editor.js';

const dialog = document.getElementById('goal-editor');
const form = document.getElementById('goal-form');
let current = null; // l'obiettivo aperto; null = obiettivo nuovo, non ancora salvato

function notifyChange() {
  document.dispatchEvent(new CustomEvent('agenda:changed', { detail: {} }));
}

// goalId null = nuovo obiettivo
export function openGoalEditor(goalId) {
  current = goalId ? goals.find((g) => g.id === goalId) : null;
  if (goalId && !current) return;
  renderForm();
  if (!dialog.open) dialog.showModal();
  form.elements.title.focus();
}

function radio(name, value, label, checkedValue) {
  return `
    <label class="segmented__option">
      <input type="radio" name="${name}" value="${value}" ${value === checkedValue ? 'checked' : ''}>
      <span>${label}</span>
    </label>`;
}

function renderForm() {
  const goal = current ?? { title: '', why: '', area_id: null, kind: 'steps', target_value: null, current_value: 0, unit: '', target_date: null };
  const isNew = !current;

  form.innerHTML = `
    <div class="sheet__head">
      <h2 class="sheet__title" id="goal-editor-title">${isNew ? 'Nuovo obiettivo' : 'Obiettivo'}</h2>
      <button class="icon-btn" type="button" data-action="close" aria-label="Chiudi senza salvare">${icon('x')}</button>
    </div>

    <div class="form-field">
      <label for="goal-title">Cosa vuoi raggiungere?</label>
      <input class="field" id="goal-title" name="title" type="text" maxlength="200" autocomplete="off"
             placeholder="Es. Rinnovare il sito del Casale" value="${escapeHtml(goal.title)}">
    </div>

    <div class="form-field">
      <label for="goal-why">Perché è importante per te?</label>
      <textarea class="field field--area" id="goal-why" name="why" rows="3"
                placeholder="Te lo ricorderemo quando serve un po' di spinta">${escapeHtml(goal.why)}</textarea>
    </div>

    <fieldset class="form-field">
      <legend>Area</legend>
      <div class="chip-group">
        <label class="chip"><input type="radio" name="area_id" value="" ${goal.area_id ? '' : 'checked'}>Tutta la vita</label>
        ${areas.map((a) => `
          <label class="chip" ${areaAttrs(a)}>
            <input type="radio" name="area_id" value="${a.id}" ${a.id === goal.area_id ? 'checked' : ''}>
            <span class="dot"></span>${escapeHtml(a.name)}
          </label>`).join('')}
      </div>
    </fieldset>

    <div class="form-field">
      <label for="goal-date">Entro quando?</label>
      <input class="field num" id="goal-date" name="target_date" type="date" value="${goal.target_date ?? ''}">
    </div>

    <fieldset class="form-field">
      <legend>Come lo misuri?</legend>
      <div class="segmented">
        ${radio('kind', 'steps', 'A passi', goal.kind)}
        ${radio('kind', 'number', 'Con un numero', goal.kind)}
      </div>
      <div class="field-row" data-section="number">
        <label class="field-inline">Traguardo
          <input class="field num" name="target_value" type="number" inputmode="decimal" min="0" step="any" value="${goal.target_value ?? ''}" placeholder="2000">
        </label>
        <label class="field-inline">A che punto sei
          <input class="field num" name="current_value" type="number" inputmode="decimal" step="any" value="${goal.current_value ?? 0}">
        </label>
        <label class="field-inline">Unità
          <input class="field" name="unit" type="text" maxlength="20" value="${escapeHtml(goal.unit ?? '')}" placeholder="€, libri, kg">
        </label>
      </div>
    </fieldset>

    ${isNew ? '' : '<section class="subitems" id="goal-steps" aria-labelledby="goal-steps-title"></section>'}

    <p class="form-error" id="goal-error" role="alert"></p>

    <div class="sheet__footer">
      ${isNew ? '<span></span>' : `
        <div class="sheet__footer-group">
          <button class="btn btn--ghost btn--danger" type="button" data-action="delete">${icon('trash')}Elimina</button>
          <button class="btn btn--ghost" type="button" data-action="achieve">
            ${current.achieved_at ? 'Riporta in corso' : `${icon('trophy')}Raggiunto`}
          </button>
        </div>`}
      <button class="btn btn--primary" type="submit">${isNew ? 'Crea obiettivo' : 'Salva'}</button>
    </div>`;

  syncKind();
  if (!isNew) renderSteps();
}

function syncKind() {
  form.querySelector('[data-section="number"]').hidden = form.elements.kind.value !== 'number';
}

// I passi sono normali elementi con goal_id: si ridisegna solo questa sezione
function renderSteps() {
  const section = form.querySelector('#goal-steps');
  if (!section) return;
  const steps = items.filter((i) => i.goal_id === current.id && !i.parent_id);
  const doneCount = steps.filter((s) => s.done).length;
  const draft = form.elements.new_step?.value ?? '';

  section.innerHTML = `
    <h3 class="subitems__title" id="goal-steps-title">Passi
      ${steps.length ? `<span class="num">${doneCount}/${steps.length}</span>` : ''}</h3>
    ${steps.length ? `<ul class="subitems__list">${steps.map((step) => {
      const title = escapeHtml(step.title);
      return `
        <li class="subitem ${step.done ? 'is-done' : ''}" data-id="${step.id}">
          <label class="check">
            <input type="checkbox" data-action="toggle-step" ${step.done ? 'checked' : ''} aria-label="Fatto: ${title}">
            <span class="check__box">${icon('check')}</span>
          </label>
          <button class="subitem__title" type="button" data-action="open-step">${title}</button>
          <button class="icon-btn" type="button" data-action="delete-step" aria-label="Elimina ${title}">${icon('x')}</button>
        </li>`;
    }).join('')}</ul>` : ''}
    <div class="field-row">
      <input class="field" name="new_step" type="text" autocomplete="off" maxlength="200"
             placeholder="Il prossimo passo concreto" aria-label="Nuovo passo">
      <button class="btn" type="button" data-action="add-step">Aggiungi</button>
    </div>
    <p class="form-hint">I passi si salvano subito e compaiono anche in Da fare e nei momenti liberi di Oggi.</p>`;
  form.elements.new_step.value = draft;
}

function readForm() {
  const data = new FormData(form);
  const kind = data.get('kind');
  const toNumber = (value) => (value === '' || value === null ? null : Number(value));
  return {
    title: data.get('title').trim(),
    why: data.get('why').trim(),
    area_id: data.get('area_id') || null,
    target_date: data.get('target_date') || null,
    kind,
    target_value: kind === 'number' ? toNumber(data.get('target_value')) : null,
    current_value: kind === 'number' ? toNumber(data.get('current_value')) ?? 0 : 0,
    unit: kind === 'number' ? data.get('unit').trim() || null : null,
  };
}

function validate(fields) {
  if (!fields.title) return 'Scrivi cosa vuoi raggiungere.';
  if (fields.kind === 'number' && !(fields.target_value > 0)) return 'Scrivi un traguardo maggiore di zero.';
  return '';
}

async function save() {
  const errorEl = form.querySelector('#goal-error');
  const fields = readForm();
  const problem = validate(fields);
  if (problem) {
    errorEl.textContent = problem;
    return false;
  }
  errorEl.textContent = '';
  try {
    if (current) await updateGoal(current, fields);
    else current = await createGoal(fields);
    return true;
  } catch (error) {
    errorEl.textContent = saveErrorMessage(error);
    return false;
  }
}

async function addStep() {
  const input = form.elements.new_step;
  const title = input.value.trim();
  if (!title) return;

  input.disabled = true;
  try {
    // l'area del passo: quella dell'obiettivo, oppure la prima area se l'obiettivo è "tutta la vita"
    await createItem({ title, area_id: current.area_id ?? areas[0].id, goal_id: current.id });
    input.value = '';
    renderSteps();
  } catch (error) {
    showToast(saveErrorMessage(error));
  } finally {
    form.elements.new_step.disabled = false;
    form.elements.new_step.focus();
  }
}

export function initGoalEditor() {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wasNew = !current;
    if (!(await save())) return;
    if (wasNew) {
      // appena creato: il pannello resta aperto per aggiungere subito i passi
      renderForm();
      if (current.kind === 'steps') form.elements.new_step.focus();
      showToast('Obiettivo creato. Aggiungi il primo passo.');
    } else {
      dialog.close();
    }
  });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'kind') syncKind();
    if (e.target.dataset.action === 'toggle-step') {
      const step = items.find((i) => i.id === e.target.closest('[data-id]').dataset.id);
      const goalId = current.id;
      setDone(step, e.target.checked)
        .catch((error) => showToast(saveErrorMessage(error)))
        .finally(() => { if (current?.id === goalId) renderSteps(); });
      renderSteps();
      form.querySelector(`[data-id="${step.id}"] input`)?.focus();
    }
  });

  form.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const row = button.closest('[data-id]');

    if (action === 'close') dialog.close();
    if (action === 'add-step') addStep();
    // il passo si apre nel pannello degli elementi, sopra a questo
    if (action === 'open-step') openEditor(row.dataset.id);
    if (action === 'delete-step') {
      deleteWithUndo(items.find((i) => i.id === row.dataset.id));
      form.elements.new_step.focus();
    }

    if (action === 'achieve') {
      const achieved = !current.achieved_at;
      if (!(await save())) return; // salviamo anche eventuali modifiche ai campi
      try {
        await updateGoal(current, { achieved_at: achieved ? new Date().toISOString() : null });
        dialog.close();
        showToast(achieved ? `Obiettivo raggiunto: ${current.title}` : 'Obiettivo di nuovo in corso.');
      } catch (error) {
        form.querySelector('#goal-error').textContent = saveErrorMessage(error);
      }
    }

    if (action === 'delete') {
      // conferma nativa: eliminare un obiettivo è raro e non si può annullare
      if (!confirm(`Eliminare l'obiettivo "${current.title}"? I suoi passi restano in Da fare.`)) return;
      try {
        await deleteGoal(current);
        dialog.close();
        showToast('Obiettivo eliminato.');
      } catch (error) {
        form.querySelector('#goal-error').textContent = saveErrorMessage(error);
      }
    }
  });

  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.name === 'new_step') {
      e.preventDefault();
      addStep();
    }
  });

  // Dati cambiati da fuori (passo modificato o eliminato nell'altro pannello): aggiorniamo i passi
  document.addEventListener('agenda:changed', () => {
    if (dialog.open && current) renderSteps();
  });

  dialog.addEventListener('close', notifyChange);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

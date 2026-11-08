// Vista Impostazioni: aree, orario di lavoro, giornata, categorie dei soldi, aspetto, account.
// Qui ogni modifica si salva subito (al cambio del campo), come nelle impostazioni del telefono.

import {
  areas, items, categories, workHours, settings, ensureCategories,
  createArea, updateArea, deleteArea, updateWorkHours, updateSettings,
  createCategory, updateCategory, deleteCategory,
} from '../data/db.js';
import { icon } from '../icons.js';
import { escapeHtml, areaAttrs, showToast, saveErrorMessage, flushToast } from '../ui.js';
import { themes, getTheme, setTheme } from '../theme.js';
import { supabase } from '../supabase.js';
import { signOut } from '../auth.js';

export const title = 'Impostazioni';

export function eyebrow() {
  return 'Il magico mondo di Jess';
}

// Tavolozza delle aree: 8 colori verificati con lo script della skill dataviz
// (si distinguono tra loro anche con il daltonismo e si leggono sul fondo chiaro)
const palette = [
  ['#0f8f84', 'verde-turchese'], ['#d0443c', 'rosso'], ['#2f6db0', 'blu'], ['#b07a12', 'senape'],
  ['#8e4b8e', 'prugna'], ['#5f7d1f', 'oliva'], ['#c2577f', 'rosa'], ['#5a55c8', 'indaco'],
];
const slots = [['work', 'In orario di lavoro'], ['free', 'Fuori orario'], ['any', 'Sempre']];
const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

let openAreaId = null; // area aperta nell'elenco (resta aperta dopo un ridisegno)

function refreshView() {
  document.dispatchEvent(new CustomEvent('agenda:changed', { detail: {} }));
}

// Esegue un salvataggio e, se fallisce, avvisa e ridisegna con i valori veri
function save(promise, message) {
  promise
    .then(() => { if (message) showToast(message); })
    .catch((error) => {
      const duplicate = error?.code === '23505'; // vincolo unique: nome già usato
      showToast(duplicate ? 'Esiste già un elemento con questo nome.' : saveErrorMessage(error));
      refreshView();
    });
}

// ---------- Sezioni ----------

function areaSection() {
  return `
    <section class="section" aria-labelledby="h-areas">
      <h2 class="section__head" id="h-areas">Aree</h2>
      <div class="settings-list">
        ${areas.map((area) => {
          const count = items.filter((i) => i.area_id === area.id).length;
          const others = areas.filter((a) => a.id !== area.id);
          return `
            <details class="settings-item" data-area-id="${area.id}" ${area.id === openAreaId ? 'open' : ''} ${areaAttrs(area)}>
              <summary><span class="dot"></span><span class="settings-item__name">${escapeHtml(area.name)}</span>
                <span class="settings-item__meta num">${count} ${count === 1 ? 'elemento' : 'elementi'}</span></summary>
              <div class="settings-item__body">
                <div class="form-field">
                  <label for="area-name-${area.id}">Nome</label>
                  <input class="field" id="area-name-${area.id}" data-field="area-name" maxlength="40" value="${escapeHtml(area.name)}">
                </div>
                <fieldset class="form-field">
                  <legend>Colore</legend>
                  <div class="swatches">
                    ${palette.map(([color, name]) => `
                      <label class="swatch-option" style="--sw: ${color}">
                        <input type="radio" name="color-${area.id}" data-field="area-color" value="${color}" ${color.toLowerCase() === area.color.toLowerCase() ? 'checked' : ''}>
                        <span class="visually-hidden">${name}</span>
                      </label>`).join('')}
                  </div>
                </fieldset>
                <div class="form-field">
                  <label for="area-slot-${area.id}">Quando ci lavori di solito</label>
                  <select class="field" id="area-slot-${area.id}" data-field="area-slot">
                    ${slots.map(([value, label]) => `<option value="${value}" ${value === area.slot ? 'selected' : ''}>${label}</option>`).join('')}
                  </select>
                  <p class="form-hint">Decide in quali momenti liberi di Oggi ti vengono proposte le cose di quest'area.</p>
                </div>
                ${others.length ? `
                  <div class="settings-danger">
                    ${count ? `
                      <label class="field-inline">Prima di eliminare, sposta i ${count} elementi in
                        <select class="field" data-field="move-to">
                          ${others.map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('')}
                        </select>
                      </label>` : ''}
                    <button class="btn btn--ghost btn--danger" type="button" data-action="delete-area">${icon('trash')}${count ? 'Sposta ed elimina' : 'Elimina area'}</button>
                  </div>` : '<p class="form-hint">Serve almeno un\'area: questa non si può eliminare.</p>'}
              </div>
            </details>`;
        }).join('')}
      </div>
      <button class="btn" type="button" data-action="add-area">${icon('plus')}Aggiungi area</button>
    </section>`;
}

function hoursSection() {
  return `
    <section class="section" aria-labelledby="h-hours">
      <h2 class="section__head" id="h-hours">Orario di lavoro</h2>
      <ul class="group hours">
        ${dayNames.map((name, i) => {
          const day = i + 1;
          const hours = workHours[day];
          return `
            <li class="hours__row" data-weekday="${day}">
              <label class="hours__day">
                <input type="checkbox" data-field="works" ${hours ? 'checked' : ''}>${name}
              </label>
              ${hours ? `
                <span class="hours__times">
                  <input class="field num" type="time" data-field="start" value="${hours.start}" aria-label="${name}, inizio">
                  <span aria-hidden="true">–</span>
                  <input class="field num" type="time" data-field="end" value="${hours.end}" aria-label="${name}, fine">
                </span>` : '<span class="hours__off">Libero</span>'}
            </li>`;
        }).join('')}
      </ul>
    </section>`;
}

function daySection() {
  return `
    <section class="section" aria-labelledby="h-day">
      <h2 class="section__head" id="h-day">La giornata</h2>
      <div class="field-row">
        <label class="field-inline">Fine della giornata
          <input class="field num" type="time" data-field="day_end" value="${settings.day_end}">
        </label>
        <label class="field-inline">Riepilogo del mattino
          <input class="field num" type="time" data-field="morning_summary" value="${settings.morning_summary}">
        </label>
      </div>
      <p class="form-hint">Fino alla fine della giornata Oggi ti propone cosa fare nei momenti liberi.
        Il riepilogo del mattino arriverà come notifica, quando le attiveremo.</p>
    </section>`;
}

function categorySection() {
  const list = (kind, label) => `
    <div class="form-field">
      <h3 class="subitems__title">${label}</h3>
      <ul class="subitems__list">
        ${categories.filter((c) => c.kind === kind).map((c) => `
          <li class="subitem" data-category-id="${c.id}">
            <input class="field field--inline" data-field="category-name" maxlength="40" value="${escapeHtml(c.name)}" aria-label="Nome della categoria">
            <button class="icon-btn" type="button" data-action="delete-category" aria-label="Elimina ${escapeHtml(c.name)}">${icon('x')}</button>
          </li>`).join('')}
      </ul>
      <div class="field-row">
        <input class="field" data-new-category="${kind}" maxlength="40" placeholder="Nuova categoria" aria-label="Nuova categoria di ${label.toLowerCase()}">
        <button class="btn" type="button" data-action="add-category" data-kind="${kind}">Aggiungi</button>
      </div>
    </div>`;
  return `
    <section class="section" aria-labelledby="h-cat-settings">
      <h2 class="section__head" id="h-cat-settings">Categorie dei soldi</h2>
      ${list('out', 'Uscite')}
      ${list('in', 'Entrate')}
      <p class="form-hint">Eliminando una categoria, i movimenti già registrati restano, senza categoria.</p>
    </section>`;
}

function themeSection() {
  const current = getTheme();
  return `
    <section class="section" aria-labelledby="h-theme">
      <h2 class="section__head" id="h-theme">Aspetto</h2>
      <div class="segmented" role="radiogroup" aria-labelledby="h-theme">
        ${themes.map((t) => `
          <label class="segmented__option">
            <input type="radio" name="theme" data-field="theme" value="${t.value}" ${t.value === current ? 'checked' : ''}>
            <span>${t.label}</span>
          </label>`).join('')}
      </div>
    </section>`;
}

function accountSection(email) {
  return `
    <section class="section" aria-labelledby="h-account">
      <h2 class="section__head" id="h-account">Account</h2>
      <p class="settings-email">${email ? `Sei entrata come <strong>${escapeHtml(email)}</strong>` : ''}</p>
      <div><button class="btn" type="button" data-action="logout">${icon('logOut')}Esci</button></div>
    </section>`;
}

// ---------- Disegno ed eventi ----------

export function render(container) {
  if (!categories.length) ensureCategories().then(() => { if (container.dataset.view === 'impostazioni') refreshView(); }).catch(() => {});

  container.innerHTML = `
    ${areaSection()}
    ${hoursSection()}
    ${daySection()}
    ${categorySection()}
    ${themeSection()}
    ${accountSection(null)}
  `;
  // l'email arriva dalla sessione salvata nel browser (nessuna richiesta in rete)
  supabase.auth.getSession().then(({ data }) => {
    const el = container.querySelector('.settings-email');
    if (el && data.session) el.innerHTML = `Sei entrata come <strong>${escapeHtml(data.session.user.email)}</strong>`;
  });

  // ricordiamo quale area è aperta, così un ridisegno non la richiude
  container.querySelectorAll('details[data-area-id]').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (details.open) openAreaId = details.dataset.areaId;
      else if (openAreaId === details.dataset.areaId) openAreaId = null;
    });
  });

  container.onchange = (e) => {
    const field = e.target.dataset.field;
    if (!field) return;
    const areaEl = e.target.closest('[data-area-id]');
    const area = areaEl && areas.find((a) => a.id === areaEl.dataset.areaId);

    if (field === 'area-name') {
      const name = e.target.value.trim();
      if (!name) { e.target.value = area.name; return; }
      areaEl.querySelector('.settings-item__name').textContent = name;
      save(updateArea(area, { name }), 'Nome dell\'area salvato.');
    }
    if (field === 'area-color') {
      areaEl.style.setProperty('--area', e.target.value);
      save(updateArea(area, { color: e.target.value }));
    }
    if (field === 'area-slot') save(updateArea(area, { slot: e.target.value }), 'Salvato.');

    // orario di lavoro: casella "lavoro" o orari di inizio/fine
    const row = e.target.closest('[data-weekday]');
    if (row) {
      const day = Number(row.dataset.weekday);
      if (field === 'works') {
        save(e.target.checked ? updateWorkHours(day, '09:00', '17:00') : updateWorkHours(day, null, null));
        refreshView(); // compaiono o spariscono gli orari
        // dopo il ridisegno il focus torna sulla stessa casella
        document.querySelector(`[data-weekday="${day}"] [data-field="works"]`)?.focus();
      } else {
        const start = row.querySelector('[data-field="start"]').value;
        const end = row.querySelector('[data-field="end"]').value;
        if (!start || !end || end <= start) {
          showToast('La fine deve essere dopo l\'inizio.');
          return;
        }
        save(updateWorkHours(day, start, end), 'Orario salvato.');
      }
    }

    if (field === 'day_end' || field === 'morning_summary') {
      if (e.target.value) save(updateSettings({ [field]: e.target.value }), 'Salvato.');
    }

    if (field === 'category-name') {
      const category = categories.find((c) => c.id === e.target.closest('[data-category-id]').dataset.categoryId);
      const name = e.target.value.trim();
      if (!name) { e.target.value = category.name; return; }
      save(updateCategory(category, { name }), 'Categoria salvata.');
    }

    if (field === 'theme') setTheme(e.target.value);
  };

  container.onclick = async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;

    if (action === 'add-area') {
      try {
        // un nome che non esiste ancora: "Nuova area", "Nuova area 2"...
        let name = 'Nuova area';
        for (let n = 2; areas.some((a) => a.name === name); n++) name = `Nuova area ${n}`;
        const color = palette.find(([c]) => !areas.some((a) => a.color.toLowerCase() === c))?.[0] ?? palette[0][0];
        const area = await createArea({ name, color, face: 'personal', slot: 'any' });
        openAreaId = area.id;
        refreshView();
        document.getElementById(`area-name-${area.id}`)?.select();
      } catch (error) {
        showToast(saveErrorMessage(error));
      }
    }

    if (action === 'delete-area') {
      const areaEl = button.closest('[data-area-id]');
      const area = areas.find((a) => a.id === areaEl.dataset.areaId);
      const moveTo = areaEl.querySelector('[data-field="move-to"]')?.value ?? null;
      const target = moveTo && areas.find((a) => a.id === moveTo);
      const question = target
        ? `Spostare gli elementi in "${target.name}" ed eliminare l'area "${area.name}"?`
        : `Eliminare l'area "${area.name}"?`;
      if (!confirm(question)) return;
      try {
        await deleteArea(area, moveTo);
        showToast(`Area "${area.name}" eliminata.`);
        refreshView();
      } catch (error) {
        showToast(saveErrorMessage(error));
      }
    }

    if (action === 'add-category') {
      const input = container.querySelector(`[data-new-category="${button.dataset.kind}"]`);
      const name = input.value.trim();
      if (!name) return input.focus();
      try {
        await createCategory({ name, kind: button.dataset.kind });
        refreshView();
        document.querySelector(`[data-new-category="${button.dataset.kind}"]`)?.focus();
      } catch (error) {
        showToast(error?.code === '23505' ? 'Esiste già una categoria con questo nome.' : saveErrorMessage(error));
      }
    }

    if (action === 'delete-category') {
      const category = categories.find((c) => c.id === button.closest('[data-category-id]').dataset.categoryId);
      if (!confirm(`Eliminare la categoria "${category.name}"? I movimenti restano, senza categoria.`)) return;
      try {
        await deleteCategory(category);
        refreshView();
      } catch (error) {
        showToast(saveErrorMessage(error));
      }
    }

    if (action === 'logout') {
      // un'eliminazione in attesa di "Annulla" va inviata ora, finché la sessione è valida
      flushToast();
      await signOut();
    }
  };

  // Invio nel campo "nuova categoria" = Aggiungi
  container.onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.dataset.newCategory) {
      e.preventDefault();
      container.querySelector(`[data-action="add-category"][data-kind="${e.target.dataset.newCategory}"]`).click();
    }
  };
}

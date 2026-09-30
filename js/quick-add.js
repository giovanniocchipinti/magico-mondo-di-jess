// Aggiunta rapida: scrivi il titolo e l'elemento va in "Da pianificare",
// oppure in "Oggi" se sei nella vista Oggi.
// Fase 1: salva solo in memoria (ricaricando la pagina sparisce). Dalla Fase 3 salverà su Supabase.

import { areas, items, makeItem } from './data/fake-data.js';
import { currentRoute, refresh } from './router.js';
import { areaAttrs, escapeHtml } from './ui.js';
import { todayISO } from './dates.js';

export function initQuickAdd() {
  const dialog = document.getElementById('quick-add');
  const form = document.getElementById('quick-add-form');
  const input = document.getElementById('quick-add-input');
  const hint = document.getElementById('quick-add-hint');
  const areaGroup = document.getElementById('quick-add-areas');

  // Chip delle aree: sono dei radio button con l'aspetto di chip
  areaGroup.insertAdjacentHTML('beforeend', areas.map((area, i) => `
    <label class="chip" ${areaAttrs(area)}>
      <input type="radio" name="area" value="${area.id}" ${i === 0 ? 'checked' : ''}>
      <span class="dot"></span>${escapeHtml(area.name)}
    </label>`).join(''));

  function open() {
    hint.textContent = currentRoute() === 'oggi'
      ? 'Verrà aggiunta a Oggi, senza orario.'
      : 'Finirà in Da pianificare.';
    form.reset();
    dialog.showModal();
    input.focus();
  }

  document.getElementById('fab').addEventListener('click', open);

  // Scorciatoia da tastiera: "n" apre l'aggiunta rapida (se non stai già scrivendo in un campo)
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, select, [contenteditable]');
    if (e.key === 'n' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && !dialog.open) {
      e.preventDefault();
      open();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) return;

    items.push(makeItem({
      title,
      area_id: form.elements.area.value,
      scheduled_date: currentRoute() === 'oggi' ? todayISO() : null,
    }));

    dialog.close();
    refresh();
  });

  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());

  // Clic sullo sfondo scuro (fuori dal pannello) = chiudi
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

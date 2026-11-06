// Aggiunta rapida: scrivi il titolo e l'elemento va in "Da pianificare",
// oppure in "Oggi" se sei nella vista Oggi. Viene salvato su Supabase.

import { areas, createItem } from './data/db.js';
import { currentRoute, refresh } from './router.js';
import { areaAttrs, escapeHtml, showToast } from './ui.js';
import { openEditor } from './item-editor.js';
import { todayISO } from './dates.js';

export function initQuickAdd() {
  const dialog = document.getElementById('quick-add');
  const form = document.getElementById('quick-add-form');
  const input = document.getElementById('quick-add-input');
  const hint = document.getElementById('quick-add-hint');
  const areaGroup = document.getElementById('quick-add-areas');
  const submit = form.querySelector('[type="submit"]');

  function open() {
    // Le chip delle aree si ricostruiscono a ogni apertura: le aree possono cambiare
    areaGroup.innerHTML = '<legend class="visually-hidden">Area</legend>' + areas.map((area, i) => `
      <label class="chip" ${areaAttrs(area)}>
        <input type="radio" name="area" value="${area.id}" ${i === 0 ? 'checked' : ''}>
        <span class="dot"></span>${escapeHtml(area.name)}
      </label>`).join('');

    hint.textContent = currentRoute() === 'oggi'
      ? 'Verrà aggiunta a Oggi, senza orario.'
      : 'Finirà in Da pianificare.';
    hint.classList.remove('is-error');
    input.value = '';
    dialog.showModal();
    input.focus();
  }

  document.getElementById('fab').addEventListener('click', open);

  // Scorciatoia da tastiera: "n" apre l'aggiunta rapida (se non stai già scrivendo in un campo)
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, select, [contenteditable]');
    const appVisible = !document.getElementById('fab').hidden;
    if (e.key === 'n' && appVisible && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && !dialog.open) {
      e.preventDefault();
      open();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) return;

    // Disattiviamo il pulsante mentre salviamo: evita doppi invii con due tocchi veloci
    submit.disabled = true;
    try {
      const item = await createItem({
        title,
        area_id: form.elements.area.value,
        scheduled_date: currentRoute() === 'oggi' ? todayISO() : null,
      });
      dialog.close();
      refresh();
      showToast(`Aggiunta: ${title}`, { actionLabel: 'Aggiungi dettagli', onAction: () => openEditor(item.id) });
    } catch {
      // Il pannello resta aperto con il testo scritto: si può riprovare senza riscrivere
      hint.textContent = 'Non salvata. Controlla la connessione e premi di nuovo Aggiungi.';
      hint.classList.add('is-error');
    } finally {
      submit.disabled = false;
    }
  });

  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());

  // Clic sullo sfondo scuro (fuori dal pannello) = chiudi
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

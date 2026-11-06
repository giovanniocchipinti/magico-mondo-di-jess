// Pagina di prova del design system (#componenti). Non è nel menu: serve solo in sviluppo.

import { areas } from '../data/db.js';
import { icon } from '../icons.js';
import { itemRow, areaAttrs, escapeHtml } from '../ui.js';
import { todayISO } from '../dates.js';

export const title = 'Componenti';

export function eyebrow() {
  return 'Design system';
}

// Elemento di esempio (non salvato), con le aree vere dell'utente
function sample(areaIndex, fields) {
  return {
    id: `demo-${areaIndex}-${fields.title}`, type: 'task', area_id: areas[areaIndex]?.id,
    start_time: null, duration_min: null, location: null, priority: null, due_date: null, done: false,
    ...fields,
  };
}

export function render(container) {
  const today = todayISO();
  const samples = [
    sample(0, { title: 'Task normale' }),
    sample(1, { title: 'Task con priorità alta e scadenza', priority: 'high', due_date: today }),
    sample(2, { title: 'Task completata', done: true }),
    sample(1, { type: 'appointment', title: 'Appuntamento con orario e luogo', start_time: '16:30', duration_min: 45, location: 'Google Meet' }),
  ];

  container.innerHTML = `
    <section class="section">
      <h2 class="section__head">Colori delle aree</h2>
      <div class="demo-row">
        ${areas.map((a) => `<span class="swatch" ${areaAttrs(a)}><span style="--sw: var(--area-c)"></span>${escapeHtml(a.name)}</span>`).join('')}
      </div>
    </section>

    <section class="section">
      <h2 class="section__head">Tipografia</h2>
      <p style="font-size: var(--fs-2xl); font-weight: 700">Titolo vista 28</p>
      <p style="font-size: var(--fs-lg); font-weight: 600">Titolo elemento 18</p>
      <p>Testo base 16, Plus Jakarta Sans</p>
      <p style="font-size: var(--fs-sm); color: var(--text-3)">Meta 14, colore terziario</p>
      <p class="num" style="font-size: var(--fs-xl); font-weight: 700">07:00 11:11 15:30 (Manrope, cifre tabulari)</p>
    </section>

    <section class="section">
      <h2 class="section__head">Pulsanti</h2>
      <div class="demo-row">
        <button class="btn btn--primary" type="button">${icon('plus')}Primario</button>
        <button class="btn" type="button">Secondario</button>
        <button class="btn btn--ghost" type="button">Ghost</button>
        <button class="btn btn--sm" type="button">${icon('sun')}Piccolo</button>
        <button class="icon-btn" type="button" aria-label="Icona">${icon('calendar')}</button>
      </div>
    </section>

    <section class="section">
      <h2 class="section__head">Chip (filtri)</h2>
      <div class="chip-group">
        ${areas.map((a, i) => `<button class="chip" type="button" aria-pressed="${i === 0}" ${areaAttrs(a)}><span class="dot"></span>${escapeHtml(a.name)}</button>`).join('')}
      </div>
    </section>

    <section class="section">
      <h2 class="section__head">Campo di testo</h2>
      <label class="visually-hidden" for="demo-field">Esempio</label>
      <input class="field" id="demo-field" placeholder="Cosa devi fare?">
    </section>

    <section class="section">
      <h2 class="section__head">Righe elenco</h2>
      <ul class="group">
        ${samples.map((s) => itemRow(s, { showTime: true })).join('')}
      </ul>
    </section>

    <section class="section slot--work">
      <h2 class="section__head">${icon('briefcase')}Fascia lavoro<span class="section__range num">07:00–15:00</span></h2>
      <ul class="group">
        ${itemRow(samples[0])}
        <li class="now-line"><span class="num">10:42</span></li>
        ${itemRow(samples[1])}
      </ul>
    </section>
  `;

  // Nella demo i chip filtro si accendono e spengono
  container.onclick = (e) => {
    const chip = e.target.closest('button.chip');
    if (chip) chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') !== 'true');
  };
}

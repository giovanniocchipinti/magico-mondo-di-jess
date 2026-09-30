// Vista Settimana: segnaposto. La griglia a ore con drag & drop arriva nella Fase 5.

import { todayISO, startOfWeek, addDays, formatDayShort } from '../dates.js';

export const title = 'Settimana';

export function eyebrow() {
  const monday = startOfWeek(todayISO());
  return `${formatDayShort(monday)} – ${formatDayShort(addDays(monday, 6))}`;
}

export function render(container) {
  container.innerHTML = `
    <div class="placeholder">
      <p>Griglia a ore con i 7 giorni</p>
      <p>Arriva nella Fase 5, con drag &amp; drop.</p>
    </div>`;
}

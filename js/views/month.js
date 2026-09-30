// Vista Mese: segnaposto. Arriva nella Fase 6.

import { todayISO, formatMonth } from '../dates.js';

export const title = 'Mese';

export function eyebrow() {
  const month = formatMonth(todayISO());
  return month.charAt(0).toUpperCase() + month.slice(1);
}

export function render(container) {
  container.innerHTML = `
    <div class="placeholder">
      <p>Panoramica del mese con indicatori per area</p>
      <p>Arriva nella Fase 6.</p>
    </div>`;
}

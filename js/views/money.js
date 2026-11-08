// Vista Soldi: segnaposto. Entrate, uscite e scadenze dei pagamenti arrivano nella prossima tappa.

export const title = 'Soldi';

export function eyebrow() {
  return 'Entrate, uscite e scadenze';
}

export function render(container) {
  container.innerHTML = `
    <div class="placeholder">
      <p>Qui terrai sotto controllo entrate, uscite e pagamenti in scadenza</p>
      <p>Arriva nella prossima tappa.</p>
    </div>`;
}

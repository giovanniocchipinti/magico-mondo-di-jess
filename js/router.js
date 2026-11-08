// Mini router basato sull'hash dell'URL (#oggi, #calendario, ...).
// Con l'hash il browser non chiede mai una nuova pagina al server:
// perfetto per GitHub Pages, che non sa gestire indirizzi come /settimana.

import * as oggi from './views/today.js';
import * as calendario from './views/calendar.js';
import * as inbox from './views/inbox.js';
import * as obiettivi from './views/goals.js';
import * as soldi from './views/money.js';
import * as componenti from './views/components.js';
import * as impostazioni from './views/settings.js';

const routes = { oggi, calendario, inbox, obiettivi, soldi, impostazioni, componenti };
const defaultRoute = 'oggi';

let current = defaultRoute;
let renderView = null;

export function currentRoute() {
  return current;
}

// renderView(nome, modulo, { isNavigation }) viene chiamata a ogni cambio di vista
export function initRouter(onRender) {
  renderView = onRender;

  window.addEventListener('hashchange', () => {
    current = routeFromHash();
    renderView(current, routes[current], { isNavigation: true });
  });

  current = routeFromHash();
  renderView(current, routes[current], { isNavigation: false });
}

// Ridisegna la vista corrente (es. dopo un'aggiunta rapida)
export function refresh() {
  renderView(current, routes[current], { isNavigation: false });
}

function routeFromHash() {
  const name = location.hash.slice(1);
  // Object.hasOwn e non "in": "in" troverebbe anche chiavi ereditate come #toString
  return Object.hasOwn(routes, name) ? name : defaultRoute;
}

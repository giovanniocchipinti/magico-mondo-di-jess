// Punto di partenza dell'app

import { fillIcons, icon } from './icons.js';
import { initRouter } from './router.js';
import { initQuickAdd } from './quick-add.js';

const main = document.getElementById('main');
const titleEl = document.getElementById('view-title');
const eyebrowEl = document.getElementById('view-eyebrow');

function renderView(name, view, { isNavigation }) {
  titleEl.textContent = view.title;
  eyebrowEl.textContent = view.eyebrow?.() ?? '';
  document.title = `${view.title} · Agenda`;

  // Ogni vista imposta i suoi gestori con main.onclick = ...: qui li azzeriamo
  // così quelli della vista precedente non restano attivi
  main.onclick = null;
  main.onchange = null;
  view.render(main);

  // Evidenzia la voce attiva nella navigazione (aria-current è letto anche dagli screen reader)
  document.querySelectorAll('.nav__link').forEach((link) => {
    if (link.dataset.route === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  // Cambiando vista, porta il focus sul titolo: chi usa tastiera o screen reader sa dove si trova
  if (isNavigation) {
    window.scrollTo(0, 0);
    titleEl.focus();
  }
}

// ---------- Tema: automatico -> chiaro -> scuro ----------
const themes = [
  { value: null, label: 'automatico', icon: 'monitor' },
  { value: 'light', label: 'chiaro', icon: 'sun' },
  { value: 'dark', label: 'scuro', icon: 'moon' },
];

function initTheme() {
  const button = document.getElementById('theme-toggle');

  function show() {
    const saved = document.documentElement.dataset.theme ?? null;
    const theme = themes.find((t) => t.value === saved) ?? themes[0];
    button.innerHTML = icon(theme.icon);
    button.setAttribute('aria-label', `Tema: ${theme.label}. Cambia tema`);
    button.title = `Tema ${theme.label}`;
  }

  button.addEventListener('click', () => {
    const saved = document.documentElement.dataset.theme ?? null;
    const index = themes.findIndex((t) => t.value === saved);
    const next = themes[(index + 1) % themes.length];

    if (next.value) document.documentElement.dataset.theme = next.value;
    else delete document.documentElement.dataset.theme;

    // localStorage può non essere disponibile (es. navigazione privata): lo ignoriamo
    try {
      if (next.value) localStorage.setItem('tema', next.value);
      else localStorage.removeItem('tema');
    } catch (e) {}

    show();
  });

  show();
}

fillIcons();
initTheme();
initQuickAdd();
initRouter(renderView);

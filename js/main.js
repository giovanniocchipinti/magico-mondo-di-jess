// Punto di partenza dell'app

import { fillIcons } from './icons.js';
import { initRouter, refresh } from './router.js';
import { initQuickAdd } from './quick-add.js';
import { initItemEditor } from './item-editor.js';
import { initGoalEditor } from './goal-editor.js';
import { initMoneyEditor } from './money-editor.js';
import { initToast } from './ui.js';
import { initAvatar, clearAvatar, initAvatarPicker } from './avatar.js';
import { isConfigured } from './supabase.js';
import { onAuthChange, signIn, signUp } from './auth.js';
import { loadAll, ensureDefaults, clearData } from './data/db.js';

const main = document.getElementById('main');
const titleEl = document.getElementById('view-title');
const eyebrowEl = document.getElementById('view-eyebrow');

function renderView(name, view, { isNavigation }) {
  // una vista può avere un titolo grande diverso dal nome nel menu (es. Oggi: "Buongiorno, Jess")
  titleEl.textContent = view.heading?.() ?? view.title;
  document.getElementById('topbar-avatar').hidden = name !== 'oggi';
  eyebrowEl.textContent = view.eyebrow?.() ?? '';
  document.title = `${view.title} · Jess`;

  // Ogni vista imposta i suoi gestori con main.onclick = ...: qui li azzeriamo
  // così quelli della vista precedente non restano attivi
  main.onclick = null;
  main.onchange = null;
  main.onkeydown = null;
  main.dataset.view = name; // la vista Oggi lo usa per sapere se è ancora quella visibile
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


// ---------- Login / app: si mostra una delle due ----------
const loginEl = document.getElementById('login');
const appEl = document.getElementById('app');
const fab = document.getElementById('fab');
let routerStarted = false;
let currentUserId = null;

function showLogin() {
  appEl.hidden = true;
  fab.hidden = true;
  loginEl.hidden = false;
}

async function showApp(userId) {
  // onAuthChange scatta anche quando la sessione si rinnova: se l'utente è lo stesso non ricarichiamo
  if (userId === currentUserId) return;
  currentUserId = userId;

  loginEl.hidden = true;
  appEl.hidden = false;
  fab.hidden = false;
  main.innerHTML = '<p class="empty">Caricamento…</p>';

  try {
    await loadAll();
    await ensureDefaults(); // solo al primo accesso crea aree e orario di lavoro
  } catch (error) {
    main.innerHTML = '<p class="empty">Impossibile caricare i dati. Controlla la connessione e ricarica la pagina.</p>';
    console.error(error);
    return;
  }

  // Il router va avviato una volta sola (aggiunge un listener): ai login successivi basta ridisegnare
  if (routerStarted) refresh();
  else {
    initRouter(renderView);
    routerStarted = true;
  }
}

function initLoginForm() {
  const form = document.getElementById('login-form');
  const message = document.getElementById('login-message');
  const submit = document.getElementById('login-submit');
  const switchButton = document.getElementById('login-switch');
  const password = document.getElementById('login-password');
  let mode = 'signin'; // 'signin' = accedi, 'signup' = crea account

  switchButton.addEventListener('click', () => {
    mode = mode === 'signin' ? 'signup' : 'signin';
    submit.textContent = mode === 'signin' ? 'Accedi' : 'Crea account';
    switchButton.textContent = mode === 'signin' ? 'Prima volta? Crea l\'account' : 'Hai già un account? Accedi';
    // aiuta il gestore password del browser a proporre una password nuova
    password.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
    message.textContent = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    const pass = password.value;

    if (!email || !form.elements.email.checkValidity()) {
      message.textContent = 'Scrivi un indirizzo email valido.';
      return;
    }
    if (pass.length < 8) {
      message.textContent = 'La password deve avere almeno 8 caratteri.';
      return;
    }

    submit.disabled = true;
    message.textContent = '';
    try {
      if (mode === 'signin') {
        await signIn(email, pass); // se va bene, ci pensa onAuthChange a mostrare l'app
      } else {
        const { needsConfirmation } = await signUp(email, pass);
        if (needsConfirmation) {
          message.textContent = `Account creato. Apri l'email che abbiamo mandato a ${email} e clicca il link di conferma.`;
        }
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
}

// Service worker: copia dei file sul telefono (vedi sw.js). Funziona solo su https o localhost.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Service worker non registrato', error));
}

fillIcons();

if (!isConfigured) {
  // Senza config.js compilato mostriamo solo le istruzioni
  showLogin();
  document.getElementById('login-config').hidden = false;
  document.getElementById('login-form').hidden = true;
} else {
  initLoginForm();
  initQuickAdd();
  initItemEditor();
  initGoalEditor();
  initMoneyEditor();
  initToast();
  initAvatarPicker();

  // Il pannello di dettaglio avvisa quando i dati cambiano: ridisegniamo la vista
  // e rimettiamo il focus sull'elemento appena modificato (se è ancora visibile)
  document.addEventListener('agenda:changed', (e) => {
    if (appEl.hidden) return;
    refresh();
    const id = e.detail.focusId;
    if (id) main.querySelector(`[data-id="${id}"] [data-action="open"]`)?.focus();
  });


  onAuthChange((session) => {
    if (session) {
      showApp(session.user.id);
      initAvatar(session.user.id);
    } else {
      currentUserId = null;
      clearData();
      clearAvatar();
      main.innerHTML = '';
      showLogin();
    }
  });
}

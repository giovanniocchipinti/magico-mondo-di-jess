// Tutorial: la prima volta che Jess apre una schermata, l'app le mostra a cosa serve ogni cosa.
// Usa Driver.js (libreria leggera): oscura lo schermo e mette un fumetto accanto all'elemento.
// I tutorial già visti sono salvati nelle impostazioni (settings.tour_seen), quindi valgono su ogni dispositivo.

import { driver } from 'https://cdn.jsdelivr.net/npm/driver.js@1.11.0/+esm';
import { settings, updateSettings } from './data/db.js';

let active = null; // il tour in corso, oppure null

// Vero mentre un tutorial è aperto: la vista non va ridisegnata (sparirebbe l'elemento evidenziato)
export function isTourActive() {
  return Boolean(active);
}

// Primo elemento visibile tra i selettori: se non c'è, il passo viene saltato
function find(...selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    // visibile = occupa spazio sullo schermo (offsetParent non va bene: è null per gli elementi "fixed")
    if (el && el.getClientRects().length > 0) return el;
  }
  return null;
}

// Un passo legato a un elemento della pagina (se l'elemento non c'è, il passo viene saltato)
const step = (element, title, description) => ({ element, popover: { title, description } });
// Un passo senza elemento: fumetto al centro dello schermo
const centered = (title, description) => ({ center: true, popover: { title, description } });

// ---------- I testi, schermata per schermata ----------
// Ogni funzione restituisce i passi: è una funzione perché gli elementi vanno cercati
// nella pagina nel momento in cui il tutorial parte.
const tours = {
  oggi: () => [
    centered('Benvenuta nel tuo magico mondo, Jess!',
      'Qui stanno impegni, cose da fare, obiettivi e perfino i soldi. Ti faccio fare un giro veloce: promesso, niente quiz alla fine.'),
    step(find('#topbar-avatar'), 'Ehi, qui manca qualcuno!',
      'Tocca il cerchio e metti una tua foto. Così ogni mattina ti saluta la persona più importante dell\'app.'),
    step(find('.now-card'), 'Adesso e dopo',
      'Cosa stai facendo e cosa ti aspetta. Se c\'è scritto "Nessun impegno in corso", goditela finché dura.'),
    step(find('.situation'), 'Il punto della situazione',
      'Quante cose hai fatto oggi e in settimana, e come vanno i tuoi obiettivi. Niente giudizi: solo numeri che fanno il tifo per te.'),
    step(find('.gap'), 'I momenti liberi',
      'Quando hai un buco nella giornata ti suggerisco cosa farci, partendo dai tuoi obiettivi. Premi "Metti qui" e il gioco è fatto.'),
    step(find('#fab'), 'Il pulsante magico',
      'Ti è venuta in mente una cosa? Toccalo, scrivi due parole e via. Ai dettagli ci pensi con calma.'),
    step(find('.nav'), 'Il resto del regno',
      'Da qui vai al Calendario, alle cose Da fare, agli Obiettivi e ai Soldi. Ogni posto ha il suo mini tour la prima volta che ci entri.'),
  ],

  calendario: () => [
    step(find('[data-tab="settimana"]')?.parentElement ?? null, 'Settimana o mese?',
      'Scegli quanto lontano vuoi guardare. Il futuro, in due comodi formati.'),
    step(find('.week__grid', '.month'), 'Sposta tutto con un dito',
      'Tieni premuto un impegno per mezzo secondo e trascinalo dove vuoi. Tira il bordo in basso per allungarlo: magari fosse così facile anche con le giornate vere.'),
    step(find('.week__col.is-today', '.week__col'), 'Spazio vuoto? Riempilo',
      'Tocca un punto libero della griglia e aggiungi un impegno proprio a quell\'ora.'),
  ],

  inbox: () => [
    centered('Il parcheggio delle idee',
      'Qui finisce tutto quello che vuoi fare ma non sai ancora quando. Nessuna fretta: le cose aspettano tranquille.'),
    step(find('.filters'), 'Un po\' di ordine',
      'Mostra solo il Casale, solo la vita privata o solo le cose urgenti. Il caos lo lasciamo fuori.'),
    step(find('[data-action="plan"]'), 'Pianifica',
      'Quando decidi il giorno, premi qui: la cosa lascia il parcheggio e va in calendario.'),
  ],

  obiettivi: () => [
    step(find('[data-action="new-goal"]'), 'Sogna in grande (ma a passi)',
      'Crea un obiettivo, scrivi perché ci tieni e dividilo in passi piccoli piccoli. Anche le montagne si scalano un sasso alla volta.'),
    step(find('.goal-list', '.placeholder'), 'Te li ricordo io',
      'I passi dei tuoi obiettivi spuntano nei momenti liberi della giornata. Tu devi solo dire: "ok, lo faccio".'),
  ],

  soldi: () => [
    step(find('.money-summary'), 'Entrate, uscite, saldo',
      'Il riassunto del mese. Se il saldo diventa rosso... facciamo finta di niente e guardiamo i grafici.'),
    step(find('#fab'), 'Ogni spesa conta',
      'In questa pagina il + registra un movimento. Anche il caffè. Soprattutto il caffè.'),
    step(find('.archive'), 'Bollette e affitto sotto controllo',
      'Imposta qui i pagamenti che si ripetono: ti avviso quando scadono e con "Pagato" li segni in un attimo.'),
  ],

  impostazioni: () => [
    step(find('#h-areas')?.closest('section') ?? null, 'Le tue aree',
      'Lavoro al Casale, vita privata e tutto quello che vuoi aggiungere: nomi, colori e quando te ne occupi.'),
    step(find('#h-hours')?.closest('section') ?? null, 'Il tuo orario',
      'Dimmi quando lavori, così so quando proporti le cose del Casale e quando quelle di casa.'),
    step(find('[data-action="restart-tour"]'), 'Hai perso un pezzo?',
      'Da qui puoi rivedere tutti i tutorial quando vuoi. Senza vergogna.'),
  ],
};

// Segna il tutorial come visto (nel database). Se il salvataggio fallisce pazienza: ricomparirà.
function markSeen(name) {
  if (settings.tour_seen.includes(name)) return;
  updateSettings({ tour_seen: [...settings.tour_seen, name] }).catch(() => {});
}

// Fa partire il tutorial di una schermata, se non è già stato visto
export function maybeStartTour(name) {
  if (!tours[name] || active || settings.tour_seen.includes(name)) return;

  // aspettiamo un attimo: la pagina deve essere disegnata (e i font caricati) per misurare gli elementi
  setTimeout(() => {
    const current = location.hash.slice(1) || 'oggi';
    if (active || current !== name) return; // nel frattempo si è cambiata schermata
    if (document.querySelector('dialog[open]')) return; // un pannello aperto: niente tutorial ora

    // i passi con un elemento che non c'è (es. nessun momento libero oggi) vengono saltati
    const steps = tours[name]()
      .filter((s) => s.center || s.element)
      .map((s) => (s.center ? { popover: s.popover } : s));
    if (!steps.length) return;

    active = driver({
      steps,
      showProgress: steps.length > 1,
      progressText: '{{current}} di {{total}}',
      nextBtnText: 'Avanti',
      prevBtnText: 'Indietro',
      doneBtnText: 'Ho capito!',
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 12,
      popoverClass: 'tour-popover',
      onDestroyed: () => {
        active = null;
        markSeen(name);
      },
    });
    active.drive();
  }, 400);
}

// "Rivedi il tutorial" dalle Impostazioni: azzera i tutorial visti
export async function resetTours() {
  await updateSettings({ tour_seen: [] });
}

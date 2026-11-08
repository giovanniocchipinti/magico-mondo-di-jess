// Trascinamento nella vista Settimana, fatto a mano con i Pointer Events.
//
// I Pointer Events sono gli stessi per mouse, dito e penna: pointerdown, pointermove, pointerup.
// Tre gesti:
//   - spostare un blocco (cambia giorno e ora)
//   - tirare il bordo in basso di un blocco (cambia la durata)
//   - trascinare una cosa da fare dalla lista "Da fare" sul calendario (la pianifica)
//
// Col mouse il gesto parte appena ci si muove. Col dito parte dopo una pressione lunga:
// prima di allora il dito deve poter scorrere la pagina normalmente.

const LONG_PRESS = 450;   // millisecondi di pressione per iniziare col dito
const TOLERANCE = 8;      // pixel di movimento oltre i quali, col dito, è uno scorrimento
const SNAP = 15;          // gli orari si agganciano ai quarti d'ora

let config = null;        // { root, start, end, hourHeight, onDrop } della vista disegnata adesso
let state = null;         // il gesto in corso, oppure null
let justDragged = false;  // per ignorare il "click" che il browser manda subito dopo un trascinamento

// La vista Settimana la chiama a ogni disegno: aggiorna la griglia su cui lavorare
export function enableDrag(options) {
  config = options;
  options.root.onpointerdown = onPointerDown; // proprietà, non addEventListener: niente doppioni
}

// Vero mentre si sta trascinando: la vista non va ridisegnata (il blocco sparirebbe dalle dita)
export function isDragging() {
  return Boolean(state?.active);
}

// Vero se il click appena arrivato è la coda di un trascinamento (e va ignorato)
export function consumeDragClick() {
  const value = justDragged;
  justDragged = false;
  return value;
}

const snap = (minutes) => Math.round(minutes / SNAP) * SNAP;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const toTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function onPointerDown(e) {
  // un nuovo tocco azzera il "click da ignorare" (col dito, dopo un trascinamento, il click a volte non arriva)
  justDragged = false;
  if (e.button !== 0) return; // solo tasto sinistro / dito
  const source = e.target.closest('.block, .inbox-item');
  if (!source) return;

  state = {
    source,
    mode: e.target.closest('.block__resize') ? 'resize' : 'move',
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    x: e.clientX,
    y: e.clientY,
    active: false,
    timer: null,
  };
  // il bordo per la durata è piccolo e apposta: lì il gesto parte subito anche col dito
  if (e.pointerType !== 'mouse' && state.mode === 'move') {
    state.timer = setTimeout(begin, LONG_PRESS);
  }
}

// I listener sulla finestra si registrano una volta sola, all'avvio del modulo
window.addEventListener('pointermove', (e) => {
  if (!state || e.pointerId !== state.pointerId) return;
  state.x = e.clientX;
  state.y = e.clientY;

  if (!state.active) {
    const distance = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
    if (e.pointerType === 'mouse' || state.mode === 'resize') {
      if (distance > 4) begin();
    } else if (distance > TOLERANCE) {
      cancel(); // il dito si è mosso prima della pressione lunga: sta scorrendo la pagina
    }
    return;
  }
  update();
});

window.addEventListener('pointerup', (e) => {
  if (!state || e.pointerId !== state.pointerId) return;
  if (state.active) finish();
  else cancel();
});

// Il browser ha preso il controllo del gesto (es. ha iniziato a scorrere): annulliamo
window.addEventListener('pointercancel', (e) => {
  if (state && e.pointerId === state.pointerId) cancel();
});

// Durante il trascinamento col dito blocchiamo lo scorrimento della pagina.
// Serve un listener "non passivo", altrimenti preventDefault viene ignorato.
document.addEventListener('touchmove', (e) => {
  if (state?.active) e.preventDefault();
}, { passive: false });

// La pressione lunga su iPhone aprirebbe il menu "copia/condividi": lo evitiamo mentre si trascina
document.addEventListener('contextmenu', (e) => {
  if (state) e.preventDefault();
});

function begin() {
  if (!state || state.active) return;
  clearTimeout(state.timer);
  state.active = true;
  const { source } = state;
  const { hourHeight } = config;

  if (source.classList.contains('inbox-item')) {
    // dalla lista "Da fare": un blocco provvisorio che segue il dito/mouse
    const block = document.createElement('div');
    block.className = 'block block--ghost';
    block.setAttribute('data-area', source.dataset.area);
    block.style.cssText = source.getAttribute('style') ?? '';
    block.innerHTML = `<span class="block__open"><span class="block__time num"></span><span class="block__title"></span></span>`;
    block.querySelector('.block__title').textContent = source.textContent.trim();
    state.block = block;
    state.duration = Number(source.dataset.duration) || 30;
    state.grab = 0;
    block.style.height = `${(state.duration / 60) * hourHeight}px`;
  } else {
    state.block = source;
    state.duration = Number(source.dataset.duration) || 30;
    // a quanti minuti dall'inizio del blocco lo abbiamo "preso": così non salta sotto il dito
    const rect = source.getBoundingClientRect();
    state.grab = ((state.startY - rect.top) / hourHeight) * 60;
  }

  state.block.classList.add('is-dragging');
  navigator.vibrate?.(10); // piccola vibrazione dove è supportata (non su iPhone)
  update();
}

// ---------- Scorrimento automatico ----------
// Mentre si trascina la pagina non scorre col dito: se il dito si avvicina al bordo alto o basso
// dello schermo, la facciamo scorrere noi, un po' a ogni fotogramma (requestAnimationFrame).
const EDGE = 80;          // pixel dal bordo in cui parte lo scorrimento
const NAV_SPACE = 90;     // in basso c'è la barra di navigazione fissa
let scrollFrame = null;

function autoScroll() {
  scrollFrame = null;
  if (!state?.active) return;
  const bottomEdge = window.innerHeight - NAV_SPACE;
  let speed = 0;
  if (state.y < EDGE) speed = -Math.ceil((EDGE - state.y) / 6);
  else if (state.y > bottomEdge - EDGE) speed = Math.ceil((state.y - (bottomEdge - EDGE)) / 6);
  if (!speed) return;
  window.scrollBy(0, speed);
  update(); // la griglia si è spostata sotto il dito: ricalcoliamo l'orario (e update prenota il prossimo giro)
}

function update() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(autoScroll);
  const { start, end, hourHeight, root } = config;
  const { block } = state;

  if (state.mode === 'resize') {
    const columnTop = block.parentElement.getBoundingClientRect().top;
    const blockStart = Number(block.dataset.start); // inizio vero (non quello disegnato)
    const endMinutes = clamp(snap(start + ((state.y - columnTop) / hourHeight) * 60), blockStart + SNAP, end);
    const duration = endMinutes - blockStart;
    block.style.height = `${((endMinutes - Math.max(blockStart, start)) / 60) * hourHeight}px`;
    block.querySelector('.block__time').textContent = `${toTime(blockStart)}–${toTime(endMinutes)}`;
    state.result = { duration };
    return;
  }

  // colonna sotto il dito: le misuriamo ogni volta (la pagina potrebbe essere scorsa)
  const columns = [...root.querySelectorAll('.week__col')].map((col) => ({ col, rect: col.getBoundingClientRect() }));
  const target = columns.find((c) => state.x >= c.rect.left && state.x < c.rect.right)
    ?? (state.x < columns[0].rect.left ? columns[0] : columns[columns.length - 1]);

  const minutes = clamp(
    snap(start + ((state.y - target.rect.top) / hourHeight) * 60 - state.grab),
    start,
    end - SNAP,
  );

  if (block.parentElement !== target.col) target.col.append(block);
  block.style.top = `${((minutes - start) / 60) * hourHeight}px`;
  block.style.left = '0';
  block.style.width = '100%';
  block.querySelector('.block__time').textContent = toTime(minutes);
  state.result = { date: target.col.dataset.date, start: minutes };
}

function finish() {
  const { source, mode, result } = state;
  state.block.classList.remove('is-dragging');
  state = null;
  justDragged = true;
  config.onDrop(result ? { id: source.dataset.id, mode, ...result } : null);
}

// Gesto annullato. Se il blocco si era già mosso, ridisegniamo per rimetterlo a posto.
function cancel() {
  if (!state) return;
  clearTimeout(state.timer);
  const wasActive = state.active;
  state = null;
  if (wasActive) config.onDrop(null);
}

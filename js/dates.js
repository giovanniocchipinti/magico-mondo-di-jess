// Funzioni per date e orari. Tutto ragiona nel fuso Europe/Rome.
//
// Le date sono stringhe "YYYY-MM-DD" (come le salverà Postgres nel tipo date).
// Per fare calcoli le trasformiamo in mezzanotte UTC: così l'ora legale
// e il fuso del dispositivo non spostano mai il giorno.

const TZ = 'Europe/Rome';

function toDate(iso) {
  return new Date(iso + 'T00:00:00Z');
}

// Data di oggi a Roma, es. "2026-09-30"
export function todayISO() {
  // il formato en-CA produce proprio YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

// Giorno (YYYY-MM-DD) a Roma di un istante salvato dal database, es. "2026-11-07T23:30:00Z" -> "2026-11-08"
export function dateInRome(timestamp) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(timestamp));
}

// Minuti passati dalla mezzanotte, ora di Roma (es. 10:30 -> 630)
export function nowMinutes() {
  const parts = new Intl.DateTimeFormat('it-IT', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return get('hour') * 60 + get('minute');
}

export function addDays(iso, n) {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 1 = lunedì ... 7 = domenica (standard ISO; getUTCDay dà 0 per la domenica)
export function isoWeekday(iso) {
  return toDate(iso).getUTCDay() || 7;
}

// Lunedì della settimana che contiene la data
export function startOfWeek(iso) {
  return addDays(iso, 1 - isoWeekday(iso));
}

function format(iso, options) {
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', ...options }).format(toDate(iso));
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "Mercoledì 30 settembre"
export function formatDayLong(iso) {
  return capitalize(format(iso, { weekday: 'long', day: 'numeric', month: 'long' }));
}

// "mer 30 set"
export function formatDayShort(iso) {
  return format(iso, { weekday: 'short', day: 'numeric', month: 'short' });
}

// "settembre 2026"
export function formatMonth(iso) {
  return format(iso, { month: 'long', year: 'numeric' });
}

// "09:30" -> 570
export function timeToMin(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// 570 -> "09:30"
export function minToTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// "tra 25 min", "tra 1 h 10 min"
export function formatIn(minutes) {
  if (minutes < 60) return `tra ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `tra ${h} h ${m} min` : `tra ${h} h`;
}

// 90 -> "1 h 30", 45 -> "45 min", 120 -> "2 h"
export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

// Giorni da "from" a "to" (date YYYY-MM-DD): positivo se "to" è dopo
export function daysBetween(from, to) {
  return Math.round((toDate(to) - toDate(from)) / 86400000);
}

// Quanto manca a una scadenza, in parole: "mancano 3 settimane", "scade oggi", "scaduto da 2 giorni"
export function formatTimeLeft(today, deadline) {
  const days = daysBetween(today, deadline);
  if (days < 0) return days === -1 ? 'scaduto ieri' : `scaduto da ${-days} giorni`;
  if (days === 0) return 'scade oggi';
  if (days === 1) return 'manca 1 giorno';
  if (days < 14) return `mancano ${days} giorni`;
  if (days < 60) return `mancano ${Math.round(days / 7)} settimane`;
  return `mancano ${Math.round(days / 30)} mesi`;
}

// Calcoli di pianificazione: buchi liberi in una giornata e cose da suggerire per riempirli.
// Funzioni "pure" sui dati in memoria: non disegnano niente, così le userà anche la vista Settimana.

import { items, areas, goals, workHours, settings } from './data/db.js';
import { timeToMin, isoWeekday, addDays } from './dates.js';
import { priorityRank } from './ui.js';

export const DAY_START_FREE = 8 * 60;  // nei giorni senza lavoro la giornata parte alle 8:00
export const MIN_GAP = 30;             // sotto i 30 minuti non è un buco utile

// Buchi liberi di un giorno, a partire da "from" (minuti dalla mezzanotte).
// Restituisce [{ start, end, slot }] dove slot è 'work' (in orario di lavoro) o 'free'.
export function freeGaps(date, from = 0) {
  const hours = workHours[isoWeekday(date)];
  const workStart = hours ? timeToMin(hours.start) : null;
  const workEnd = hours ? timeToMin(hours.end) : null;

  // Intervalli occupati: elementi con orario (anche i sotto-appuntamenti), escluse le task già fatte
  const busy = items
    .filter((i) => i.scheduled_date === date && i.start_time && !(i.type === 'task' && i.done))
    .map((i) => {
      const start = timeToMin(i.start_time);
      return [start, start + (i.duration_min ?? 30)];
    })
    .sort((a, b) => a[0] - b[0]);

  // Arrotondiamo "adesso" ai 5 minuti successivi: 16:02 -> 16:05
  let cursor = Math.max(Math.ceil(from / 5) * 5, workStart ?? DAY_START_FREE);
  const gaps = [];
  for (const [start, end] of busy) {
    if (start - cursor >= MIN_GAP) gaps.push({ start: cursor, end: start });
    cursor = Math.max(cursor, end);
  }
  const dayEnd = timeToMin(settings.day_end); // fino a che ora cercare (Impostazioni)
  if (dayEnd - cursor >= MIN_GAP) gaps.push({ start: cursor, end: dayEnd });

  // Un buco a cavallo della fine del lavoro diventa due: i suggerimenti cambiano tra le due fasce
  const result = [];
  for (const gap of gaps) {
    if (workEnd !== null && gap.start < workEnd && gap.end > workEnd) {
      result.push({ start: gap.start, end: workEnd }, { start: workEnd, end: gap.end });
    } else {
      result.push(gap);
    }
  }

  return result
    .filter((g) => g.end - g.start >= MIN_GAP)
    .map((g) => ({ ...g, slot: workEnd !== null && g.start >= workStart && g.start < workEnd ? 'work' : 'free' }));
}

// Task da suggerire per un buco: non fatte, senza orario, di oggi, rimaste indietro o da pianificare,
// di un'area adatta alla fascia ('work' / 'free'). Prima ciò che scade entro domani,
// poi i passi degli obiettivi, poi per priorità e scadenza.
export function suggestionsFor(slot, today, { exclude = new Set(), limit = 2 } = {}) {
  const slotOf = (item) => {
    // i passi di un obiettivo "tutta la vita" (senza area) vanno bene in qualsiasi momento
    const goal = item.goal_id && goals.find((g) => g.id === item.goal_id);
    if (goal && !goal.area_id) return 'any';
    return areas.find((a) => a.id === item.area_id)?.slot ?? 'any';
  };
  const tomorrow = addDays(today, 1);
  // ciò che scade entro domani passa davanti a tutto, anche alla priorità
  const urgent = (item) => (item.due_date && item.due_date <= tomorrow ? 0 : 1);
  // poi i passi degli obiettivi in corso: i momenti liberi servono a far avanzare gli obiettivi
  const activeGoals = new Set(goals.filter((g) => !g.achieved_at).map((g) => g.id));
  const goalStep = (item) => (activeGoals.has(item.goal_id) ? 0 : 1);

  return items
    .filter((i) => i.type === 'task' && !i.done && !i.parent_id && !i.start_time && !exclude.has(i.id))
    .filter((i) => !i.scheduled_date || i.scheduled_date <= today)
    .filter((i) => slotOf(i) === 'any' || slotOf(i) === slot)
    .sort((a, b) =>
      (urgent(a) - urgent(b))
      || (goalStep(a) - goalStep(b))
      || (priorityRank(a) - priorityRank(b))
      || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
      // a parità, prima ciò che era già previsto per oggi (o prima)
      || (a.scheduled_date ? 0 : 1) - (b.scheduled_date ? 0 : 1))
    .slice(0, limit);
}

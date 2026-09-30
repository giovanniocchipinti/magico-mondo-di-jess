// Dati finti per la Fase 1. Hanno la stessa forma che avranno le tabelle Supabase,
// così nella Fase 2 cambierà solo da dove arrivano i dati, non le viste.
// Le date sono calcolate rispetto a oggi, così la demo è sempre "attuale".

import { todayISO, addDays } from '../dates.js';

const today = todayISO();

export const areas = [
  { id: 'vivaio', name: 'Vivaio', color: '#2f7a4b' },
  { id: 'kroma', name: 'Kroma Web Lab', color: '#d24f03' },
  { id: 'personale', name: 'Personale', color: '#b0356a' },
];

// Orario di lavoro per giorno della settimana (1 = lunedì, 7 = domenica). null = giorno libero
export const workHours = {
  1: { start: '07:00', end: '15:00' },
  2: { start: '07:00', end: '15:00' },
  3: { start: '07:00', end: '15:00' },
  4: { start: '07:00', end: '15:00' },
  5: { start: '07:00', end: '15:00' },
  6: { start: '07:00', end: '12:00' },
  7: null,
};

// Id temporanei: nella Fase 2 li genererà il database
let lastId = 0;
export function newId() {
  lastId += 1;
  return String(lastId);
}

// Crea un elemento con tutti i campi, usando valori predefiniti per quelli non indicati
export function makeItem(fields) {
  return {
    id: newId(),
    type: 'task',            // 'task' | 'appointment'
    title: '',
    notes: '',
    area_id: 'personale',
    scheduled_date: null,    // null = sta in "Da pianificare"
    start_time: null,        // null = "in giornata", senza orario
    duration_min: null,
    location: null,          // solo per gli appuntamenti
    priority: null,          // null | 'low' | 'medium' | 'high'
    due_date: null,          // scadenza, diversa dalla data pianificata
    done: false,
    done_at: null,
    ...fields,
  };
}

export const items = [
  // --- Oggi: Vivaio ---
  makeItem({ type: 'appointment', title: 'Carico ordine Garden Center', area_id: 'vivaio', scheduled_date: today, start_time: '07:30', duration_min: 60, location: 'Magazzino' }),
  makeItem({ title: 'Rinvasare piantine di rosmarino', area_id: 'vivaio', scheduled_date: today, start_time: '09:00', duration_min: 90, priority: 'medium', done: true, done_at: `${today}T10:20:00+02:00` }),
  makeItem({ title: 'Aggiornare listino prezzi autunno', area_id: 'vivaio', scheduled_date: today, start_time: '11:00', duration_min: 60 }),
  makeItem({ title: 'Controllare irrigazione serra 2', area_id: 'vivaio', scheduled_date: today, priority: 'high' }),

  // --- Oggi: Kroma Web Lab ---
  makeItem({ type: 'appointment', title: 'Call con cliente, sito ristorante', area_id: 'kroma', scheduled_date: today, start_time: '16:30', duration_min: 45, location: 'Google Meet' }),
  makeItem({ title: 'Sistemare menu mobile sito Zeronove', area_id: 'kroma', scheduled_date: today, start_time: '18:00', duration_min: 90 }),
  makeItem({ title: 'Inviare preventivo a Studio Bianchi', area_id: 'kroma', scheduled_date: today, priority: 'high', due_date: addDays(today, 2) }),

  // --- Oggi: Personale ---
  makeItem({ title: 'Pagare bolletta luce', area_id: 'personale', scheduled_date: today, due_date: today, done: true, done_at: `${today}T08:05:00+02:00` }),
  makeItem({ type: 'appointment', title: 'Palestra', area_id: 'personale', scheduled_date: today, start_time: '20:00', duration_min: 60 }),
  makeItem({ title: 'Ripasso Spring: capitolo JPA', area_id: 'personale', scheduled_date: today, start_time: '21:30', duration_min: 45, priority: 'low' }),

  // --- Rimaste indietro ---
  makeItem({ title: 'Richiamare fornitore vasi', area_id: 'vivaio', scheduled_date: addDays(today, -2), priority: 'medium' }),
  makeItem({ title: 'Backup database sito Kroma', area_id: 'kroma', scheduled_date: addDays(today, -1) }),

  // --- Prossimi giorni (serviranno per Settimana e Mese) ---
  makeItem({ type: 'appointment', title: 'Dentista', area_id: 'personale', scheduled_date: addDays(today, 1), start_time: '17:30', duration_min: 45, location: 'Studio dott. Russo' }),
  makeItem({ title: 'Ordinare terriccio', area_id: 'vivaio', scheduled_date: addDays(today, 1), start_time: '08:00', duration_min: 30 }),
  makeItem({ title: 'Consegna bozza logo', area_id: 'kroma', scheduled_date: addDays(today, 3), due_date: addDays(today, 3), priority: 'high' }),

  // --- Da pianificare (senza data) ---
  makeItem({ title: 'Rinnovare dominio kromaweblab.it', area_id: 'kroma', priority: 'high', due_date: addDays(today, 10) }),
  makeItem({ title: 'Preparare portfolio progetti', area_id: 'kroma', priority: 'medium' }),
  makeItem({ title: 'Idee post Instagram vivaio', area_id: 'vivaio', priority: 'low' }),
  makeItem({ title: 'Prenotare revisione auto', area_id: 'personale', priority: 'medium', due_date: addDays(today, 20) }),
  makeItem({ title: 'Studiare CSS container queries', area_id: 'personale' }),
];

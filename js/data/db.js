// Accesso ai dati su Supabase. Prende il posto di fake-data.js.
//
// I dati caricati restano in memoria in questi array/oggetti, che le viste leggono come prima.
// Le modifiche aggiornano subito la memoria (l'interfaccia è immediata) e poi il database;
// se il database rifiuta, rimettiamo i valori di prima ("aggiornamento ottimistico").

import { supabase } from '../supabase.js';

export const areas = [];
export const items = [];
export const workHours = {}; // { 1: { start: '07:00', end: '15:00' }, ..., 7: null }

// Postgres restituisce gli orari come "07:30:00": a noi bastano ore e minuti
function hhmm(time) {
  return time ? time.slice(0, 5) : null;
}

function itemFromDb(row) {
  return { ...row, start_time: hhmm(row.start_time) };
}

// Carica tutto. Per ora gli elementi sono pochi: più avanti caricheremo solo il periodo visibile.
export async function loadAll() {
  const [areasRes, itemsRes, hoursRes] = await Promise.all([
    supabase.from('areas').select('*').order('position'),
    supabase.from('items').select('*'),
    supabase.from('work_hours').select('*'),
  ]);

  for (const res of [areasRes, itemsRes, hoursRes]) {
    if (res.error) throw res.error;
  }

  // splice svuota e riempie lo STESSO array: chi l'ha importato vede i dati nuovi
  areas.splice(0, areas.length, ...areasRes.data);
  items.splice(0, items.length, ...itemsRes.data.map(itemFromDb));

  for (let day = 1; day <= 7; day++) workHours[day] = null;
  for (const row of hoursRes.data) {
    workHours[row.weekday] = row.start_time
      ? { start: hhmm(row.start_time), end: hhmm(row.end_time) }
      : null;
  }
}

// Al primo accesso non ci sono aree: creiamo quelle iniziali e l'orario di lavoro
export async function ensureDefaults() {
  if (areas.length > 0) return;

  const { error: areasError } = await supabase.from('areas').insert([
    { name: 'Vivaio', color: '#2f7a4b', face: 'work', position: 0 },
    { name: 'Kroma Web Lab', color: '#d24f03', face: 'work', position: 1 },
    { name: 'Personale', color: '#b0356a', face: 'personal', position: 2 },
  ]);
  if (areasError) throw areasError;

  const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_time: '07:00', end_time: '15:00' }));
  const { error: hoursError } = await supabase.from('work_hours').insert([
    ...weekdays,
    { weekday: 6, start_time: '07:00', end_time: '12:00' },
    { weekday: 7, start_time: null, end_time: null },
  ]);
  if (hoursError) throw hoursError;

  await loadAll();
}

// Crea un elemento e lo aggiunge alla memoria. user_id lo mette il database (default auth.uid()).
export async function createItem(fields) {
  const { data, error } = await supabase.from('items').insert(fields).select().single();
  if (error) throw error;
  const item = itemFromDb(data);
  items.push(item);
  return item;
}

// Modifica un elemento: subito in memoria, poi sul database.
export async function updateItem(item, changes) {
  const previous = {};
  for (const key of Object.keys(changes)) previous[key] = item[key];
  Object.assign(item, changes);

  const { error } = await supabase.from('items').update(changes).eq('id', item.id);
  if (error) {
    Object.assign(item, previous); // il database ha rifiutato: torniamo indietro
    throw error;
  }
}

// Al logout svuotiamo la memoria, così i dati non restano nella pagina
export function clearData() {
  areas.length = 0;
  items.length = 0;
  for (const key of Object.keys(workHours)) delete workHours[key];
}

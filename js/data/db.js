// Accesso ai dati su Supabase. Prende il posto di fake-data.js.
//
// I dati caricati restano in memoria in questi array/oggetti, che le viste leggono come prima.
// Le modifiche aggiornano subito la memoria (l'interfaccia è immediata) e poi il database;
// se il database rifiuta, rimettiamo i valori di prima ("aggiornamento ottimistico").

import { supabase } from '../supabase.js';

export const areas = [];
export const items = [];
export const goals = [];
export const categories = [];
export const recurring = [];
export const transactions = [];
// impostazioni personali: valori predefiniti finché non arrivano dal database
export const settings = { day_end: '22:00', morning_summary: '07:30' };
export const workHours = {}; // { 1: { start: '07:00', end: '15:00' }, ..., 7: null }

// Cambia a ogni logout: serve a riconoscere operazioni partite con la sessione precedente
let sessionGeneration = 0;
export function currentGeneration() {
  return sessionGeneration;
}

// Postgres restituisce gli orari come "07:30:00": a noi bastano ore e minuti
function hhmm(time) {
  return time ? time.slice(0, 5) : null;
}

// Gli importi "numeric" arrivano come numeri: li forziamo comunque a Number per fare i conti
function moneyFromDb(row) {
  return { ...row, amount: Number(row.amount) };
}

function itemFromDb(row) {
  return { ...row, start_time: hhmm(row.start_time) };
}

// Carica tutto. Per ora gli elementi sono pochi: più avanti caricheremo solo il periodo visibile.
export async function loadAll() {
  const [areasRes, itemsRes, hoursRes, goalsRes, catRes, recRes, txRes, setRes] = await Promise.all([
    supabase.from('areas').select('*').order('position'),
    supabase.from('items').select('*'),
    supabase.from('work_hours').select('*'),
    supabase.from('goals').select('*').order('created_at'),
    supabase.from('categories').select('*').order('position'),
    supabase.from('recurring').select('*').order('next_due'),
    supabase.from('transactions').select('*').order('date'),
    supabase.from('settings').select('*').maybeSingle(), // una riga, oppure nessuna (primo accesso)
  ]);

  for (const res of [areasRes, itemsRes, hoursRes, goalsRes, catRes, recRes, txRes, setRes]) {
    if (res.error) throw res.error;
  }

  // splice svuota e riempie lo STESSO array: chi l'ha importato vede i dati nuovi
  areas.splice(0, areas.length, ...areasRes.data);
  items.splice(0, items.length, ...itemsRes.data.map(itemFromDb));
  goals.splice(0, goals.length, ...goalsRes.data);
  categories.splice(0, categories.length, ...catRes.data);
  recurring.splice(0, recurring.length, ...recRes.data.map(moneyFromDb));
  transactions.splice(0, transactions.length, ...txRes.data.map(moneyFromDb));
  if (setRes.data) {
    settings.day_end = hhmm(setRes.data.day_end);
    settings.morning_summary = hhmm(setRes.data.morning_summary);
  }

  for (let day = 1; day <= 7; day++) workHours[day] = null;
  for (const row of hoursRes.data) {
    workHours[row.weekday] = row.start_time
      ? { start: hhmm(row.start_time), end: hhmm(row.end_time) }
      : null;
  }
}

// Al primo accesso non ci sono aree: creiamo quelle iniziali e l'orario di lavoro.
// Usiamo upsert con ignoreDuplicates ("inserisci, ma se esiste già lascia stare"):
// se due schede lo fanno insieme, il database tiene una sola copia grazie ai vincoli unique.
export async function ensureDefaults() {
  if (areas.length > 0) return;

  const { error: areasError } = await supabase.from('areas').upsert([
    // le aree di Jess, con i suoi colori
    { name: 'Lavoro – Casale Allibrio', color: '#0f8f84', face: 'work', slot: 'work', position: 0 },
    { name: 'Vita privata', color: '#d0443c', face: 'personal', slot: 'free', position: 1 },
  ], { onConflict: 'user_id,name', ignoreDuplicates: true });
  if (areasError) throw areasError;

  const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_time: '07:00', end_time: '15:00' }));
  const { error: hoursError } = await supabase.from('work_hours').upsert([
    ...weekdays,
    { weekday: 6, start_time: '07:00', end_time: '12:00' },
    { weekday: 7, start_time: null, end_time: null },
  ], { onConflict: 'user_id,weekday', ignoreDuplicates: true });
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

// Segna fatto / non fatto (un solo posto per la regola su done_at)
export function setDone(item, done) {
  return updateItem(item, { done, done_at: done ? new Date().toISOString() : null });
}

// Toglie dalla memoria un elemento e i suoi sotto-elementi; restituisce quelli tolti
// (servono per l'"Annulla"). Il database non viene toccato.
export function removeLocally(item) {
  const removed = items.filter((i) => i.id === item.id || i.parent_id === item.id);
  for (const r of removed) items.splice(items.indexOf(r), 1);
  return removed;
}

// Rimette in memoria elementi tolti con removeLocally
export function restoreItems(list) {
  items.push(...list);
}

// Elimina sul database. I sotto-elementi spariscono da soli: "on delete cascade" nello schema.
export async function deleteItem(id) {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Obiettivi ----------

export async function createGoal(fields) {
  const { data, error } = await supabase.from('goals').insert(fields).select().single();
  if (error) throw error;
  goals.push(data);
  return data;
}

// Come updateItem: subito in memoria, poi sul database, e se rifiuta si torna indietro
export async function updateGoal(goal, changes) {
  const previous = {};
  for (const key of Object.keys(changes)) previous[key] = goal[key];
  Object.assign(goal, changes);

  const { error } = await supabase.from('goals').update(changes).eq('id', goal.id);
  if (error) {
    Object.assign(goal, previous);
    throw error;
  }
}

// I passi NON vengono eliminati: nel database goal_id diventa null ("on delete set null")
// e qui facciamo lo stesso in memoria, così restano come normali cose da fare
export async function deleteGoal(goal) {
  const { error } = await supabase.from('goals').delete().eq('id', goal.id);
  if (error) throw error;
  goals.splice(goals.indexOf(goal), 1);
  for (const item of items) {
    if (item.goal_id === goal.id) item.goal_id = null;
  }
}

// Valore attuale di un obiettivo a numero: il valore scritto a mano (punto di partenza)
// più i movimenti collegati (le entrate aggiungono, le uscite tolgono)
export function goalValue(goal) {
  let value = Number(goal.current_value);
  for (const t of transactions) {
    if (t.goal_id === goal.id) value += t.kind === 'in' ? t.amount : -t.amount;
  }
  return value;
}

// Avanzamento da 0 a 1: passi fatti / passi totali, oppure valore attuale / traguardo
export function goalProgress(goal) {
  if (goal.kind === 'number') {
    return Math.min(1, Math.max(0, goalValue(goal) / Number(goal.target_value)));
  }
  const steps = items.filter((i) => i.goal_id === goal.id && !i.parent_id);
  return steps.length ? steps.filter((s) => s.done).length / steps.length : 0;
}

// ---------- Soldi ----------

// Categorie iniziali: create una volta, al primo accesso alla pagina Soldi (upsert: niente doppioni)
export async function ensureCategories() {
  if (categories.length > 0) return;
  const out = ['Casa', 'Spesa', 'Bollette', 'Trasporti', 'Salute', 'Svago', 'Abbonamenti', 'Lavoro', 'Altro'];
  const income = ['Stipendio', 'Lavoro extra', 'Rimborsi', 'Altro'];
  const rows = [
    ...out.map((name, position) => ({ name, kind: 'out', position })),
    ...income.map((name, position) => ({ name, kind: 'in', position })),
  ];
  const { error } = await supabase.from('categories').upsert(rows, { onConflict: 'user_id,kind,name', ignoreDuplicates: true });
  if (error) throw error;
  const res = await supabase.from('categories').select('*').order('position');
  if (res.error) throw res.error;
  categories.splice(0, categories.length, ...res.data);
}

export async function createTransaction(fields) {
  const { data, error } = await supabase.from('transactions').insert(fields).select().single();
  if (error) throw error;
  const row = moneyFromDb(data);
  transactions.push(row);
  return row;
}

export async function updateTransaction(row, changes) {
  const previous = {};
  for (const key of Object.keys(changes)) previous[key] = row[key];
  Object.assign(row, changes);
  const { error } = await supabase.from('transactions').update(changes).eq('id', row.id);
  if (error) {
    Object.assign(row, previous);
    throw error;
  }
}

// Solo database: la memoria la gestisce chi chiama (per poter offrire "Annulla", come per gli elementi)
export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

export async function createRecurring(fields) {
  const { data, error } = await supabase.from('recurring').insert(fields).select().single();
  if (error) throw error;
  const row = moneyFromDb(data);
  recurring.push(row);
  return row;
}

export async function updateRecurring(row, changes) {
  const previous = {};
  for (const key of Object.keys(changes)) previous[key] = row[key];
  Object.assign(row, changes);
  const { error } = await supabase.from('recurring').update(changes).eq('id', row.id);
  if (error) {
    Object.assign(row, previous);
    throw error;
  }
}

export async function deleteRecurring(row) {
  const { error } = await supabase.from('recurring').delete().eq('id', row.id);
  if (error) throw error;
  recurring.splice(recurring.indexOf(row), 1);
}

// ---------- Impostazioni ----------

// Salva le impostazioni (upsert: la riga si crea alla prima modifica)
export async function updateSettings(changes) {
  const previous = { ...settings };
  Object.assign(settings, changes);
  const { error } = await supabase.from('settings').upsert({ ...settings, updated_at: new Date().toISOString() });
  if (error) {
    Object.assign(settings, previous);
    throw error;
  }
}

// Orario di un giorno (1 = lunedì): start/end "HH:MM", oppure null e null = giorno libero
export async function updateWorkHours(weekday, start, end) {
  const previous = workHours[weekday];
  workHours[weekday] = start ? { start, end } : null;
  const { error } = await supabase.from('work_hours')
    .upsert({ weekday, start_time: start, end_time: end }, { onConflict: 'user_id,weekday' });
  if (error) {
    workHours[weekday] = previous;
    throw error;
  }
}

// ---------- Aree ----------

export async function createArea(fields) {
  const { data, error } = await supabase.from('areas').insert({ ...fields, position: areas.length }).select().single();
  if (error) throw error;
  areas.push(data);
  return data;
}

export async function updateArea(area, changes) {
  const previous = {};
  for (const key of Object.keys(changes)) previous[key] = area[key];
  Object.assign(area, changes);
  const { error } = await supabase.from('areas').update(changes).eq('id', area.id);
  if (error) {
    Object.assign(area, previous);
    throw error;
  }
}

// Elimina un'area. Se ha elementi, prima li sposta in moveToId (il database blocca
// l'eliminazione di un'area con elementi: "on delete restrict").
// Obiettivi, pagamenti e movimenti restano, senza area ("on delete set null").
export async function deleteArea(area, moveToId = null) {
  if (moveToId) {
    const { error } = await supabase.from('items').update({ area_id: moveToId }).eq('area_id', area.id);
    if (error) throw error;
    for (const item of items) if (item.area_id === area.id) item.area_id = moveToId;
  }
  const { error } = await supabase.from('areas').delete().eq('id', area.id);
  if (error) throw error;
  areas.splice(areas.indexOf(area), 1);
  for (const list of [goals, recurring, transactions]) {
    for (const row of list) if (row.area_id === area.id) row.area_id = null;
  }
}

// ---------- Categorie dei soldi ----------

export async function createCategory(fields) {
  const position = categories.filter((c) => c.kind === fields.kind).length;
  const { data, error } = await supabase.from('categories').insert({ ...fields, position }).select().single();
  if (error) throw error;
  categories.push(data);
  return data;
}

export async function updateCategory(category, changes) {
  const previous = {};
  for (const key of Object.keys(changes)) previous[key] = category[key];
  Object.assign(category, changes);
  const { error } = await supabase.from('categories').update(changes).eq('id', category.id);
  if (error) {
    Object.assign(category, previous);
    throw error;
  }
}

// I movimenti e i pagamenti con questa categoria restano, senza categoria ("on delete set null")
export async function deleteCategory(category) {
  const { error } = await supabase.from('categories').delete().eq('id', category.id);
  if (error) throw error;
  categories.splice(categories.indexOf(category), 1);
  for (const list of [recurring, transactions]) {
    for (const row of list) if (row.category_id === category.id) row.category_id = null;
  }
}

// Al logout svuotiamo la memoria, così i dati non restano nella pagina
export function clearData() {
  sessionGeneration += 1;
  areas.length = 0;
  items.length = 0;
  goals.length = 0;
  categories.length = 0;
  recurring.length = 0;
  transactions.length = 0;
  Object.assign(settings, { day_end: '22:00', morning_summary: '07:30' });
  for (const key of Object.keys(workHours)) delete workHours[key];
}

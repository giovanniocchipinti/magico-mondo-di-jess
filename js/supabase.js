// Client Supabase, condiviso da tutta l'app.
// La libreria arriva da CDN con versione fissata: un aggiornamento della libreria non può rompere l'app a sorpresa.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Finché config.js contiene i segnaposto, l'app mostra come configurarla invece di dare errori
export const isConfigured = !SUPABASE_URL.includes('TUO-PROGETTO') && !SUPABASE_KEY.includes('INCOLLA');

export const supabase = isConfigured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Dati del progetto Supabase: Project Settings -> API Keys (e Data API per l'URL).
//
// La chiave "publishable" (sb_publishable_..., o la vecchia "anon") PUÒ stare nel codice pubblico:
// identifica solo il progetto. I dati sono protetti dal login e dalle policy RLS.
// La chiave "secret" (o "service_role") invece salta la RLS: NON deve MAI finire qui.

export const SUPABASE_URL = 'https://TUO-PROGETTO.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_INCOLLA-QUI-LA-CHIAVE';

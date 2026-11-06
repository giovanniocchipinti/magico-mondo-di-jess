// Login, registrazione e logout con Supabase Auth (email e password).
// Supabase salva la sessione nel browser e la rinnova da solo: restiamo loggati anche chiudendo l'app.

import { supabase } from './supabase.js';

// Chiama callback(session) ora e a ogni cambio (login, logout, sessione scaduta).
// session è null quando non c'è nessuno loggato.
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    // Supabase sconsiglia di fare altre chiamate al database DENTRO questo callback
    // (possono bloccarsi a vicenda): con setTimeout le rimandiamo a subito dopo.
    setTimeout(() => callback(session), 0);
  });
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateError(error));
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // il link di conferma nell'email riporta a questa pagina
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw new Error(translateError(error));
  // Se la conferma email è attiva, non c'è ancora una sessione: bisogna cliccare il link
  return { needsConfirmation: !data.session };
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Messaggi di Supabase (in inglese) -> messaggi chiari in italiano
function translateError(error) {
  const messages = {
    invalid_credentials: 'Email o password non corretti.',
    email_not_confirmed: 'Conferma prima l\'email: trovi il link nella tua casella di posta.',
    signup_disabled: 'Le nuove registrazioni sono disattivate.',
    user_already_exists: 'Esiste già un account con questa email. Usa "Accedi".',
    weak_password: 'Password troppo debole: usa almeno 8 caratteri.',
    over_request_rate_limit: 'Troppi tentativi. Riprova tra qualche minuto.',
    over_email_send_rate_limit: 'Troppe email inviate. Riprova tra qualche minuto.',
  };
  // Nessuna risposta dal server (offline, oppure URL sbagliato in config.js)
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return 'Il server non risponde. Controlla la connessione e riprova.';
  }
  return messages[error.code] ?? `Errore: ${error.message}`;
}

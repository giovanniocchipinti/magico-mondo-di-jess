# Agenda — note per Claude

- Utente: sviluppatore web junior che vuole capire il codice. Spiega le scelte.
- Si lavora per fasi (vedi README): piano -> ok dell'utente -> codice -> spiegazione e test -> commit.
- Scelte tecniche importanti: mostra le alternative con pro e contro, decide l'utente.
- Stack: HTML/CSS/JS puri (ES modules), niente framework né build. Supabase (supabase-js) dal frontend, solo chiave anon, RLS su tutte le tabelle. Hosting GitHub Pages.
- Commenti in italiano, brevi. Codice semplice, niente astrazioni inutili.
- Interfaccia in italiano, settimana da lunedì, orari 24h, fuso Europe/Rome (vedi js/dates.js).
- Design: niente serif, gradienti viola/blu, glassmorfismo, emoji come icone, card uguali con ombre pesanti. Font Plus Jakarta Sans (UI) + Manrope (numeri, classe .num). Icone Lucide in js/icons.js.
- Colori solo tramite variabili in css/tokens.css; colori area con data-area + --area (vedi areaAttrs in js/ui.js).
- Dati: js/data/db.js (array in memoria + aggiornamenti ottimistici su Supabase). Schema in supabase/schema.sql: ogni tabella ha user_id default auth.uid(), RLS con 4 policy, FK composte (id, user_id).
- Obiettivo: "Il magico mondo di Jess", gestionale della vita multi-utente da vendere in abbonamento, guidato dalle idee di Jessica (iPhone, aree: Lavoro – Casale Allibrio e Vita privata). Tappe: vedi README.
- Server locale: python3 -m http.server 5501 (avviarlo da Bash: da launch.json macOS nega l'accesso al Desktop; la 5500 è usata da un altro progetto). Dopo modifiche a JS/CSS il browser può usare la cache: ricaricare con Cmd+Shift+R.

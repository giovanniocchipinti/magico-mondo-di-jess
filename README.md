# Agenda

Agenda personale per organizzare tre ambiti: **Vivaio**, **Kroma Web Lab** e **Personale**.

HTML, CSS e JavaScript puri (ES modules), senza framework né build. Dati e login con Supabase (dalla Fase 2).

## Avvio in locale

Gli ES modules non funzionano aprendo `index.html` con doppio clic: serve un piccolo server.

```bash
python3 -m http.server 5500
```

Poi apri http://localhost:5500.

La pagina `#componenti` mostra il design system (solo per lo sviluppo).

## Collegare Supabase

1. Crea un progetto su supabase.com (regione Frankfurt).
2. Nell'SQL Editor esegui `supabase/schema.sql`.
3. Copia URL e chiave publishable in `js/config.js` (mai la chiave secret / service_role).
4. In Authentication -> URL Configuration aggiungi l'indirizzo dell'app tra i Redirect URLs.
5. Crea il tuo account dall'app, poi disattiva le nuove registrazioni.

## Fasi

1. Setup e design system (fatto)
2. Database, RLS e login (fatto)
3. Da pianificare, aggiunta rapida, dettaglio elemento con sotto-elementi e note
4. Oggi: priorità, frase motivazionale, punto della situazione, buchi liberi con suggerimenti
5. Settimana con drag & drop e planning settimanale
6. Mese, Anno, Impostazioni, interruttore Lavoro / Personale
7. PWA e pubblicazione su GitHub Pages (agenda.giovanniocchipinti.it)
8. Notifiche e promemoria
9. Allegati negli elementi
10. Registro spese con grafici
11. Obiettivi (anche economici)
12. Rifinitura: revisione, accessibilità, test, README

## Struttura

```
css/   tokens (variabili), base, layout, componenti
js/    main.js (avvio), router.js, quick-add.js, ui.js, dates.js, icons.js
js/views/   una vista per file, ognuna esporta title, eyebrow() e render(container)
js/data/    db.js: lettura e scrittura su Supabase
supabase/   schema.sql: tabelle, vincoli, policy RLS
```

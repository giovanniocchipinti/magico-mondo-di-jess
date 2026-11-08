# Agenda

Agenda personale per organizzare tre ambiti: **Vivaio**, **Kroma Web Lab** e **Personale**.

HTML, CSS e JavaScript puri (ES modules), senza framework né build. Dati e login con Supabase (dalla Fase 2).

## Avvio in locale

Gli ES modules non funzionano aprendo `index.html` con doppio clic: serve un piccolo server.

```bash
python3 -m http.server 5501
```

Poi apri http://localhost:5501 (la 5500 è spesso occupata da altri progetti).

La pagina `#componenti` mostra il design system (solo per lo sviluppo).

## Collegare Supabase

1. Crea un progetto su supabase.com (regione Frankfurt).
2. Nell'SQL Editor esegui `supabase/schema.sql`.
3. Copia URL e chiave publishable in `js/config.js` (mai la chiave secret / service_role).
4. In Authentication -> URL Configuration aggiungi l'indirizzo dell'app tra i Redirect URLs.
5. Crea il tuo account dall'app, poi disattiva le nuove registrazioni.

## Obiettivo del progetto

"Il magico mondo di Jess": un piccolo gestionale della vita (impegni, obiettivi, soldi),
costruito sulle esigenze di Jessica e pensato per diventare un abbonamento mensile per chiunque.

## Tappe

1. Setup e design system (fatto)
2. Database, RLS e login (fatto)
3. Da fare, aggiunta rapida, dettaglio elemento con sotto-elementi e note (fatto)
4. Oggi: frase del giorno, punto della situazione, priorità, buchi liberi con suggerimenti (fatto)
5. Obiettivi a passi o a numero, collegati ai suggerimenti dei momenti liberi (fatto)
6. Soldi: entrate, uscite, pagamenti ricorrenti con scadenza, grafici (fatto)
7. Calendario: Settimana (drag & drop) e Mese
8. Sul telefono: PWA installabile su iPhone e pubblicazione online
9. Notifiche: promemoria, scadenze dei pagamenti, riepilogo del mattino
10. Per tutti: scelta delle proprie aree e dei moduli, nome e marchio
11. Abbonamento e pagamenti, privacy e termini

## Database

- `supabase/schema.sql` descrive il database completo: si usa su un progetto nuovo.
- `supabase/migrations/` aggiorna un database esistente: si eseguono in ordine, una volta sola.

## Struttura

```
css/   tokens (variabili), base, layout, componenti
js/    main.js (avvio), router.js, quick-add.js, ui.js, dates.js, icons.js
js/views/   una vista per file, ognuna esporta title, eyebrow() e render(container)
js/data/    db.js: lettura e scrittura su Supabase
supabase/   schema.sql: tabelle, vincoli, policy RLS
```

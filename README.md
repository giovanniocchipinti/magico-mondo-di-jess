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

## Struttura

```
css/   tokens (variabili), base, layout, componenti
js/    main.js (avvio), router.js, quick-add.js, ui.js, dates.js, icons.js
js/views/   una vista per file, ognuna esporta title, eyebrow() e render(container)
js/data/    dati finti (Fase 1)
```

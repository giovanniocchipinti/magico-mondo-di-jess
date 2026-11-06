-- Migrazione 002: niente aree con lo stesso nome per lo stesso utente.
--
-- Perché: al primo accesso due schede aperte insieme hanno creato due volte le aree iniziali.
-- Il frontend non può sapere cosa fa un'altra scheda: la regola deve stare nel database.

-- 1) Elimina i doppioni, tenendo per ogni nome l'area creata per prima.
--    (Le aree doppie non hanno elementi collegati; se li avessero, "on delete restrict" bloccherebbe tutto.)
delete from public.areas a
using public.areas b
where a.user_id = b.user_id
  and a.name = b.name
  and a.created_at > b.created_at;

-- 2) Da ora il database rifiuta una seconda area con lo stesso nome
alter table public.areas add constraint areas_nome_unico unique (user_id, name);

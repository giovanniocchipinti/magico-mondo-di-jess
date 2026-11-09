-- Migrazione 008: quali tutorial ha già visto l'utente (es. {'oggi','soldi'}).
-- Sta nel database e non nel telefono: così ogni tutorial si vede una volta sola, su qualsiasi dispositivo.
alter table public.settings add column tour_seen text[] not null default '{}';

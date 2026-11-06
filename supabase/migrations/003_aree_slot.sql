-- Migrazione 003: quando si lavora di solito su ogni area.
--
-- Serve ai suggerimenti nei buchi liberi: in orario di lavoro propone le cose del Vivaio,
-- dopo il lavoro quelle di Kroma Web Lab e Personale.
--   'work' = in orario di lavoro, 'free' = fuori orario, 'any' = sempre

alter table public.areas
  add column slot text not null default 'any' check (slot in ('work', 'free', 'any'));

update public.areas set slot = 'work' where name = 'Vivaio';
update public.areas set slot = 'free' where name in ('Kroma Web Lab', 'Personale');

-- Migrazione 004: obiettivi a lungo termine.
--
-- Un obiettivo si misura in due modi:
--   'steps'  = a passi: i passi sono normali elementi (items) con goal_id = questo obiettivo
--   'number' = a numero: "2000 €", "20 libri"... current_value si aggiorna a mano
--              (per gli obiettivi in euro, in futuro, dal modulo Soldi)

create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id       uuid,                        -- facoltativa: un obiettivo può riguardare tutta la vita
  title         text not null check (char_length(title) between 1 and 200),
  why           text not null default '',    -- la motivazione, che l'app ricorda
  kind          text not null default 'steps' check (kind in ('steps', 'number')),
  target_value  numeric check (target_value > 0),
  current_value numeric not null default 0,
  unit          text check (char_length(unit) <= 20),
  target_date   date,                        -- entro quando
  achieved_at   timestamptz,                 -- null = in corso, valorizzato = raggiunto (archivio)
  created_at    timestamptz not null default now(),

  unique (id, user_id),
  -- "set null (area_id)": eliminando l'area si svuota SOLO area_id, non user_id
  foreign key (area_id, user_id) references public.areas (id, user_id) on delete set null (area_id),
  constraint numero_ha_traguardo check (kind = 'steps' or target_value is not null)
);

-- Un elemento può essere un passo di un obiettivo
alter table public.items add column goal_id uuid;
alter table public.items
  add constraint items_goal_fk foreign key (goal_id, user_id)
  references public.goals (id, user_id) on delete set null (goal_id);
create index items_goal_idx on public.items (goal_id);

-- Permessi e RLS: come le altre tabelle
revoke all on public.goals from anon;
grant select, insert, update, delete on public.goals to authenticated;
alter table public.goals enable row level security;

create policy "goals: leggo i miei"     on public.goals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "goals: inserisco i miei" on public.goals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "goals: modifico i miei"  on public.goals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals: elimino i miei"   on public.goals for delete to authenticated
  using ((select auth.uid()) = user_id);

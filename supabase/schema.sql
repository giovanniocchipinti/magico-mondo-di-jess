-- =========================================================
-- Agenda: schema del database (Fase 2)
-- Da eseguire UNA volta nell'SQL Editor di Supabase.
-- =========================================================


-- ---------- AREE ----------
-- Vivaio, Kroma Web Lab, Personale... modificabili, se ne possono aggiungere altre.
create table public.areas (
  id         uuid primary key default gen_random_uuid(),
  -- auth.uid() = id dell'utente loggato: se il frontend non lo manda, lo mette il database
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- "double face": ogni area appartiene alla vita lavorativa o a quella personale
  face       text not null default 'personal' check (face in ('work', 'personal')),
  -- quando ci si lavora di solito: in orario di lavoro, fuori orario, sempre (vedi migrations/003)
  slot       text not null default 'any' check (slot in ('work', 'free', 'any')),
  position   int  not null default 0,
  created_at timestamptz not null default now(),

  -- serve alla chiave esterna composta di items (vedi sotto)
  unique (id, user_id),
  -- due aree con lo stesso nome creerebbero confusione (vedi migrations/002)
  constraint areas_nome_unico unique (user_id, name)
);


-- ---------- ELEMENTI (task e appuntamenti) ----------
create table public.items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id        uuid not null,
  parent_id      uuid,                 -- valorizzato = sotto-task / sotto-appuntamento
  type           text not null default 'task' check (type in ('task', 'appointment')),
  title          text not null check (char_length(title) between 1 and 200),
  notes          text not null default '',
  scheduled_date date,                 -- null = "Da pianificare"
  start_time     time,                 -- null = "in giornata"
  duration_min   int  check (duration_min between 1 and 1440),
  location       text,
  priority       text check (priority in ('low', 'medium', 'high')),
  due_date       date,                 -- scadenza, diversa dalla data pianificata
  done           boolean not null default false,
  done_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (id, user_id),

  -- Chiavi esterne "composte": l'area e il genitore devono essere DELLO STESSO utente.
  -- Una chiave esterna normale (solo area_id) controllerebbe solo che l'area esista,
  -- anche se appartiene a qualcun altro: la RLS non protegge da questo caso.
  foreign key (area_id, user_id)   references public.areas (id, user_id) on delete restrict,
  foreign key (parent_id, user_id) references public.items (id, user_id) on delete cascade,

  -- Regole che valgono sempre, anche se il frontend ha un bug
  constraint orario_richiede_data   check (start_time is null or scheduled_date is not null),
  constraint appuntamento_completo  check (type = 'task' or (scheduled_date is not null and start_time is not null and duration_min is not null)),
  constraint appuntamento_non_fatto check (type = 'task' or done = false),
  constraint done_at_coerente       check (done = (done_at is not null)),
  constraint non_genitore_di_se     check (parent_id <> id)
);

-- La query più frequente: "gli elementi di questo giorno / di questa settimana"
create index items_user_date_idx on public.items (user_id, scheduled_date);
create index items_parent_idx    on public.items (parent_id);

-- updated_at si aggiorna da solo a ogni modifica
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();


-- ---------- ORARIO DI LAVORO ----------
-- 7 righe per utente (1 = lunedì ... 7 = domenica). Orari null = giorno libero.
create table public.work_hours (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday    smallint not null check (weekday between 1 and 7),
  start_time time,
  end_time   time,

  primary key (user_id, weekday),
  constraint entrambi_o_nessuno check ((start_time is null) = (end_time is null)),
  constraint fine_dopo_inizio   check (end_time > start_time)
);


-- =========================================================
-- PERMESSI E ROW LEVEL SECURITY
-- =========================================================

-- 1) Chi può usare le tabelle: solo gli utenti loggati ("authenticated").
--    Gli anonimi ("anon", cioè chiunque abbia la chiave pubblica) non hanno alcun permesso.
revoke all on public.areas, public.items, public.work_hours from anon;
grant select, insert, update, delete on public.areas, public.items, public.work_hours to authenticated;

-- 2) Quali RIGHE: con la RLS attiva, senza policy nessuno vede niente.
--    Ogni policy apre l'accesso solo alle righe dove user_id è l'utente loggato.
--    "(select auth.uid())" invece di "auth.uid()": Postgres lo calcola una volta sola per query.
alter table public.areas      enable row level security;
alter table public.items      enable row level security;
alter table public.work_hours enable row level security;

-- using      = quali righe esistenti posso vedere/modificare/eliminare
-- with check = come devono essere le righe che scrivo (inserite o modificate)

create policy "areas: leggo le mie"     on public.areas for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "areas: inserisco le mie" on public.areas for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "areas: modifico le mie"  on public.areas for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "areas: elimino le mie"   on public.areas for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "items: leggo i miei"     on public.items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "items: inserisco i miei" on public.items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "items: modifico i miei"  on public.items for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "items: elimino i miei"   on public.items for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "work_hours: leggo i miei"     on public.work_hours for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "work_hours: inserisco i miei" on public.work_hours for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "work_hours: modifico i miei"  on public.work_hours for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "work_hours: elimino i miei"   on public.work_hours for delete to authenticated
  using ((select auth.uid()) = user_id);

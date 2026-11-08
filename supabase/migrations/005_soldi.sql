-- Migrazione 005: soldi.
--   categories   = categorie di entrata/uscita (Spesa, Bollette, Stipendio...)
--   recurring    = pagamenti ricorrenti con la prossima scadenza (affitto, luce, abbonamenti)
--   transactions = i movimenti veri: ogni entrata o uscita registrata
-- Gli importi sono sempre positivi: entrata o uscita lo dice "kind".

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  kind       text not null check (kind in ('in', 'out')),
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint categorie_nome_unico unique (user_id, kind, name)
);

create table public.recurring (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  amount       numeric(12, 2) not null check (amount > 0),   -- importo previsto (si corregge al pagamento)
  kind         text not null default 'out' check (kind in ('in', 'out')),
  category_id  uuid,
  area_id      uuid,
  every_months smallint not null default 1 check (every_months between 1 and 12),
  day_of_month smallint not null check (day_of_month between 1 and 31), -- "il 31" a febbraio diventa il 28
  next_due     date not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (area_id, user_id) references public.areas (id, user_id) on delete set null (area_id)
);

create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount       numeric(12, 2) not null check (amount > 0),
  kind         text not null check (kind in ('in', 'out')),
  date         date not null,
  description  text not null default '' check (char_length(description) <= 200),
  category_id  uuid,
  area_id      uuid,
  goal_id      uuid,   -- "questo va nell'obiettivo Viaggio"
  recurring_id uuid,   -- pagato da una scadenza ricorrente
  created_at   timestamptz not null default now(),
  foreign key (category_id, user_id)  references public.categories (id, user_id) on delete set null (category_id),
  foreign key (area_id, user_id)      references public.areas (id, user_id) on delete set null (area_id),
  foreign key (goal_id, user_id)      references public.goals (id, user_id) on delete set null (goal_id),
  foreign key (recurring_id, user_id) references public.recurring (id, user_id) on delete set null (recurring_id)
);

create index transactions_user_date_idx on public.transactions (user_id, date);
create index transactions_goal_idx on public.transactions (goal_id);

-- Permessi e RLS: come tutte le altre tabelle
revoke all on public.categories, public.recurring, public.transactions from anon;
grant select, insert, update, delete on public.categories, public.recurring, public.transactions to authenticated;

alter table public.categories   enable row level security;
alter table public.recurring    enable row level security;
alter table public.transactions enable row level security;

create policy "categories: leggo le mie"     on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories: inserisco le mie" on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories: modifico le mie"  on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories: elimino le mie"   on public.categories for delete to authenticated using ((select auth.uid()) = user_id);

create policy "recurring: leggo i miei"     on public.recurring for select to authenticated using ((select auth.uid()) = user_id);
create policy "recurring: inserisco i miei" on public.recurring for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recurring: modifico i miei"  on public.recurring for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recurring: elimino i miei"   on public.recurring for delete to authenticated using ((select auth.uid()) = user_id);

create policy "transactions: leggo i miei"     on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions: inserisco i miei" on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions: modifico i miei"  on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions: elimino i miei"   on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

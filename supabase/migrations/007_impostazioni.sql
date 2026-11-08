-- Migrazione 007: impostazioni personali (una riga per utente).
--   day_end         = fino a che ora cercare i momenti liberi in Oggi
--   morning_summary = ora del riepilogo del mattino (per le notifiche)

create table public.settings (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  day_end         time not null default '22:00',
  morning_summary time not null default '07:30',
  updated_at      timestamptz not null default now()
);

revoke all on public.settings from anon;
grant select, insert, update, delete on public.settings to authenticated;
alter table public.settings enable row level security;

create policy "settings: leggo le mie"     on public.settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "settings: inserisco le mie" on public.settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "settings: modifico le mie"  on public.settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "settings: elimino le mie"   on public.settings for delete to authenticated using ((select auth.uid()) = user_id);

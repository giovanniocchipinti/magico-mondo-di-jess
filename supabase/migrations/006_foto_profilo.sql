-- Migrazione 006: foto del profilo.
-- Uno "spazio" (bucket) privato chiamato avatars. Ogni utente ha la sua cartella, che si chiama
-- come il suo id: avatars/<id utente>/avatar.jpg. Le policy permettono di vedere e cambiare
-- SOLO i file nella propria cartella. "public = false": senza login non si vede niente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg']);   -- massimo 2 MB, solo JPEG

-- (storage.foldername(name))[1] = il primo pezzo del percorso, cioè la cartella dell'utente
create policy "avatars: vedo la mia foto" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: carico la mia foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: sostituisco la mia foto" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: elimino la mia foto" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

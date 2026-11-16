-- Sudah diterapkan ke proyek Supabase (migrasi "sorotan_warna").
alter table public.sorotan add column warna text not null default 'y' check (warna in ('y', 'g', 'b', 'p', 'o'));
create policy "sorotan milik sendiri: ubah" on public.sorotan for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant update on public.sorotan to authenticated;

-- Catatan Ibadah: hasil sesi rekam khotbah (judul, ringkasan, poin, ayat, transkrip). Audio tidak disimpan.
create table public.ibadah (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dibuat timestamptz not null default now(),
  judul text check (char_length(judul) <= 200),
  data jsonb not null check (pg_column_size(data) < 60000),
  transkrip text check (char_length(transkrip) <= 200000)
);
create index ibadah_user_dibuat_idx on public.ibadah (user_id, dibuat desc);
alter table public.ibadah enable row level security;
create policy "ibadah milik sendiri: baca" on public.ibadah for select to authenticated using ((select auth.uid()) = user_id);
create policy "ibadah milik sendiri: tambah" on public.ibadah for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ibadah milik sendiri: ubah" on public.ibadah for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ibadah milik sendiri: hapus" on public.ibadah for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.ibadah from anon;
grant select, insert, update, delete on public.ibadah to authenticated;

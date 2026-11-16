-- Sudah diterapkan ke proyek Supabase (migrasi "akun_pengguna_ayat_jurnal").
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tradisi text check (tradisi in ('katolik', 'protestan')),
  dibuat timestamptz not null default now(),
  diubah timestamptz not null default now()
);
create table public.ayat_tersimpan (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kunci text not null check (kunci ~ '^[0-9]{1,2}:[0-9]{1,3}:[0-9]{1,3}$'),
  dibuat timestamptz not null default now(),
  primary key (user_id, kunci)
);
create table public.jurnal_doa (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dibuat timestamptz not null default now(),
  cerita text check (char_length(cerita) <= 600),
  data jsonb not null check (pg_column_size(data) < 20000)
);
create index jurnal_doa_user_dibuat_idx on public.jurnal_doa (user_id, dibuat desc);
alter table public.profiles enable row level security;
alter table public.ayat_tersimpan enable row level security;
alter table public.jurnal_doa enable row level security;
create policy "profil milik sendiri: baca" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profil milik sendiri: tambah" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profil milik sendiri: ubah" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "ayat milik sendiri: baca" on public.ayat_tersimpan for select to authenticated using ((select auth.uid()) = user_id);
create policy "ayat milik sendiri: tambah" on public.ayat_tersimpan for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ayat milik sendiri: hapus" on public.ayat_tersimpan for delete to authenticated using ((select auth.uid()) = user_id);
create policy "jurnal milik sendiri: baca" on public.jurnal_doa for select to authenticated using ((select auth.uid()) = user_id);
create policy "jurnal milik sendiri: tambah" on public.jurnal_doa for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "jurnal milik sendiri: ubah" on public.jurnal_doa for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "jurnal milik sendiri: hapus" on public.jurnal_doa for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.profiles, public.ayat_tersimpan, public.jurnal_doa from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.ayat_tersimpan to authenticated;
grant select, insert, update, delete on public.jurnal_doa to authenticated;

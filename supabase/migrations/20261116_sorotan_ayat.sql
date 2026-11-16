-- Sudah diterapkan ke proyek Supabase (migrasi "sorotan_ayat").
create table public.sorotan (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kunci text not null check (kunci ~ '^[0-9]{1,2}:[0-9]{1,3}:[0-9]{1,3}$'),
  dibuat timestamptz not null default now(),
  primary key (user_id, kunci)
);
alter table public.sorotan enable row level security;
create policy "sorotan milik sendiri: baca" on public.sorotan for select to authenticated using ((select auth.uid()) = user_id);
create policy "sorotan milik sendiri: tambah" on public.sorotan for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sorotan milik sendiri: hapus" on public.sorotan for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.sorotan from anon;
grant select, insert, delete on public.sorotan to authenticated;

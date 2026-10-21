-- Schema reference for a fresh project (already applied as create_account_data).
create table public.account_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1 check (revision > 0)
);
alter table public.account_data enable row level security;
revoke all on public.account_data from anon, authenticated;
grant select, insert, update, delete on public.account_data to authenticated;
create policy own_data_select on public.account_data for select to authenticated using ((select auth.uid()) = user_id);
create policy own_data_insert on public.account_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_data_update on public.account_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_data_delete on public.account_data for delete to authenticated using ((select auth.uid()) = user_id);

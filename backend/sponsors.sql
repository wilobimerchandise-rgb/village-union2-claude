-- =====================================================================
-- VillageVault / ASSOCIET: platform-owner-only sponsor system (Supabase)
--
-- Additive migration. It does NOT touch any existing tenant table or
-- tenant RLS policy. Run it once in the SQL editor or as a migration.
--
-- Assumes these existing tables (rename in this file if yours differ):
--   public.associations(id uuid primary key)
--   public.association_members(association_id uuid, user_id uuid)
--
-- Rules implemented
--   * Only the platform owner (PLATFORM_OWNER_EMAIL) can insert, update
--     or delete sponsors. Village admins have no write permission.
--   * scope = 'global'  : shown in every village   (N18,000 per week)
--     scope = 'village' : shown in one association (N5,000 per week)
--   * Anyone can read active, unexpired GLOBAL sponsors.
--     Only members of that association can read its VILLAGE sponsors.
--   * Money is bigint kobo, never float.
--   * revenue_kobo is invisible to villages and is written only by the
--     sponsor webhook (service role) through apply_sponsor_payment().
--   * Sponsor money is recorded in sponsor_payments, separate from dues.
-- =====================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Owner identity and rates (readable only by security definer code)
-- ---------------------------------------------------------------------
create table if not exists public.platform_settings (
  key   text primary key,
  value text not null
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;   -- no policies: nobody can read it directly

insert into public.platform_settings (key, value) values
  ('platform_owner_email',          'owner@yourdomain.com'),      -- CHANGE THIS to your PLATFORM_OWNER_EMAIL
  ('sponsor_rate_global_kobo_week', '1800000'),                   -- N18,000
  ('sponsor_rate_village_kobo_week','500000')                     -- N5,000
on conflict (key) do nothing;

create or replace function public.platform_owner_check()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_settings s
    where s.key = 'platform_owner_email'
      and lower(s.value) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.platform_owner_check() from public;
grant execute on function public.platform_owner_check() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Sponsors
-- ---------------------------------------------------------------------
do $$ begin
  create type public.sponsor_scope as enum ('global', 'village');
exception when duplicate_object then null;
end $$;

create table if not exists public.sponsors (
  id                    uuid primary key default gen_random_uuid(),
  slot                  smallint not null check (slot between 1 and 3),
  scope                 public.sponsor_scope not null,
  association_id        uuid references public.associations (id) on delete cascade,
  shop_name             text not null check (char_length(shop_name) between 2 and 60),
  logo_url              text,
  whatsapp              text not null check (whatsapp ~ '^234[0-9]{10}$'),   -- e.g. 2348031234567, used for wa.me
  starts_at             timestamptz not null default now(),
  expires_at            timestamptz not null,
  is_active             boolean not null default true,
  created_by_owner_only boolean not null default true check (created_by_owner_only),
  revenue_kobo          bigint  not null default 0 check (revenue_kobo >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint sponsors_scope_matches_association
    check ((scope = 'global' and association_id is null) or (scope = 'village' and association_id is not null)),
  constraint sponsors_expiry_after_start check (expires_at > starts_at)
);

-- One live sponsor per slot: globally for GLOBAL, per association for VILLAGE
create unique index if not exists sponsors_one_active_global_per_slot
  on public.sponsors (slot) where scope = 'global' and is_active;
create unique index if not exists sponsors_one_active_village_per_slot
  on public.sponsors (association_id, slot) where scope = 'village' and is_active;
create index if not exists sponsors_association_idx on public.sponsors (association_id);

create or replace function public.sponsors_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists sponsors_touch on public.sponsors;
create trigger sponsors_touch before update on public.sponsors
  for each row execute function public.sponsors_touch_updated_at();

-- Switch off sponsors whose time has run out (so their slot can be reused).
create or replace function public.expire_sponsors()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  update public.sponsors set is_active = false where is_active and expires_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.expire_sponsors() from public, anon, authenticated;
grant execute on function public.expire_sponsors() to service_role;
-- With pg_cron enabled:  select cron.schedule('expire-sponsors', '*/15 * * * *', 'select public.expire_sponsors()');

-- ---------------------------------------------------------------------
-- 3. Row level security: read rules for everyone, write rules for the owner
-- ---------------------------------------------------------------------
alter table public.sponsors enable row level security;

-- Remove any older policy (for example a village-admin write policy)
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'sponsors' loop
    execute format('drop policy %I on public.sponsors', p.policyname);
  end loop;
end $$;

-- Public READ: active, unexpired GLOBAL sponsors are visible to everyone
create policy sponsors_read_global on public.sponsors
  for select to anon, authenticated
  using (scope = 'global' and is_active and expires_at > now());

-- VILLAGE sponsors: only members of that association can read them
create policy sponsors_read_village on public.sponsors
  for select to authenticated
  using (
    scope = 'village' and is_active and expires_at > now()
    and exists (
      select 1 from public.association_members m
      where m.association_id = sponsors.association_id
        and m.user_id = (select auth.uid())
    )
  );

-- Owner can see every row (including paused and expired)
create policy sponsors_owner_read on public.sponsors
  for select to authenticated
  using (public.platform_owner_check());

-- INSERT / UPDATE / DELETE: platform owner only. Village admins get nothing.
create policy sponsors_owner_insert on public.sponsors
  for insert to authenticated
  with check (public.platform_owner_check());

create policy sponsors_owner_update on public.sponsors
  for update to authenticated
  using (public.platform_owner_check())
  with check (public.platform_owner_check());

create policy sponsors_owner_delete on public.sponsors
  for delete to authenticated
  using (public.platform_owner_check());

-- Column privileges: villages never see revenue; revenue is never written by a client.
revoke all on public.sponsors from anon, authenticated;
grant select (id, slot, scope, association_id, shop_name, logo_url, whatsapp, starts_at, expires_at, is_active)
  on public.sponsors to anon, authenticated;
grant insert (slot, scope, association_id, shop_name, logo_url, whatsapp, starts_at, expires_at, is_active)
  on public.sponsors to authenticated;                                -- RLS still limits this to the owner
grant update (shop_name, logo_url, whatsapp, expires_at, is_active)
  on public.sponsors to authenticated;                                -- RLS still limits this to the owner
grant delete on public.sponsors to authenticated;                     -- RLS still limits this to the owner

-- ---------------------------------------------------------------------
-- 4. Sponsor payments (separate from every association's dues records)
-- ---------------------------------------------------------------------
create table if not exists public.sponsor_payments (
  id                 uuid primary key default gen_random_uuid(),
  sponsor_id         uuid references public.sponsors (id) on delete set null,
  shop_name          text not null,
  scope              public.sponsor_scope not null,
  association_id     uuid references public.associations (id) on delete set null,
  paystack_reference text not null unique,                 -- makes the webhook idempotent
  amount_kobo        bigint not null check (amount_kobo > 0),
  weeks              smallint not null check (weeks > 0),
  kind               text not null check (kind in ('new', 'renewal')),
  paid_at            timestamptz not null default now(),
  raw_event          jsonb
);
alter table public.sponsor_payments enable row level security;
revoke all on public.sponsor_payments from anon, authenticated;     -- no policies: only service role and the functions below

-- Called ONLY by the sponsor webhook (service role).
create or replace function public.apply_sponsor_payment(
  p_reference text, p_sponsor_id uuid, p_amount_kobo bigint, p_weeks integer, p_raw jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s        public.sponsors;
  per_week bigint;
  inserted integer;
begin
  select * into s from public.sponsors where id = p_sponsor_id for update;
  if not found then raise exception 'Unknown sponsor %', p_sponsor_id; end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 52 then raise exception 'Invalid weeks'; end if;

  select value::bigint into per_week from public.platform_settings
   where key = case s.scope when 'global' then 'sponsor_rate_global_kobo_week' else 'sponsor_rate_village_kobo_week' end;
  if p_amount_kobo <> per_week * p_weeks then
    raise exception 'Amount mismatch: expected % kobo, got %', per_week * p_weeks, p_amount_kobo;
  end if;

  insert into public.sponsor_payments (sponsor_id, shop_name, scope, association_id, paystack_reference, amount_kobo, weeks, kind, raw_event)
  values (s.id, s.shop_name, s.scope, s.association_id, p_reference, p_amount_kobo, p_weeks,
          case when s.revenue_kobo > 0 then 'renewal' else 'new' end, p_raw)
  on conflict (paystack_reference) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return jsonb_build_object('status', 'duplicate'); end if;

  update public.sponsors
     set revenue_kobo = revenue_kobo + p_amount_kobo,
         expires_at   = greatest(now(), expires_at) + make_interval(weeks => p_weeks),
         is_active    = true
   where id = s.id;

  return jsonb_build_object('status', 'applied', 'sponsor_id', s.id);
end $$;
revoke all on function public.apply_sponsor_payment(text, uuid, bigint, integer, jsonb) from public, anon, authenticated;
grant execute on function public.apply_sponsor_payment(text, uuid, bigint, integer, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 5. Owner-only reads (full rows with revenue, and the revenue dashboard)
-- ---------------------------------------------------------------------
create or replace function public.owner_sponsors()
returns setof public.sponsors
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.platform_owner_check() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query select * from public.sponsors order by slot, scope, created_at;
end $$;
revoke all on function public.owner_sponsors() from public, anon;
grant execute on function public.owner_sponsors() to authenticated;

create or replace function public.sponsor_revenue_summary()
returns table (month_kobo bigint, total_kobo bigint, active_slots integer, expired_slots integer)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.platform_owner_check() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select
      coalesce((select sum(p.amount_kobo) from public.sponsor_payments p
                where date_trunc('month', p.paid_at) = date_trunc('month', now())), 0)::bigint,
      coalesce((select sum(p.amount_kobo) from public.sponsor_payments p), 0)::bigint,
      (select count(*) from public.sponsors s where s.is_active and s.expires_at > now())::integer,
      (select count(*) from public.sponsors s where s.expires_at <= now())::integer;
end $$;
revoke all on function public.sponsor_revenue_summary() from public, anon;
grant execute on function public.sponsor_revenue_summary() to authenticated;

commit;

-- Quick checks after running (as a village admin these must fail or return nothing):
--   insert into public.sponsors (...) values (...);         -- denied by RLS
--   select revenue_kobo from public.sponsors;               -- permission denied (column not granted)
--   select * from public.sponsor_payments;                  -- permission denied
--   select * from public.owner_sponsors();                  -- Not allowed

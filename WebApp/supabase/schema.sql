-- ============================================================================
-- Smart Ground-Truthing and Digital Biodiversity System
-- Supabase schema: profiles, plants, storage bucket, and access rules.
--
-- HOW TO RUN THIS:
--   Supabase Dashboard -> your project -> SQL Editor -> paste this file -> Run.
--   (Or, if you use the Supabase CLI: `supabase db push`.)
--
-- There is no seed data or default admin account. The first time you sign
-- up through the app you become a 'botanist'. To make yourself an admin,
-- run this afterwards (see the bottom of this file for the exact command).
--
-- After running this, double-check Settings -> Data API in your project:
-- "Expose the public schema" and automatic exposure of new tables should
-- both be on, or `profiles` and `plants` won't be reachable from the app
-- at all, regardless of the grants and policies below.
-- ============================================================================

-- -----------------------------------------------------------------------
-- 1. PROFILES
-- Supabase Auth already keeps each user's email + password in its own
-- built-in `auth.users` table. We are not allowed to add columns to that
-- table, so we keep our own app-specific fields (name, role, active flag)
-- in a `profiles` table with the same id.
-- -----------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  email      text not null,  -- mirrored from auth.users; the app can't query that table directly
  role       text not null default 'botanist'
             check (role in ('botanist', 'conservation_officer', 'admin')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Every time someone signs up, auth.users gets a new row. This trigger
-- copies that into our `profiles` table automatically, so the app never
-- has to create a profile manually. New accounts always start as 'botanist'.
--
-- security definer: needed because there's no INSERT policy on profiles
-- for ordinary users - only this trigger is allowed to create a row.
-- search_path = '' plus fully-qualified names (public.profiles) is the
-- current recommended pattern for security definer functions; it stops
-- the function from being tricked into resolving an unqualified name to
-- some other schema. See "Function Search Path Mutable" in the Supabase
-- Security Advisor docs.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email), new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------
-- 2. PLANTS
-- One row per plant record (submitted by a botanist, reviewed by a
-- conservation officer or admin, and shown publicly once approved).
-- -----------------------------------------------------------------------
create table if not exists public.plants (
  id              bigint generated always as identity primary key,
  scientific_name text not null,
  common_name     text not null,
  family          text not null,
  genus           text not null,
  species         text not null,
  description     text,
  image_path      text,               -- public URL of the photo in Supabase Storage
  latitude        numeric(10, 7),
  longitude       numeric(10, 7),
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  submitted_by    uuid not null references public.profiles (id) on delete cascade,
  reviewed_by     uuid references public.profiles (id) on delete set null,
  review_note     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Keeps `updated_at` current whenever a record is edited. No table lookups
-- happen here (just NEW.*), so this is left as security invoker (the
-- default) rather than security definer - the least-privilege option.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plants_set_updated_at on public.plants;
create trigger plants_set_updated_at
  before update on public.plants
  for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------
-- 3. ROLE HELPERS
-- Small reusable checks used inside the access rules below, so each rule
-- reads in plain English instead of repeating the same sub-query.
--
-- security definer here means these always check the CALLING user's own
-- row in profiles, regardless of what that user's own SELECT policy on
-- profiles would otherwise let them see - which avoids any risk of these
-- checks becoming circular as the profiles policies evolve.
-- -----------------------------------------------------------------------
create or replace function public.is_reviewer()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('conservation_officer', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------
-- 4. ACCESS RULES (Row Level Security)
-- Supabase has no separate backend server, so these database-level rules
-- ARE the authorisation logic - equivalent to the role checks a custom
-- Express API would normally do.
--
-- auth.uid() and the is_reviewer()/is_admin() helpers are wrapped in
-- `(select ...)` below. That's a documented Postgres/Supabase performance
-- pattern: wrapping a stable function in a scalar subquery lets the
-- planner cache its result once per statement instead of re-running it
-- for every row the policy checks.
-- -----------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.plants   enable row level security;

-- Profiles: you can read your own profile; conservation officers and admins
-- can read everyone's (they need submitter names to review records, and
-- admins need the full list to manage accounts).
create policy "profiles_select_self_or_reviewer" on public.profiles
  for select using ((select auth.uid()) = id or (select public.is_reviewer()));

-- Profiles: only admins can change someone's role or active flag.
create policy "profiles_update_admin_only" on public.profiles
  for update using ((select public.is_admin()));

-- Plants: anyone, even signed-out visitors, can view approved species.
create policy "plants_public_read_approved" on public.plants
  for select using (status = 'approved');

-- Plants: signed-in users can also see their own submissions (any status),
-- and conservation officers / admins can see every submission.
create policy "plants_owner_or_reviewer_read" on public.plants
  for select using ((select auth.uid()) = submitted_by or (select public.is_reviewer()));

-- Plants: any signed-in user can submit a new record for themselves.
create policy "plants_insert_own" on public.plants
  for insert with check ((select auth.uid()) = submitted_by);

-- Plants: the submitter can still edit their own record while it is
-- pending; officers/admins can edit any record (e.g. to approve/reject).
create policy "plants_update_owner_pending_or_reviewer" on public.plants
  for update using (
    ((select auth.uid()) = submitted_by and status = 'pending') or (select public.is_reviewer())
  );

-- Plants: only officers/admins can delete a record.
create policy "plants_delete_reviewer_only" on public.plants
  for delete using ((select public.is_reviewer()));

-- Row Level Security only takes effect once a table grant already permits
-- the operation - a missing grant fails before RLS is even evaluated. New
-- tables aren't always auto-granted to anon/authenticated depending on
-- your project's Data API settings, so these are explicit rather than
-- assumed. RLS above still decides which individual rows are visible.
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant select, insert, update, delete on public.plants to authenticated;
grant select on public.plants to anon;

-- -----------------------------------------------------------------------
-- 5. STORAGE BUCKET FOR PLANT PHOTOS
-- Public read (so approved species photos show up on the public catalog),
-- upload restricted to signed-in users.
-- -----------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', true)
on conflict (id) do nothing;

create policy "plant_photos_public_read" on storage.objects
  for select using (bucket_id = 'plant-photos');

create policy "plant_photos_authenticated_upload" on storage.objects
  for insert with check (bucket_id = 'plant-photos' and (select auth.role()) = 'authenticated');

-- -----------------------------------------------------------------------
-- 6. FIRST-RUN ADMIN SETUP
-- There is no seed admin account. Instead, the app itself detects when
-- no admin exists yet and shows a "set up the administrator account"
-- form (see Register.jsx). These two functions are what make that safe
-- to do from the browser, without a backend server in between:
--
--   admin_exists()      - anyone can call this; it only reveals a
--                          yes/no answer, never any account details.
--   claim_first_admin() - promotes the CALLING (signed-in) user to
--                          admin, but only if no admin exists yet.
--                          Runs as a single, locked database
--                          transaction so two people can't both
--                          "win" the race to become the first admin.
--
-- Both run with security definer so they can check/update the
-- profiles table regardless of the RLS rules above.
-- -----------------------------------------------------------------------
create or replace function public.admin_exists()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where role = 'admin');
$$;

create or replace function public.claim_first_admin()
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Serializes concurrent calls for the rest of this transaction, so two
  -- people signing up at the exact same moment can't both become admin.
  perform pg_advisory_xact_lock(hashtext('claim_first_admin'));

  if auth.uid() is null then
    raise exception 'You must be signed in to claim the admin account.';
  end if;

  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'An admin account already exists.';
  end if;

  update public.profiles set role = 'admin' where id = auth.uid();
end;
$$;

-- Anyone (including signed-out visitors) may check whether setup is done;
-- only a signed-in user may attempt to claim the admin role.
revoke execute on function public.claim_first_admin() from public;
grant execute on function public.admin_exists() to anon, authenticated;
grant execute on function public.claim_first_admin() to authenticated;

-- ============================================================================
-- NO SEED DATA. The first time you sign up through the app with no admin
-- account yet, the Register page automatically offers to make that
-- account the administrator (via claim_first_admin() above).
--
-- If you'd rather do it manually instead, this works too:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
-- ============================================================================

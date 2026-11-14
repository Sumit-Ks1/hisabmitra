-- HisabMitra · 0001 · Core: profiles, roles, owners, settings, audit, notifications
-- All helper functions live in the `private` schema, which is NOT exposed through the API.

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user) and roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[6-9][0-9]{9}$'),
  language text not null default 'hinglish' check (language in ('hinglish', 'en')),
  avatar_path text,
  role text not null default 'pg_owner' check (role in ('admin', 'pg_owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Custom plans the admin can assign to an owner (default pricing lives in app_settings).
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  price_per_room numeric(10, 2) not null check (price_per_room >= 0),
  duration_months int not null default 1 check (duration_months between 1 and 36),
  building_limit int not null default 1 check (building_limit between 1 and 100),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Business account of a PG owner. Status and limits are only ever changed by
-- SECURITY DEFINER functions (never directly by the owner).
create table public.pg_owners (
  id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'onboarding' check (
    status in ('onboarding', 'submitted', 'under_review', 'payment_pending',
               'info_required', 'approved', 'rejected', 'suspended')
  ),
  onboarding_draft jsonb not null default '{}'::jsonb,
  review_note text,
  building_limit int not null default 1 check (building_limit between 0 and 100),
  room_limit int check (room_limit is null or room_limit between 1 and 2000),
  plan_id uuid references public.plans (id) on delete set null,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pg_owners_touch before update on public.pg_owners
  for each row execute function private.touch_updated_at();
create index pg_owners_status_idx on public.pg_owners (status);

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
  )
$$;

create or replace function private.is_active_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pg_owners o where o.id = (select auth.uid()) and o.status = 'approved'
  )
$$;

-- Defence in depth: even if a column grant is misconfigured later, an API user
-- can never change a role.
create or replace function private.guard_profile_role() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and current_user in ('anon', 'authenticated') then
    raise exception 'ROLE_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;
  if new.email is distinct from old.email and current_user in ('anon', 'authenticated') then
    raise exception 'EMAIL_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function private.guard_profile_role();

-- New auth user → profile + owner account. Role is ALWAYS pg_owner here.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 120)
  )
  on conflict (id) do nothing;
  insert into public.pg_owners (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Audit log, notifications, settings, rate limits
-- ---------------------------------------------------------------------------
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  owner_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_owner_idx on public.admin_audit_logs (owner_id, created_at desc);

create or replace function private.audit(
  p_action text, p_target_type text, p_target_id uuid, p_owner_id uuid, p_details jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_audit_logs (actor_id, action, target_type, target_id, owner_id, details)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, p_owner_id, coalesce(p_details, '{}'::jsonb))
$$;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function private.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link)
$$;

create or replace function private.notify_admins(p_kind text, p_title text, p_body text, p_link text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, p_kind, p_title, p_body, p_link from public.profiles p where p.role = 'admin'
$$;

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  visibility text not null default 'admin' check (visibility in ('public', 'authenticated', 'admin')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.app_settings (key, value, visibility) values
  ('pricing', '{"price_per_room": 50, "duration_months": 1, "default_building_limit": 1, "discount_percent": 0}', 'public'),
  ('support', '{"phone": "", "email": ""}', 'public'),
  ('upi', '{"upi_id": "", "payee_name": "HisabMitra"}', 'authenticated'),
  ('integrations', '{"electricity": "disabled", "whatsapp": "disabled"}', 'authenticated'),
  ('announcement', '{"message": "", "active": false}', 'authenticated')
on conflict (key) do nothing;

create table private.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null default now(),
  hits int not null default 0,
  primary key (user_id, action)
);

-- Fixed-window limiter. Returns true when the call is allowed.
create or replace function private.hit_rate_limit(p_action text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_hits int;
begin
  if v_uid is null then return false; end if;
  insert into private.rate_limits as r (user_id, action, window_start, hits)
  values (v_uid, p_action, now(), 1)
  on conflict (user_id, action) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

-- Server-side callers (Server Actions) use this wrapper. The limits are fixed
-- here so a client calling the RPC directly cannot loosen them.
create or replace function public.check_rate_limit(p_action text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_max int;
  v_window int;
begin
  case p_action
    when 'bill_fetch' then v_max := 6; v_window := 3600;
    when 'upload' then v_max := 60; v_window := 3600;
    when 'whatsapp_send' then v_max := 10; v_window := 3600;
    when 'bill_payment' then v_max := 5; v_window := 3600;
    else raise exception 'UNKNOWN_RATE_LIMIT_ACTION';
  end case;
  return private.hit_rate_limit(p_action, v_max, v_window);
end $$;

-- Generic audit trigger for admin-managed tables.
create or replace function private.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.admin_audit_logs (actor_id, action, target_type, details)
  values ((select auth.uid()), lower(tg_table_name || '.' || tg_op), tg_table_name, v_row);
  return coalesce(new, old);
end $$;
create trigger app_settings_audit after insert or update or delete on public.app_settings
  for each row execute function private.audit_row_change();
create trigger plans_audit after insert or update or delete on public.plans
  for each row execute function private.audit_row_change();

-- ---------------------------------------------------------------------------
-- Admin bootstrap. Callable ONLY with the service-role key (server side).
-- The server passes ADMIN_EMAIL from its environment; the function itself
-- re-checks that the auth user owns that email and that it is verified.
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_admin(p_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_email is null or length(trim(p_email)) = 0 then return false; end if;
  select u.id into v_id from auth.users u
   where lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is not null
   limit 1;
  if v_id is null then return false; end if;
  update public.profiles set role = 'admin' where id = v_id and role <> 'admin';
  if found then
    insert into public.admin_audit_logs (actor_id, action, target_type, target_id)
    values (v_id, 'admin.bootstrap', 'profile', v_id);
  end if;
  return true;
end $$;

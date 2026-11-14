-- HisabMitra · 0002 · Buildings, subscriptions, rooms, beds, tenants, allocations
-- Every business row carries owner_id. Composite foreign keys (child.x_id, child.owner_id)
-- guarantee at the database level that a row can never point at another owner's parent.

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.pg_owners (id) on delete cascade,
  name text not null check (length(name) between 2 and 120),
  address text not null default '',
  state text not null default 'Uttar Pradesh',
  city text not null default '',
  pincode text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  floors_count int not null default 1 check (floors_count between 1 and 50),
  rooms_count int not null check (rooms_count between 1 and 2000),
  beds_count int check (beds_count is null or beds_count between 1 and 10000),
  pg_type text not null default 'boys' check (pg_type in ('boys', 'girls', 'coliving', 'other')),
  description text,
  status text not null default 'pending' check (status in ('pending', 'active', 'archived')),
  -- billing preferences
  billing_day int not null default 1 check (billing_day between 1 and 28),
  rent_due_day int not null default 5 check (rent_due_day between 1 and 28),
  grace_days int not null default 0 check (grace_days between 0 and 30),
  late_fee_amount numeric(12, 2) not null default 0 check (late_fee_amount >= 0),
  proration_rule text not null default 'calendar' check (proration_rule in ('calendar', 'fixed30', 'full')),
  rent_basis text not null default 'bed' check (rent_basis in ('room', 'bed')),
  -- electricity preferences
  electricity_billing_day int check (electricity_billing_day is null or electricity_billing_day between 1 and 28),
  electricity_method text not null default 'submeter' check (electricity_method in ('submeter', 'proportional', 'equal', 'custom')),
  electricity_rate numeric(8, 2) not null default 0 check (electricity_rate >= 0),
  common_area_rule text not null default 'none' check (common_area_rule in ('none', 'equal', 'proportional')),
  last_cycle_check date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index buildings_owner_idx on public.buildings (owner_id);
create trigger buildings_touch before update on public.buildings
  for each row execute function private.touch_updated_at();

-- The owner's plan limit is enforced here, not in the UI.
create or replace function private.enforce_building_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_limit int;
  v_count int;
begin
  select o.building_limit into v_limit from public.pg_owners o where o.id = new.owner_id for update;
  if v_limit is null then raise exception 'OWNER_NOT_FOUND'; end if;
  select count(*) into v_count from public.buildings b
   where b.owner_id = new.owner_id and b.status <> 'archived';
  if v_count >= v_limit then
    raise exception 'BUILDING_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger buildings_limit before insert on public.buildings
  for each row execute function private.enforce_building_limit();

create table public.building_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  plan_id uuid references public.plans (id) on delete set null,
  rooms_count int not null check (rooms_count > 0),
  price_per_room numeric(10, 2) not null check (price_per_room >= 0),
  duration_months int not null check (duration_months between 1 and 36),
  discount_percent numeric(5, 2) not null default 0,
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'cancelled')),
  starts_on date,
  expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade
);
create index building_subscriptions_building_idx on public.building_subscriptions (building_id);
create index building_subscriptions_owner_idx on public.building_subscriptions (owner_id, status);
create trigger building_subscriptions_touch before update on public.building_subscriptions
  for each row execute function private.touch_updated_at();

create table public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.pg_owners (id) on delete cascade,
  subscription_id uuid not null references public.building_subscriptions (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  upi_reference text not null check (upi_reference ~ '^[A-Z0-9]{6,40}$'),
  paid_on date not null,
  screenshot_path text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
-- A reference can only be live once across the whole platform.
create unique index payment_submissions_reference_uidx
  on public.payment_submissions (upi_reference) where status <> 'rejected';
create index payment_submissions_owner_idx on public.payment_submissions (owner_id, created_at desc);
create index payment_submissions_status_idx on public.payment_submissions (status);

-- ---------------------------------------------------------------------------
-- Floors, rooms, beds
-- ---------------------------------------------------------------------------
create table public.floors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  number int not null check (number between 0 and 60),
  name text not null,
  created_at timestamptz not null default now(),
  unique (building_id, number),
  unique (id, owner_id),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  floor_id uuid not null,
  name text not null check (length(name) between 1 and 30),
  room_type text not null default 'shared' check (room_type in ('single', 'shared', 'dormitory', 'other')),
  monthly_rent numeric(12, 2) not null default 0 check (monthly_rent >= 0),
  security_deposit numeric(12, 2) not null default 0 check (security_deposit >= 0),
  maintenance boolean not null default false,
  notes text,
  -- sub-meter configuration
  meter_number text,
  meter_type text check (meter_type is null or meter_type in ('digital', 'analog', 'prepaid', 'other')),
  meter_initial_reading numeric(12, 2) not null default 0 check (meter_initial_reading >= 0),
  per_unit_rate numeric(8, 2) check (per_unit_rate is null or per_unit_rate >= 0),
  fixed_charge numeric(10, 2) not null default 0 check (fixed_charge >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade,
  foreign key (floor_id, owner_id) references public.floors (id, owner_id) on delete restrict
);
create unique index rooms_name_uidx on public.rooms (building_id, lower(name)) where deleted_at is null;
create index rooms_building_idx on public.rooms (building_id) where deleted_at is null;
create trigger rooms_touch before update on public.rooms
  for each row execute function private.touch_updated_at();

create or replace function private.enforce_room_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_limit int;
  v_count int;
begin
  perform 1 from public.buildings b where b.id = new.building_id for update;
  select coalesce(
           o.room_limit,
           (select max(s.rooms_count) from public.building_subscriptions s
             where s.building_id = b.id and s.status = 'active'),
           b.rooms_count)
    into v_limit
    from public.buildings b join public.pg_owners o on o.id = b.owner_id
   where b.id = new.building_id;
  select count(*) into v_count from public.rooms r
   where r.building_id = new.building_id and r.deleted_at is null;
  if v_count >= v_limit then
    raise exception 'ROOM_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger rooms_limit before insert on public.rooms
  for each row execute function private.enforce_room_limit();

create table public.beds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  room_id uuid not null,
  label text not null check (length(label) between 1 and 20),
  monthly_rent numeric(12, 2) check (monthly_rent is null or monthly_rent >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade,
  foreign key (room_id, owner_id) references public.rooms (id, owner_id) on delete cascade
);
create unique index beds_label_uidx on public.beds (room_id, lower(label)) where deleted_at is null;
create index beds_room_idx on public.beds (room_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  full_name text not null check (length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[6-9][0-9]{9}$'),
  email text,
  gender text check (gender is null or gender in ('male', 'female', 'other')),
  joined_on date not null,
  vacated_on date,
  billing_from date not null,
  emergency_contact text,
  occupation text,
  monthly_rent numeric(12, 2) not null check (monthly_rent >= 0),
  security_deposit numeric(12, 2) not null default 0 check (security_deposit >= 0),
  electricity_rule text not null default 'building' check (electricity_rule in ('building', 'none', 'custom')),
  electricity_custom_amount numeric(12, 2) check (electricity_custom_amount is null or electricity_custom_amount >= 0),
  notes text,
  status text not null default 'active' check (status in ('active', 'vacated')),
  documents_consent_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  check (vacated_on is null or vacated_on >= joined_on),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade
);
create index tenants_building_idx on public.tenants (building_id, status) where deleted_at is null;
create trigger tenants_touch before update on public.tenants
  for each row execute function private.touch_updated_at();

create table public.tenant_billing_preferences (
  tenant_id uuid primary key,
  owner_id uuid not null,
  proration_rule text not null default 'calendar' check (proration_rule in ('calendar', 'fixed30', 'full', 'custom')),
  first_month_amount numeric(12, 2) check (first_month_amount is null or first_month_amount >= 0),
  first_month_reason text,
  opening_balance numeric(12, 2) not null default 0 check (opening_balance >= 0),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, owner_id) references public.tenants (id, owner_id) on delete cascade,
  check (proration_rule <> 'custom' or first_month_amount is not null)
);

create table public.tenant_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  tenant_id uuid not null,
  doc_type text not null default 'other' check (doc_type in ('aadhaar', 'id_proof', 'agreement', 'other')),
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes int not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade,
  foreign key (tenant_id, owner_id) references public.tenants (id, owner_id) on delete cascade,
  -- the object must live inside the owner's own storage folder
  check (storage_path like owner_id::text || '/%' and storage_path not like '%..%')
);
create index tenant_documents_tenant_idx on public.tenant_documents (tenant_id);

-- ---------------------------------------------------------------------------
-- Room allocations: append-only history. `ended_on is null` = current allocation.
-- ---------------------------------------------------------------------------
create table public.room_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  tenant_id uuid not null,
  room_id uuid not null,
  bed_id uuid not null,
  started_on date not null,
  ended_on date,
  reason text not null default 'initial' check (reason in ('initial', 'transfer', 'swap')),
  end_reason text check (end_reason is null or end_reason in ('transfer', 'swap', 'vacated')),
  created_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade,
  foreign key (tenant_id, owner_id) references public.tenants (id, owner_id) on delete cascade,
  foreign key (room_id, owner_id) references public.rooms (id, owner_id) on delete restrict,
  foreign key (bed_id, owner_id) references public.beds (id, owner_id) on delete restrict
);
-- The two rules that make double allocation impossible, even under concurrency:
create unique index room_allocations_bed_active_uidx on public.room_allocations (bed_id) where ended_on is null;
create unique index room_allocations_tenant_active_uidx on public.room_allocations (tenant_id) where ended_on is null;
create index room_allocations_tenant_idx on public.room_allocations (tenant_id, started_on desc);
create index room_allocations_room_idx on public.room_allocations (room_id) where ended_on is null;

-- Soft-deleting an occupied bed / room is refused.
create or replace function private.guard_bed_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    if exists (select 1 from public.room_allocations a where a.bed_id = new.id and a.ended_on is null) then
      raise exception 'BED_OCCUPIED' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger beds_guard_delete before update of deleted_at on public.beds
  for each row execute function private.guard_bed_delete();

create or replace function private.guard_room_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    if exists (select 1 from public.room_allocations a where a.room_id = new.id and a.ended_on is null) then
      raise exception 'ROOM_OCCUPIED' using errcode = 'P0001';
    end if;
    update public.beds set deleted_at = now() where room_id = new.id and deleted_at is null;
  end if;
  return new;
end $$;
create trigger rooms_guard_delete before update of deleted_at on public.rooms
  for each row execute function private.guard_room_delete();

-- Rooms with live bed / occupancy counts. security_invoker keeps RLS in force.
create view public.v_rooms with (security_invoker = true) as
select r.*,
       f.number as floor_number,
       f.name as floor_name,
       (select count(*)::int from public.beds b where b.room_id = r.id and b.deleted_at is null) as bed_count,
       (select count(*)::int from public.room_allocations a where a.room_id = r.id and a.ended_on is null) as occupied_count
  from public.rooms r
  join public.floors f on f.id = r.floor_id
 where r.deleted_at is null;

-- ---------------------------------------------------------------------------
-- Owner RPCs. SECURITY INVOKER on purpose: RLS decides what the caller can
-- see, so passing another owner's ids simply finds nothing.
-- ---------------------------------------------------------------------------
create or replace function public.add_room(
  p_building uuid, p_floor_number int, p_name text, p_room_type text, p_beds int,
  p_rent numeric, p_deposit numeric, p_notes text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid;
  v_floor uuid;
  v_room uuid;
  i int;
begin
  select b.owner_id into v_owner from public.buildings b where b.id = p_building;
  if v_owner is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_beds is null or p_beds < 1 or p_beds > 30 then raise exception 'INVALID_BEDS' using errcode = 'P0001'; end if;

  insert into public.floors (owner_id, building_id, number, name)
  values (v_owner, p_building, p_floor_number,
          case when p_floor_number = 0 then 'Ground floor' else 'Floor ' || p_floor_number end)
  on conflict (building_id, number) do nothing;
  select f.id into v_floor from public.floors f where f.building_id = p_building and f.number = p_floor_number;

  insert into public.rooms (owner_id, building_id, floor_id, name, room_type, monthly_rent, security_deposit, notes)
  values (v_owner, p_building, v_floor, trim(p_name), coalesce(p_room_type, 'shared'),
          coalesce(p_rent, 0), coalesce(p_deposit, 0), nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_room;

  for i in 1..p_beds loop
    insert into public.beds (owner_id, building_id, room_id, label)
    values (v_owner, p_building, v_room, 'Bed ' || i);
  end loop;
  return v_room;
exception when unique_violation then
  raise exception 'ROOM_NAME_TAKEN' using errcode = 'P0001';
end $$;

-- Bulk setup: p_rooms = [{floor, name, room_type, beds, rent, deposit}]
create or replace function public.bulk_add_rooms(p_building uuid, p_rooms jsonb) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  r jsonb;
  n int := 0;
begin
  if jsonb_typeof(p_rooms) <> 'array' or jsonb_array_length(p_rooms) > 500 then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;
  for r in select * from jsonb_array_elements(p_rooms) loop
    perform public.add_room(
      p_building, (r ->> 'floor')::int, r ->> 'name', r ->> 'room_type', (r ->> 'beds')::int,
      (r ->> 'rent')::numeric, (r ->> 'deposit')::numeric, null);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.allocate_bed(p_tenant uuid, p_bed uuid, p_date date default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_t public.tenants%rowtype;
  v_bed public.beds%rowtype;
  v_room public.rooms%rowtype;
  v_prev public.room_allocations%rowtype;
  v_date date := coalesce(p_date, private.today());
  v_id uuid;
begin
  select * into v_t from public.tenants where id = p_tenant and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_t.status <> 'active' then raise exception 'TENANT_NOT_ACTIVE' using errcode = 'P0001'; end if;

  select * into v_bed from public.beds where id = p_bed and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_bed.building_id <> v_t.building_id then raise exception 'DIFFERENT_BUILDING' using errcode = 'P0001'; end if;

  select * into v_room from public.rooms where id = v_bed.room_id and deleted_at is null;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_room.maintenance then raise exception 'ROOM_IN_MAINTENANCE' using errcode = 'P0001'; end if;

  select * into v_prev from public.room_allocations where tenant_id = p_tenant and ended_on is null for update;
  if found then
    if v_prev.bed_id = p_bed then return v_prev.id; end if;
    update public.room_allocations
       set ended_on = greatest(v_date, started_on), end_reason = 'transfer'
     where id = v_prev.id;
  end if;

  insert into public.room_allocations (owner_id, building_id, tenant_id, room_id, bed_id, started_on, reason)
  values (v_t.owner_id, v_t.building_id, p_tenant, v_bed.room_id, p_bed, v_date,
          case when v_prev.id is null then 'initial' else 'transfer' end)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'BED_ALREADY_OCCUPIED' using errcode = 'P0001';
end $$;

create or replace function public.swap_beds(p_tenant_a uuid, p_tenant_b uuid, p_date date default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_a public.room_allocations%rowtype;
  v_b public.room_allocations%rowtype;
  v_date date := coalesce(p_date, private.today());
begin
  if p_tenant_a = p_tenant_b then raise exception 'SAME_TENANT' using errcode = 'P0001'; end if;
  -- lock in a stable order so two concurrent swaps cannot deadlock
  perform 1 from public.room_allocations
    where tenant_id in (p_tenant_a, p_tenant_b) and ended_on is null
    order by id for update;
  select * into v_a from public.room_allocations where tenant_id = p_tenant_a and ended_on is null;
  if not found then raise exception 'TENANT_NOT_ALLOCATED' using errcode = 'P0001'; end if;
  select * into v_b from public.room_allocations where tenant_id = p_tenant_b and ended_on is null;
  if not found then raise exception 'TENANT_NOT_ALLOCATED' using errcode = 'P0001'; end if;
  if v_a.building_id <> v_b.building_id then raise exception 'DIFFERENT_BUILDING' using errcode = 'P0001'; end if;

  update public.room_allocations
     set ended_on = greatest(v_date, started_on), end_reason = 'swap'
   where id in (v_a.id, v_b.id);

  insert into public.room_allocations (owner_id, building_id, tenant_id, room_id, bed_id, started_on, reason)
  values (v_a.owner_id, v_a.building_id, p_tenant_a, v_b.room_id, v_b.bed_id, v_date, 'swap'),
         (v_b.owner_id, v_b.building_id, p_tenant_b, v_a.room_id, v_a.bed_id, v_date, 'swap');
end $$;

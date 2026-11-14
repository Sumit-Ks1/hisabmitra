-- HisabMitra · 0004 · Electricity (main bill + sub-meters) and WhatsApp

-- ---------------------------------------------------------------------------
-- Main connection + DISCOM bills (one connection per building)
-- ---------------------------------------------------------------------------
create table public.electricity_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null unique,
  discom text not null check (discom in ('PVVNL', 'PUVVNL', 'MVVNL', 'DVVNL', 'KESCO', 'OTHER')),
  consumer_number text not null check (consumer_number ~ '^[A-Za-z0-9]{4,30}$'),
  connection_type text,
  meter_number text,
  billing_cycle text,
  last_fetch_at timestamptz,
  last_fetch_status text check (last_fetch_status is null or last_fetch_status in ('success', 'no_bill', 'failed', 'not_configured')),
  last_fetch_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade
);
create trigger electricity_connections_touch before update on public.electricity_connections
  for each row execute function private.touch_updated_at();

create table public.electricity_bills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  connection_id uuid not null,
  bill_month date not null check (extract(day from bill_month) = 1),
  amount numeric(12, 2) not null check (amount >= 0),
  bill_date date,
  due_date date,
  period_start date,
  period_end date,
  units numeric(12, 2),
  source text not null check (source in ('manual', 'mock', 'setu')),
  is_mock boolean generated always as (source = 'mock') stored,
  provider_ref text,
  status text not null default 'unpaid' check (status in ('unpaid', 'payment_pending', 'paid')),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (connection_id, bill_month, source),
  unique (id, owner_id),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade,
  foreign key (connection_id, owner_id) references public.electricity_connections (id, owner_id) on delete cascade
);
create index electricity_bills_building_idx on public.electricity_bills (building_id, bill_month desc);

create table public.electricity_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  bill_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  provider text not null check (provider in ('mock', 'setu', 'manual')),
  provider_ref text,
  status text not null default 'initiated' check (status in ('initiated', 'pending', 'success', 'failed', 'unknown')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade,
  foreign key (bill_id, owner_id) references public.electricity_bills (id, owner_id) on delete cascade
);
create index electricity_payments_bill_idx on public.electricity_payments (bill_id, created_at desc);
-- only one in-flight payment per bill
create unique index electricity_payments_inflight_uidx on public.electricity_payments (bill_id)
  where status in ('initiated', 'pending', 'unknown');
create trigger electricity_payments_touch before update on public.electricity_payments
  for each row execute function private.touch_updated_at();

-- A bill becomes "paid" only as a consequence of a successful payment row.
create or replace function private.electricity_payment_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'success' then
    update public.electricity_bills set status = 'paid' where id = new.bill_id;
  elsif new.status in ('initiated', 'pending', 'unknown') then
    update public.electricity_bills set status = 'payment_pending' where id = new.bill_id and status <> 'paid';
  elsif new.status = 'failed' then
    update public.electricity_bills set status = 'unpaid' where id = new.bill_id and status = 'payment_pending';
  end if;
  return null;
end $$;
create trigger electricity_payments_sync after insert or update of status on public.electricity_payments
  for each row execute function private.electricity_payment_changed();

-- ---------------------------------------------------------------------------
-- Sub-meter readings (one per room per month) and tenant allocations
-- ---------------------------------------------------------------------------
create table public.electricity_meter_readings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  room_id uuid not null,
  period_month date not null check (extract(day from period_month) = 1),
  previous_reading numeric(12, 2) not null check (previous_reading >= 0),
  current_reading numeric(12, 2) not null check (current_reading >= 0),
  units numeric(12, 2) generated always as (greatest(current_reading - previous_reading, 0)) stored,
  reading_date date not null,
  per_unit_rate numeric(8, 2) not null check (per_unit_rate >= 0),
  fixed_charge numeric(10, 2) not null default 0 check (fixed_charge >= 0),
  photo_path text,
  is_correction boolean not null default false,
  correction_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, period_month),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade,
  foreign key (room_id, owner_id) references public.rooms (id, owner_id) on delete cascade,
  check (is_correction or current_reading >= previous_reading),
  check (not is_correction or length(coalesce(correction_reason, '')) >= 3),
  check (photo_path is null or (photo_path like owner_id::text || '/%' and photo_path not like '%..%'))
);
create index electricity_meter_readings_building_idx on public.electricity_meter_readings (building_id, period_month);
create trigger electricity_meter_readings_touch before update on public.electricity_meter_readings
  for each row execute function private.touch_updated_at();

-- Saves this month's reading for a room. The previous reading always comes from
-- the database (last month's reading, else the meter's starting reading). A
-- reading lower than the previous one is refused unless it is an explicit
-- correction with a reason (meter replaced / reset).
create or replace function public.save_meter_reading(
  p_room uuid, p_month date, p_current numeric, p_reading_date date, p_rate numeric,
  p_fixed numeric default 0, p_photo_path text default null,
  p_correction boolean default false, p_correction_reason text default null,
  p_previous_override numeric default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_room public.rooms%rowtype;
  v_month date := date_trunc('month', p_month)::date;
  v_prev numeric;
  v_id uuid;
begin
  select * into v_room from public.rooms where id = p_room and deleted_at is null;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_current is null or p_current < 0 then raise exception 'INVALID_READING' using errcode = 'P0001'; end if;
  if p_rate is null or p_rate < 0 then raise exception 'INVALID_RATE' using errcode = 'P0001'; end if;

  select m.current_reading into v_prev from public.electricity_meter_readings m
   where m.room_id = p_room and m.period_month < v_month
   order by m.period_month desc limit 1;
  v_prev := coalesce(v_prev, v_room.meter_initial_reading, 0);

  if coalesce(p_correction, false) then
    if length(trim(coalesce(p_correction_reason, ''))) < 3 then
      raise exception 'REASON_REQUIRED' using errcode = 'P0001';
    end if;
    v_prev := coalesce(p_previous_override, v_prev);
  elsif p_current < v_prev then
    raise exception 'READING_DECREASED' using errcode = 'P0001';
  end if;

  insert into public.electricity_meter_readings as m
    (owner_id, building_id, room_id, period_month, previous_reading, current_reading, reading_date,
     per_unit_rate, fixed_charge, photo_path, is_correction, correction_reason)
  values
    (v_room.owner_id, v_room.building_id, p_room, v_month, v_prev, p_current, coalesce(p_reading_date, private.today()),
     p_rate, coalesce(p_fixed, 0), p_photo_path, coalesce(p_correction, false),
     case when coalesce(p_correction, false) then trim(p_correction_reason) end)
  on conflict (room_id, period_month) do update
    set previous_reading = excluded.previous_reading,
        current_reading = excluded.current_reading,
        reading_date = excluded.reading_date,
        per_unit_rate = excluded.per_unit_rate,
        fixed_charge = excluded.fixed_charge,
        photo_path = coalesce(excluded.photo_path, m.photo_path),
        is_correction = excluded.is_correction,
        correction_reason = excluded.correction_reason
  returning m.id into v_id;
  return v_id;
end $$;

create table public.electricity_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  tenant_id uuid not null,
  room_id uuid,
  period_month date not null check (extract(day from period_month) = 1),
  method text not null check (method in ('submeter', 'proportional', 'equal', 'custom')),
  units numeric(12, 2),
  base_amount numeric(12, 2) not null default 0 check (base_amount >= 0),
  common_amount numeric(12, 2) not null default 0 check (common_amount >= 0),
  amount numeric(12, 2) not null check (amount >= 0),
  confirmed_at timestamptz not null default now(),
  unique (tenant_id, period_month),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade,
  foreign key (tenant_id, owner_id) references public.tenants (id, owner_id) on delete cascade
);
create index electricity_allocations_building_idx on public.electricity_allocations (building_id, period_month);

-- Owner-reviewed charges → allocations + one "electricity" line on each tenant's
-- invoice for that month. Re-confirming replaces the earlier line (idempotent).
-- p_rows = [{tenant_id, room_id, method, units, base_amount, common_amount, amount}]
create or replace function public.confirm_electricity_charges(p_building uuid, p_month date, p_rows jsonb) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  v_b public.buildings%rowtype;
  v_month date := date_trunc('month', p_month)::date;
  r jsonb;
  v_tenant uuid;
  v_amount numeric;
  v_inv uuid;
  v_n int := 0;
begin
  select * into v_b from public.buildings where id = p_building;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  perform public.generate_invoices(p_building, v_month);

  for r in select * from jsonb_array_elements(p_rows) loop
    v_amount := round((r ->> 'amount')::numeric, 0);
    if v_amount is null or v_amount < 0 or v_amount > 1000000 then
      raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
    end if;
    select t.id into v_tenant from public.tenants t
     where t.id = (r ->> 'tenant_id')::uuid and t.building_id = p_building;
    if v_tenant is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

    select i.id into v_inv from public.invoices i where i.tenant_id = v_tenant and i.period_month = v_month;
    continue when v_inv is null;

    insert into public.electricity_allocations as a
      (owner_id, building_id, tenant_id, room_id, period_month, method, units, base_amount, common_amount, amount)
    values
      (v_b.owner_id, p_building, v_tenant, nullif(r ->> 'room_id', '')::uuid, v_month, r ->> 'method',
       nullif(r ->> 'units', '')::numeric, coalesce((r ->> 'base_amount')::numeric, 0),
       coalesce((r ->> 'common_amount')::numeric, 0), v_amount)
    on conflict (tenant_id, period_month) do update
      set room_id = excluded.room_id, method = excluded.method, units = excluded.units,
          base_amount = excluded.base_amount, common_amount = excluded.common_amount,
          amount = excluded.amount, confirmed_at = now();

    delete from public.invoice_items where invoice_id = v_inv and kind = 'electricity';
    if v_amount > 0 then
      insert into public.invoice_items (owner_id, invoice_id, kind, description, amount, source)
      values (v_b.owner_id, v_inv, 'electricity',
              'Electricity' || coalesce(' (' || nullif(r ->> 'units', '') || ' units)', ''), v_amount, 'electricity');
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- WhatsApp: consent + message log / queue
-- ---------------------------------------------------------------------------
create table public.whatsapp_consents (
  tenant_id uuid primary key,
  owner_id uuid not null,
  opted_in boolean not null default false,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  source text not null default 'owner_confirmed',
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, owner_id) references public.tenants (id, owner_id) on delete cascade
);
create trigger whatsapp_consents_touch before update on public.whatsapp_consents
  for each row execute function private.touch_updated_at();

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  tenant_id uuid not null,
  invoice_id uuid,
  period_month date not null,
  to_phone text not null check (to_phone ~ '^91[6-9][0-9]{9}$'),
  template_name text not null,
  template_params jsonb not null default '[]'::jsonb,
  body_preview text not null,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed')),
  provider_message_id text,
  error text,
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  -- one reminder per tenant per month per day → pressing the button twice cannot double-send
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade,
  foreign key (tenant_id, owner_id) references public.tenants (id, owner_id) on delete cascade
);
create index whatsapp_messages_queue_idx on public.whatsapp_messages (next_attempt_at) where status = 'queued';
create index whatsapp_messages_building_idx on public.whatsapp_messages (building_id, created_at desc);
create index whatsapp_messages_provider_idx on public.whatsapp_messages (provider_message_id);
create trigger whatsapp_messages_touch before update on public.whatsapp_messages
  for each row execute function private.touch_updated_at();

-- Worker claim (service role only): atomically takes a batch so two workers
-- never send the same message.
create or replace function public.claim_whatsapp_messages(p_limit int, p_owner uuid default null)
returns setof public.whatsapp_messages
language sql security definer set search_path = '' as $$
  update public.whatsapp_messages m
     set status = 'sending', attempts = m.attempts + 1
   where m.id in (
     select q.id from public.whatsapp_messages q
      where q.status = 'queued' and q.next_attempt_at <= now()
        and (p_owner is null or q.owner_id = p_owner)
      order by q.created_at
      limit greatest(1, least(p_limit, 50))
      for update skip locked
   )
  returning m.*
$$;

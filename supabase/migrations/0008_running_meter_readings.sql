-- HisabMitra · 0008 · Running meter readings, charged as soon as they are saved
--
-- Before: one reading per room per month, and tenants were charged in a separate
-- monthly "confirm" step.
-- Now:    every room has a running chain of readings. A new reading always starts
--         from the last saved one (whenever that was taken), and — in buildings
--         that charge by room meter — units × the building's single rate go
--         straight onto the bills of the tenants who lived in that room since the
--         previous reading, split by the days each one stayed.
--
-- Rules (enforced here, not only in the app):
--   * a new reading must be dated after the room's last reading
--   * only the latest reading of a room can be fixed or deleted (later readings
--     start from it); fixing or deleting it re-does its charges
--   * a lower reading is refused unless it is a meter replacement with a reason
--   * tenants with electricity "included in rent" or a fixed amount are never
--     charged from the meter; their share is not pushed onto room-mates
--   * a tenant/month already billed through the monthly "split the main bill"
--     step is not charged a second time

-- ---------------------------------------------------------------------------
-- 1. Readings become a chain per room
-- ---------------------------------------------------------------------------
alter table public.electricity_meter_readings
  drop constraint if exists electricity_meter_readings_room_id_period_month_key;
alter table public.electricity_meter_readings add column previous_date date;
alter table public.electricity_meter_readings add constraint electricity_meter_readings_id_owner_key unique (id, owner_id);
create index electricity_meter_readings_room_idx
  on public.electricity_meter_readings (room_id, reading_date desc, created_at desc);

update public.electricity_meter_readings m
   set previous_date = p.prev_date
  from (select id, lag(reading_date) over (partition by room_id order by reading_date, created_at) as prev_date
          from public.electricity_meter_readings) p
 where p.id = m.id;

-- ---------------------------------------------------------------------------
-- 2. A bill can carry one electricity line per reading
-- ---------------------------------------------------------------------------
alter table public.invoice_items add column meter_reading_id uuid;
alter table public.invoice_items add column units numeric(12, 2);
alter table public.invoice_items
  add constraint invoice_items_meter_reading_fkey foreign key (meter_reading_id, owner_id)
  references public.electricity_meter_readings (id, owner_id) on delete cascade;
alter table public.invoice_items drop constraint invoice_items_source_check;
alter table public.invoice_items add constraint invoice_items_source_check
  check (source in ('system', 'manual', 'electricity', 'meter'));
alter table public.invoice_items add constraint invoice_items_meter_link_check
  check ((source = 'meter') = (meter_reading_id is not null));

drop index public.invoice_items_single_uidx;
create unique index invoice_items_single_uidx on public.invoice_items (invoice_id, kind)
  where kind in ('rent', 'late_fee', 'opening_balance') or (kind = 'electricity' and meter_reading_id is null);
create unique index invoice_items_meter_uidx on public.invoice_items (meter_reading_id, invoice_id)
  where meter_reading_id is not null;

-- ---------------------------------------------------------------------------
-- 3. One rate per building: carry over the rate owners already typed per room
-- ---------------------------------------------------------------------------
update public.buildings b
   set electricity_rate = r.rate
  from (select distinct on (building_id) building_id, per_unit_rate as rate
          from public.electricity_meter_readings
         where per_unit_rate > 0
         order by building_id, reading_date desc, created_at desc) r
 where r.building_id = b.id and b.electricity_rate = 0;

-- ---------------------------------------------------------------------------
-- 4. Charging one reading
-- ---------------------------------------------------------------------------
-- (Re)writes the bill lines for one reading. Safe to call again: it first
-- removes the lines it wrote before. Returns how many tenants were charged.
create or replace function private.charge_meter_reading(p_reading uuid) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  v_r public.electricity_meter_readings%rowtype;
  v_b public.buildings%rowtype;
  v_room public.rooms%rowtype;
  v_total numeric;
  v_from date;
  v_s record;
  v_period date;
  v_inv uuid;
  v_desc text;
  v_n int := 0;
begin
  select * into v_r from public.electricity_meter_readings where id = p_reading;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  delete from public.invoice_items where meter_reading_id = p_reading;

  select * into v_b from public.buildings where id = v_r.building_id;
  -- other methods split the main bill on the monthly charges screen instead
  if v_b.electricity_method <> 'submeter' then return 0; end if;
  v_total := round(v_r.units * v_r.per_unit_rate + v_r.fixed_charge, 0);
  if v_total <= 0 then return 0; end if;

  select * into v_room from public.rooms where id = v_r.room_id;
  -- the units were used after the previous reading; for a room's first reading,
  -- since the room was set up (when its starting reading was recorded)
  v_from := coalesce(v_r.previous_date + 1, (v_room.created_at at time zone 'Asia/Kolkata')::date);
  if v_from > v_r.reading_date then v_from := v_r.reading_date; end if;

  for v_s in
    with stays as (
      -- days each tenant lived in this room within [v_from, reading_date]
      select a.tenant_id,
             sum(least(coalesce(a.ended_on, v_r.reading_date), v_r.reading_date)
                 - greatest(a.started_on, v_from) + 1) as days,
             max(least(coalesce(a.ended_on, v_r.reading_date), v_r.reading_date)) as last_day
        from public.room_allocations a
       where a.room_id = v_r.room_id
         and a.started_on <= v_r.reading_date
         and coalesce(a.ended_on, v_r.reading_date) >= v_from
       group by a.tenant_id
    ),
    w as (
      select s.tenant_id, s.last_day, t.electricity_rule, t.deleted_at,
             v_total * s.days / sum(s.days) over () as exact_amount,
             v_r.units * s.days / sum(s.days) over () as exact_units,
             count(*) over () as sharers
        from stays s join public.tenants t on t.id = s.tenant_id
       where s.days > 0
    ),
    f as (
      -- whole rupees that add up exactly to the reading's total (largest remainder)
      select w.*, floor(w.exact_amount) as base,
             row_number() over (order by w.exact_amount - floor(w.exact_amount) desc, w.tenant_id) as rn,
             v_total - sum(floor(w.exact_amount)) over () as leftover
        from w
    )
    select f.tenant_id, f.last_day, f.electricity_rule, f.deleted_at, f.sharers,
           round(f.exact_units, 2) as units,
           f.base + case when f.rn <= f.leftover then 1 else 0 end as amount
      from f
  loop
    -- "included in rent" / fixed-amount tenants: their share is not charged to anyone
    continue when v_s.electricity_rule <> 'building' or v_s.deleted_at is not null or v_s.amount <= 0;

    -- the bill for the period of the tenant's last day in this stretch
    v_period := private.period_month_for(v_b.billing_day, v_s.last_day);
    select i.id into v_inv from public.invoices i where i.tenant_id = v_s.tenant_id and i.period_month = v_period;
    if v_inv is null then
      perform public.generate_invoices(v_b.id, v_period);
      select i.id into v_inv from public.invoices i
       where i.tenant_id = v_s.tenant_id and i.period_month <= v_period
       order by i.period_month desc limit 1;
    end if;
    if v_inv is null then
      select i.id into v_inv from public.invoices i where i.tenant_id = v_s.tenant_id
       order by i.period_month limit 1;
    end if;
    continue when v_inv is null;
    -- already billed for this month through "split the main bill": do not charge twice
    continue when exists (
      select 1 from public.invoice_items x
       where x.invoice_id = v_inv and x.kind = 'electricity' and x.source = 'electricity');

    v_desc := 'Room ' || v_room.name || ': '
              || trim_scale(v_s.units)::text
              || case when v_s.sharers > 1 then ' of ' || trim_scale(v_r.units)::text else '' end
              || ' units (' || to_char(v_from, 'DD Mon') || ' – ' || to_char(v_r.reading_date, 'DD Mon') || ')';
    insert into public.invoice_items (owner_id, invoice_id, kind, description, amount, source, meter_reading_id, units)
    values (v_r.owner_id, v_inv, 'electricity', v_desc, v_s.amount, 'meter', v_r.id, v_s.units);
    perform private.apply_advance(v_s.tenant_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Saving, fixing and deleting readings
-- ---------------------------------------------------------------------------
drop function public.save_meter_reading(uuid, date, numeric, date, numeric, numeric, text, boolean, text, numeric);

-- p_reading = null → a new reading; otherwise fixes that reading (must be the room's latest).
-- The previous reading and the rate always come from the database.
create or replace function public.save_meter_reading(
  p_room uuid, p_current numeric, p_reading_date date default null,
  p_photo_path text default null, p_correction boolean default false,
  p_correction_reason text default null, p_previous_override numeric default null,
  p_reading uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_room public.rooms%rowtype;
  v_b public.buildings%rowtype;
  v_edit public.electricity_meter_readings%rowtype;
  v_last public.electricity_meter_readings%rowtype;
  v_date date := coalesce(p_reading_date, private.today());
  v_corr boolean := coalesce(p_correction, false);
  v_prev numeric;
  v_id uuid;
begin
  -- one save at a time per meter
  select * into v_room from public.rooms where id = p_room and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_current is null or p_current < 0 or p_current > 99999999 then
    raise exception 'INVALID_READING' using errcode = 'P0001';
  end if;
  if v_date > private.today() then raise exception 'INVALID_DATE' using errcode = 'P0001'; end if;
  select * into v_b from public.buildings where id = v_room.building_id;
  if v_b.electricity_method = 'submeter' and v_b.electricity_rate <= 0 then
    raise exception 'RATE_NOT_SET' using errcode = 'P0001';
  end if;

  if p_reading is not null then
    select * into v_edit from public.electricity_meter_readings where id = p_reading and room_id = p_room;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    if exists (select 1 from public.electricity_meter_readings m
                where m.room_id = p_room and m.id <> v_edit.id
                  and (m.reading_date, m.created_at) > (v_edit.reading_date, v_edit.created_at)) then
      raise exception 'NOT_LATEST_READING' using errcode = 'P0001';
    end if;
    select * into v_last from public.electricity_meter_readings m
     where m.room_id = p_room and m.id <> v_edit.id
       and (m.reading_date, m.created_at) < (v_edit.reading_date, v_edit.created_at)
     order by m.reading_date desc, m.created_at desc limit 1;
  else
    select * into v_last from public.electricity_meter_readings m
     where m.room_id = p_room order by m.reading_date desc, m.created_at desc limit 1;
  end if;

  if v_last.id is not null and v_date <= v_last.reading_date then
    raise exception 'READING_DATE_ORDER' using errcode = 'P0001';
  end if;

  v_prev := coalesce(v_last.current_reading, v_room.meter_initial_reading, 0);
  if v_corr then
    -- meter replaced / reset: counting restarts from the new meter's starting reading
    if length(trim(coalesce(p_correction_reason, ''))) < 3 then
      raise exception 'REASON_REQUIRED' using errcode = 'P0001';
    end if;
    if p_previous_override is not null and p_previous_override < 0 then
      raise exception 'INVALID_READING' using errcode = 'P0001';
    end if;
    v_prev := coalesce(p_previous_override, 0);
  end if;
  if p_current < v_prev then raise exception 'READING_DECREASED' using errcode = 'P0001'; end if;

  if p_reading is null then
    insert into public.electricity_meter_readings
      (owner_id, building_id, room_id, period_month, previous_reading, previous_date, current_reading,
       reading_date, per_unit_rate, fixed_charge, photo_path, is_correction, correction_reason)
    values
      (v_room.owner_id, v_room.building_id, p_room, private.period_month_for(v_b.billing_day, v_date),
       v_prev, v_last.reading_date, p_current, v_date, v_b.electricity_rate, 0, p_photo_path, v_corr,
       case when v_corr then trim(p_correction_reason) end)
    returning id into v_id;
  else
    update public.electricity_meter_readings
       set period_month = private.period_month_for(v_b.billing_day, v_date),
           previous_reading = v_prev,
           previous_date = v_last.reading_date,
           current_reading = p_current,
           reading_date = v_date,
           per_unit_rate = v_b.electricity_rate,
           photo_path = coalesce(p_photo_path, photo_path),
           is_correction = v_corr,
           correction_reason = case when v_corr then trim(p_correction_reason) end
     where id = v_edit.id
    returning id into v_id;
  end if;

  perform private.charge_meter_reading(v_id);
  return v_id;
end $$;

-- Deletes the room's latest reading together with the charges it created.
create or replace function public.delete_meter_reading(p_reading uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_r public.electricity_meter_readings%rowtype;
begin
  select * into v_r from public.electricity_meter_readings where id = p_reading;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform 1 from public.rooms where id = v_r.room_id for update;
  if exists (select 1 from public.electricity_meter_readings m
              where m.room_id = v_r.room_id and m.id <> v_r.id
                and (m.reading_date, m.created_at) > (v_r.reading_date, v_r.created_at)) then
    raise exception 'NOT_LATEST_READING' using errcode = 'P0001';
  end if;
  delete from public.electricity_meter_readings where id = p_reading;  -- its bill lines go with it
end $$;

-- ---------------------------------------------------------------------------
-- 6. Monthly "split the main bill" step: only for buildings not on room meters
-- ---------------------------------------------------------------------------
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
  -- room-meter buildings are charged reading by reading
  if v_b.electricity_method = 'submeter' then raise exception 'METER_MODE' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.invoice_items x join public.invoices i on i.id = x.invoice_id
              where i.building_id = p_building and i.period_month = v_month and x.meter_reading_id is not null) then
    raise exception 'METER_CHARGES_EXIST' using errcode = 'P0001';
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

    delete from public.invoice_items where invoice_id = v_inv and kind = 'electricity' and meter_reading_id is null;
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
-- 7. Invoice generation: in room-meter buildings, a tenant on a fixed monthly
--    electricity amount gets it on each new bill (others are charged per reading)
-- ---------------------------------------------------------------------------
create or replace function public.generate_invoices(p_building uuid, p_month date) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  v_b public.buildings%rowtype;
  v_month date := date_trunc('month', p_month)::date;
  v_start date;
  v_end date;
  v_due date;
  v_cycle uuid;
  v_t record;
  v_rent numeric;
  v_desc text;
  v_inv uuid;
  v_room text;
  v_created int := 0;
begin
  select * into v_b from public.buildings where id = p_building;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  v_start := v_month + (v_b.billing_day - 1);
  v_end := (v_start + interval '1 month')::date - 1;
  v_due := v_month + (v_b.rent_due_day - 1);
  if v_due < v_start then v_due := (v_due + interval '1 month')::date; end if;

  insert into public.billing_cycles (owner_id, building_id, period_month, period_start, period_end, due_date)
  values (v_b.owner_id, v_b.id, v_month, v_start, v_end, v_due)
  on conflict (building_id, period_month) do nothing;
  select id into v_cycle from public.billing_cycles where building_id = v_b.id and period_month = v_month;

  for v_t in
    select t.*, p.proration_rule as pref_rule, p.first_month_amount, p.first_month_reason, p.opening_balance
      from public.tenants t
      left join public.tenant_billing_preferences p on p.tenant_id = t.id
     where t.building_id = v_b.id
       and t.deleted_at is null
       and t.joined_on <= v_end
       and t.billing_from <= v_end
       and (t.vacated_on is null or t.vacated_on >= v_start)
       and not exists (select 1 from public.invoices i where i.tenant_id = t.id and i.period_month = v_month)
  loop
    if v_t.joined_on > v_start and v_t.joined_on = v_t.billing_from then
      -- first, partial period
      if coalesce(v_t.pref_rule, v_b.proration_rule) = 'custom' then
        v_rent := round(v_t.first_month_amount, 0);
        v_desc := 'First month rent (custom' || coalesce(': ' || nullif(v_t.first_month_reason, ''), '') || ')';
      else
        v_rent := private.prorated_rent(v_t.monthly_rent, coalesce(v_t.pref_rule, v_b.proration_rule),
                                        v_start, v_end, v_t.joined_on, v_t.vacated_on);
        v_desc := 'Rent from ' || to_char(v_t.joined_on, 'DD Mon') || ' ('
                  || ((least(coalesce(v_t.vacated_on, v_end), v_end) - v_t.joined_on) + 1) || ' days)';
      end if;
    elsif v_t.vacated_on is not null and v_t.vacated_on < v_end then
      v_rent := private.prorated_rent(v_t.monthly_rent, v_b.proration_rule, v_start, v_end, v_start, v_t.vacated_on);
      v_desc := 'Rent till ' || to_char(v_t.vacated_on, 'DD Mon') || ' ('
                || ((v_t.vacated_on - v_start) + 1) || ' days)';
    else
      v_rent := round(v_t.monthly_rent, 0);
      v_desc := 'Monthly rent';
    end if;

    select r.name into v_room
      from public.room_allocations a join public.rooms r on r.id = a.room_id
     where a.tenant_id = v_t.id and a.started_on <= v_end
     order by (a.ended_on is null) desc, a.started_on desc limit 1;

    insert into public.invoices (owner_id, building_id, cycle_id, tenant_id, period_month, period_start, period_end, due_date, room_label)
    values (v_b.owner_id, v_b.id, v_cycle, v_t.id, v_month, v_start, v_end, v_due, v_room)
    on conflict (tenant_id, period_month) do nothing
    returning id into v_inv;
    continue when v_inv is null;

    insert into public.invoice_items (owner_id, invoice_id, kind, description, amount, source)
    values (v_b.owner_id, v_inv, 'rent', v_desc, v_rent, 'system');

    if v_b.electricity_method = 'submeter' and v_t.electricity_rule = 'custom'
       and coalesce(v_t.electricity_custom_amount, 0) > 0 then
      insert into public.invoice_items (owner_id, invoice_id, kind, description, amount, source)
      values (v_b.owner_id, v_inv, 'electricity', 'Electricity (fixed monthly)', round(v_t.electricity_custom_amount, 0), 'system');
    end if;

    -- opening balance is charged once, on the tenant's very first invoice
    if coalesce(v_t.opening_balance, 0) > 0
       and not exists (select 1 from public.invoices i where i.tenant_id = v_t.id and i.id <> v_inv) then
      insert into public.invoice_items (owner_id, invoice_id, kind, description, amount, source)
      values (v_b.owner_id, v_inv, 'opening_balance', 'Previous balance (before HisabMitra)', v_t.opening_balance, 'system');
    end if;

    perform private.apply_advance(v_t.id);
    v_created := v_created + 1;
  end loop;
  return v_created;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Existing data: in room-meter buildings, replace the calculated monthly
--    lines with per-reading charges. Amounts the owner changed by hand stay.
-- ---------------------------------------------------------------------------
delete from public.invoice_items x
 using public.invoices i, public.buildings b, public.electricity_allocations a
 where x.invoice_id = i.id
   and b.id = i.building_id and b.electricity_method = 'submeter'
   and x.kind = 'electricity' and x.source = 'electricity'
   and a.tenant_id = i.tenant_id and a.period_month = i.period_month and a.method = 'submeter';
delete from public.electricity_allocations a
 using public.buildings b
 where b.id = a.building_id and b.electricity_method = 'submeter' and a.method = 'submeter';

do $$
declare
  r record;
begin
  for r in
    select m.id from public.electricity_meter_readings m
      join public.buildings b on b.id = m.building_id
     where b.electricity_method = 'submeter'
     order by m.reading_date, m.created_at
  loop
    perform private.charge_meter_reading(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Privileges
-- ---------------------------------------------------------------------------
grant delete on public.electricity_meter_readings to authenticated;
grant execute on function private.charge_meter_reading(uuid) to authenticated;
grant execute on function
  public.save_meter_reading(uuid, numeric, date, text, boolean, text, numeric, uuid),
  public.delete_meter_reading(uuid),
  public.confirm_electricity_charges(uuid, date, jsonb),
  public.generate_invoices(uuid, date)
to authenticated;
grant execute on function public.generate_invoices(uuid, date) to service_role;

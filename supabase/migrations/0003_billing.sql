-- HisabMitra · 0003 · Billing cycles, invoices, payments
-- This is a rent TRACKING ledger. Nothing here charges a tenant or moves money.

create table public.billing_cycles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  period_month date not null check (extract(day from period_month) = 1),
  period_start date not null,
  period_end date not null,
  due_date date not null,
  created_at timestamptz not null default now(),
  unique (building_id, period_month),
  unique (id, owner_id),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  cycle_id uuid not null,
  tenant_id uuid not null,
  period_month date not null,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  room_label text,
  -- totals are maintained by triggers from invoice_items / rent_payments
  rent_amount numeric(12, 2) not null default 0,
  electricity_amount numeric(12, 2) not null default 0,
  other_amount numeric(12, 2) not null default 0,
  adjustment_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  -- one invoice per tenant per month: makes generation idempotent
  unique (tenant_id, period_month),
  unique (id, owner_id),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade,
  foreign key (cycle_id, owner_id) references public.billing_cycles (id, owner_id) on delete restrict,
  foreign key (tenant_id, owner_id) references public.tenants (id, owner_id) on delete restrict
);
create index invoices_building_month_idx on public.invoices (building_id, period_month);
create index invoices_tenant_idx on public.invoices (tenant_id, period_month desc);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  invoice_id uuid not null,
  kind text not null check (kind in ('rent', 'electricity', 'other', 'late_fee', 'opening_balance', 'discount', 'adjustment')),
  description text not null default '',
  amount numeric(12, 2) not null,
  source text not null default 'manual' check (source in ('system', 'manual', 'electricity')),
  created_at timestamptz not null default now(),
  foreign key (invoice_id, owner_id) references public.invoices (id, owner_id) on delete cascade,
  check (kind in ('discount', 'adjustment') or amount >= 0),
  check (kind <> 'discount' or amount <= 0)
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id);
-- at most one system rent line / electricity line / late fee per invoice
create unique index invoice_items_single_uidx on public.invoice_items (invoice_id, kind)
  where kind in ('rent', 'electricity', 'late_fee', 'opening_balance');

create table public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  building_id uuid not null,
  tenant_id uuid not null,
  invoice_id uuid,
  kind text not null default 'rent' check (kind in ('rent', 'advance', 'deposit', 'deposit_refund')),
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null,
  method text not null check (method in ('cash', 'upi', 'bank_transfer', 'other')),
  reference text,
  notes text,
  group_id uuid not null default gen_random_uuid(),
  seq smallint not null default 0,
  idempotency_key text not null,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key),
  foreign key (building_id, owner_id) references public.buildings (id, owner_id) on delete cascade,
  foreign key (tenant_id, owner_id) references public.tenants (id, owner_id) on delete restrict,
  foreign key (invoice_id, owner_id) references public.invoices (id, owner_id) on delete restrict,
  check (kind in ('rent', 'advance') or invoice_id is null),
  check (kind <> 'rent' or invoice_id is not null)
);
create index rent_payments_tenant_idx on public.rent_payments (tenant_id, paid_on desc);
create index rent_payments_invoice_idx on public.rent_payments (invoice_id);
create index rent_payments_building_idx on public.rent_payments (building_id, paid_on desc);
-- the same transaction reference cannot be entered twice for a building
create unique index rent_payments_reference_uidx on public.rent_payments (building_id, lower(reference))
  where reference is not null and seq = 0 and voided_at is null;

-- ---------------------------------------------------------------------------
-- Total maintenance
-- ---------------------------------------------------------------------------
create or replace function private.recalc_invoice(p_invoice uuid) returns void
language sql security definer set search_path = '' as $$
  update public.invoices i set
    rent_amount = coalesce(s.rent, 0),
    electricity_amount = coalesce(s.electricity, 0),
    other_amount = coalesce(s.other, 0),
    adjustment_amount = coalesce(s.adjustment, 0),
    total_amount = greatest(coalesce(s.total, 0), 0),
    paid_amount = coalesce((select sum(p.amount) from public.rent_payments p
                             where p.invoice_id = i.id and p.voided_at is null), 0)
  from (
    select sum(amount) filter (where kind = 'rent') as rent,
           sum(amount) filter (where kind = 'electricity') as electricity,
           sum(amount) filter (where kind in ('other', 'late_fee', 'opening_balance')) as other,
           sum(amount) filter (where kind in ('discount', 'adjustment')) as adjustment,
           sum(amount) as total
      from public.invoice_items where invoice_id = p_invoice
  ) s
  where i.id = p_invoice
$$;

create or replace function private.invoice_items_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform private.recalc_invoice(old.invoice_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform private.recalc_invoice(new.invoice_id); end if;
  return null;
end $$;
create trigger invoice_items_recalc after insert or update or delete on public.invoice_items
  for each row execute function private.invoice_items_changed();

create or replace function private.rent_payments_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.invoice_id is not null then
    perform private.recalc_invoice(old.invoice_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.invoice_id is not null then
    perform private.recalc_invoice(new.invoice_id);
  end if;
  return null;
end $$;
create trigger rent_payments_recalc after insert or update or delete on public.rent_payments
  for each row execute function private.rent_payments_changed();

-- ---------------------------------------------------------------------------
-- Proration (mirrored in src/lib/billing/proration.ts — keep both in sync)
-- ---------------------------------------------------------------------------
create or replace function private.prorated_rent(
  p_rent numeric, p_rule text, p_period_start date, p_period_end date, p_from date, p_to date
) returns numeric
language plpgsql immutable as $$
declare
  v_days int := (p_period_end - p_period_start) + 1;
  v_occ int := (least(coalesce(p_to, p_period_end), p_period_end) - greatest(p_from, p_period_start)) + 1;
begin
  if v_occ <= 0 then return 0; end if;
  if v_occ >= v_days or p_rule = 'full' then return round(p_rent, 0); end if;
  if p_rule = 'fixed30' then return round(p_rent * least(v_occ, 30) / 30.0, 0); end if;
  return round(p_rent * v_occ / v_days, 0);
end $$;

-- Billing period that contains a given date, for a building's billing day.
create or replace function private.period_month_for(p_billing_day int, p_date date) returns date
language sql immutable as $$
  select case when extract(day from p_date)::int >= p_billing_day
              then date_trunc('month', p_date)::date
              else (date_trunc('month', p_date) - interval '1 month')::date end
$$;

-- Move unallocated advance money onto a tenant's unpaid invoices, oldest first.
create or replace function private.apply_advance(p_tenant uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_adv public.rent_payments%rowtype;
  v_inv record;
  v_left numeric;
  v_n int;
begin
  for v_adv in
    select * from public.rent_payments
     where tenant_id = p_tenant and kind = 'advance' and invoice_id is null and voided_at is null
     order by paid_on, created_at for update
  loop
    v_left := v_adv.amount;
    for v_inv in
      select id, total_amount - paid_amount as balance from public.invoices
       where tenant_id = p_tenant and total_amount - paid_amount > 0
       order by period_month for update
    loop
      exit when v_left <= 0;
      if v_inv.balance >= v_left then
        update public.rent_payments set invoice_id = v_inv.id, amount = v_left where id = v_adv.id;
        v_left := 0;
      else
        select count(*) into v_n from public.rent_payments where group_id = v_adv.group_id;
        insert into public.rent_payments
          (owner_id, building_id, tenant_id, invoice_id, kind, amount, paid_on, method, reference, notes,
           group_id, seq, idempotency_key)
        values
          (v_adv.owner_id, v_adv.building_id, p_tenant, v_inv.id, 'advance', v_inv.balance, v_adv.paid_on,
           v_adv.method, v_adv.reference, 'Advance adjusted', v_adv.group_id, v_n,
           v_adv.idempotency_key || ':a' || v_n);
        v_left := v_left - v_inv.balance;
        update public.rent_payments set amount = v_left where id = v_adv.id;
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Invoice generation — idempotent. Safe to call on every app open.
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

-- Flat late fee, once per invoice, only after due date + grace days.
create or replace function private.apply_late_fees(p_building uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  insert into public.invoice_items (owner_id, invoice_id, kind, description, amount, source)
  select i.owner_id, i.id, 'late_fee', 'Late fee', b.late_fee_amount, 'system'
    from public.invoices i join public.buildings b on b.id = i.building_id
   where i.building_id = p_building
     and b.late_fee_amount > 0
     and i.total_amount - i.paid_amount > 0
     and private.today() > i.due_date + b.grace_days
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Bring a building up to date: every month from the earliest tenant billing
-- start until the current period. Never creates duplicates.
create or replace function public.ensure_billing(p_building uuid, p_force boolean default false) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  v_b public.buildings%rowtype;
  v_today date := private.today();
  v_current date;
  v_from date;
  v_m date;
  v_created int := 0;
begin
  select * into v_b from public.buildings where id = p_building;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_b.status <> 'active' then return 0; end if;
  if not p_force and v_b.last_cycle_check = v_today then return 0; end if;

  v_current := private.period_month_for(v_b.billing_day, v_today);
  select min(private.period_month_for(v_b.billing_day, t.billing_from)) into v_from
    from public.tenants t where t.building_id = p_building and t.deleted_at is null;
  if v_from is not null then
    v_from := greatest(v_from, (v_current - interval '24 months')::date);
    v_m := v_from;
    while v_m <= v_current loop
      v_created := v_created + public.generate_invoices(p_building, v_m);
      v_m := (v_m + interval '1 month')::date;
    end loop;
  end if;
  perform private.apply_late_fees(p_building);
  update public.buildings set last_cycle_check = v_today where id = p_building;
  return v_created;
end $$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
-- Records a payment. Rent money is applied to the chosen invoice first, then to
-- other unpaid invoices oldest-first; anything left over is kept as advance.
-- Calling it twice with the same idempotency key records the payment once.
create or replace function public.record_payment(
  p_tenant uuid, p_invoice uuid, p_amount numeric, p_paid_on date, p_method text,
  p_reference text, p_notes text, p_kind text, p_idempotency_key text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_t public.tenants%rowtype;
  v_group uuid := gen_random_uuid();
  v_left numeric := round(p_amount, 2);
  v_ref text := nullif(trim(coalesce(p_reference, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_inv record;
  v_part numeric;
  v_seq int := 0;
  v_existing uuid;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 10000000 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'INVALID_KEY' using errcode = 'P0001';
  end if;
  if p_paid_on is null or p_paid_on > private.today() + 1 then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;

  select * into v_t from public.tenants where id = p_tenant for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  select group_id into v_existing from public.rent_payments
   where owner_id = v_t.owner_id and idempotency_key = p_idempotency_key;
  if v_existing is not null then return v_existing; end if;

  if p_kind in ('deposit', 'deposit_refund') then
    insert into public.rent_payments (owner_id, building_id, tenant_id, kind, amount, paid_on, method, reference, notes, group_id, idempotency_key)
    values (v_t.owner_id, v_t.building_id, p_tenant, p_kind, v_left, p_paid_on, p_method, v_ref, v_notes, v_group, p_idempotency_key);
    return v_group;
  elsif p_kind <> 'rent' then
    raise exception 'INVALID_KIND' using errcode = 'P0001';
  end if;

  for v_inv in
    select i.id, i.total_amount - i.paid_amount as balance
      from public.invoices i
     where i.tenant_id = p_tenant and i.total_amount - i.paid_amount > 0
     order by (i.id = p_invoice) desc, i.period_month
  loop
    exit when v_left <= 0;
    v_part := least(v_left, v_inv.balance);
    insert into public.rent_payments (owner_id, building_id, tenant_id, invoice_id, kind, amount, paid_on, method, reference, notes, group_id, seq, idempotency_key)
    values (v_t.owner_id, v_t.building_id, p_tenant, v_inv.id, 'rent', v_part, p_paid_on, p_method, v_ref, v_notes, v_group, v_seq,
            case when v_seq = 0 then p_idempotency_key else p_idempotency_key || ':' || v_seq end);
    v_left := v_left - v_part;
    v_seq := v_seq + 1;
  end loop;

  if v_left > 0 then
    insert into public.rent_payments (owner_id, building_id, tenant_id, kind, amount, paid_on, method, reference, notes, group_id, seq, idempotency_key)
    values (v_t.owner_id, v_t.building_id, p_tenant, 'advance', v_left, p_paid_on, p_method, v_ref, v_notes, v_group, v_seq,
            case when v_seq = 0 then p_idempotency_key else p_idempotency_key || ':' || v_seq end);
  end if;
  return v_group;
exception when unique_violation then
  raise exception 'DUPLICATE_REFERENCE' using errcode = 'P0001';
end $$;

-- Payments are never deleted; a mistake is voided with a reason.
create or replace function public.void_payment(p_group uuid, p_reason text) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  v_n int;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  update public.rent_payments set voided_at = now(), void_reason = trim(p_reason)
   where group_id = p_group and voided_at is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Tenant lifecycle
-- ---------------------------------------------------------------------------
-- p = {building_id, full_name, phone, whatsapp, email, gender, joined_on, emergency_contact,
--      occupation, monthly_rent, security_deposit, electricity_rule, electricity_custom_amount,
--      notes, bed_id, proration_rule, first_month_amount, first_month_reason, opening_balance,
--      whatsapp_opt_in}
create or replace function public.create_tenant(p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_b public.buildings%rowtype;
  v_id uuid;
  v_joined date := (p ->> 'joined_on')::date;
  v_current_start date;
  v_billing_from date;
  v_rule text := coalesce(nullif(p ->> 'proration_rule', ''), 'calendar');
begin
  select * into v_b from public.buildings where id = (p ->> 'building_id')::uuid;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_b.status <> 'active' then raise exception 'BUILDING_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if v_joined is null or v_joined > private.today() + 60 then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;

  -- A tenant who was already living here before the owner started using the app
  -- is billed from the current period; older dues go in as an opening balance.
  v_current_start := private.period_month_for(v_b.billing_day, private.today()) + (v_b.billing_day - 1);
  v_billing_from := greatest(v_joined, v_current_start);

  insert into public.tenants (
    owner_id, building_id, full_name, phone, whatsapp, email, gender, joined_on, billing_from,
    emergency_contact, occupation, monthly_rent, security_deposit, electricity_rule,
    electricity_custom_amount, notes)
  values (
    v_b.owner_id, v_b.id, trim(p ->> 'full_name'), p ->> 'phone', nullif(p ->> 'whatsapp', ''),
    nullif(lower(trim(coalesce(p ->> 'email', ''))), ''), nullif(p ->> 'gender', ''), v_joined, v_billing_from,
    nullif(trim(coalesce(p ->> 'emergency_contact', '')), ''), nullif(trim(coalesce(p ->> 'occupation', '')), ''),
    (p ->> 'monthly_rent')::numeric, coalesce((p ->> 'security_deposit')::numeric, 0),
    coalesce(nullif(p ->> 'electricity_rule', ''), 'building'),
    nullif(p ->> 'electricity_custom_amount', '')::numeric,
    nullif(trim(coalesce(p ->> 'notes', '')), ''))
  returning id into v_id;

  insert into public.tenant_billing_preferences (tenant_id, owner_id, proration_rule, first_month_amount, first_month_reason, opening_balance)
  values (v_id, v_b.owner_id, v_rule,
          case when v_rule = 'custom' then (p ->> 'first_month_amount')::numeric end,
          nullif(trim(coalesce(p ->> 'first_month_reason', '')), ''),
          case when v_joined < v_current_start then coalesce(nullif(p ->> 'opening_balance', '')::numeric, 0) else 0 end);

  insert into public.whatsapp_consents (tenant_id, owner_id, opted_in, opted_in_at, source)
  values (v_id, v_b.owner_id, coalesce((p ->> 'whatsapp_opt_in')::boolean, false),
          case when coalesce((p ->> 'whatsapp_opt_in')::boolean, false) then now() end, 'owner_confirmed');

  if nullif(p ->> 'bed_id', '') is not null then
    perform public.allocate_bed(v_id, (p ->> 'bed_id')::uuid, v_joined);
  end if;

  perform public.ensure_billing(v_b.id, true);
  return v_id;
end $$;

-- Vacate: closes the allocation, keeps every financial record, and (optionally)
-- adds a transparent move-out adjustment for the unused days of the period.
create or replace function public.vacate_tenant(p_tenant uuid, p_date date, p_prorate boolean default true) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_t public.tenants%rowtype;
  v_b public.buildings%rowtype;
  v_inv public.invoices%rowtype;
  v_rent numeric;
  v_new numeric;
begin
  select * into v_t from public.tenants where id = p_tenant for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_t.status = 'vacated' then raise exception 'ALREADY_VACATED' using errcode = 'P0001'; end if;
  if p_date is null or p_date < v_t.joined_on or p_date > private.today() + 60 then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;
  select * into v_b from public.buildings where id = v_t.building_id;

  update public.room_allocations
     set ended_on = greatest(p_date, started_on), end_reason = 'vacated'
   where tenant_id = p_tenant and ended_on is null;
  update public.tenants set status = 'vacated', vacated_on = p_date where id = p_tenant;

  perform public.ensure_billing(v_b.id, true);

  if p_prorate and v_b.proration_rule <> 'full' then
    select * into v_inv from public.invoices
     where tenant_id = p_tenant and period_start <= p_date and period_end > p_date;
    if found then
      select amount into v_rent from public.invoice_items where invoice_id = v_inv.id and kind = 'rent';
      v_new := private.prorated_rent(v_t.monthly_rent, v_b.proration_rule, v_inv.period_start, v_inv.period_end,
                                     greatest(v_t.joined_on, v_inv.period_start), p_date);
      if v_rent is not null and v_new < v_rent then
        insert into public.invoice_items (owner_id, invoice_id, kind, description, amount, source)
        values (v_t.owner_id, v_inv.id, 'adjustment',
                'Move-out adjustment (left on ' || to_char(p_date, 'DD Mon') || ')', v_new - v_rent, 'system');
      end if;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Read models (security_invoker → RLS applies)
-- ---------------------------------------------------------------------------
create view public.v_invoices with (security_invoker = true) as
select i.*,
       i.total_amount - i.paid_amount as balance,
       case
         when i.total_amount - i.paid_amount <= 0 then 'paid'
         when private.today() > i.due_date + b.grace_days then 'overdue'
         when i.paid_amount > 0 then 'partial'
         else 'unpaid'
       end as status
  from public.invoices i
  join public.buildings b on b.id = i.building_id;

create view public.v_tenant_balances with (security_invoker = true) as
select t.id as tenant_id,
       t.owner_id,
       t.building_id,
       coalesce(inv.total, 0) as invoiced_total,
       coalesce(inv.paid, 0) as paid_total,
       coalesce(adv.amount, 0) as advance_credit,
       coalesce(inv.total, 0) - coalesce(inv.paid, 0) - coalesce(adv.amount, 0) as balance,
       coalesce(dep.amount, 0) as deposit_held
  from public.tenants t
  left join lateral (
    select sum(i.total_amount) as total, sum(i.paid_amount) as paid
      from public.invoices i where i.tenant_id = t.id
  ) inv on true
  left join lateral (
    select sum(p.amount) as amount from public.rent_payments p
     where p.tenant_id = t.id and p.kind = 'advance' and p.invoice_id is null and p.voided_at is null
  ) adv on true
  left join lateral (
    select sum(case when p.kind = 'deposit' then p.amount else -p.amount end) as amount
      from public.rent_payments p
     where p.tenant_id = t.id and p.kind in ('deposit', 'deposit_refund') and p.voided_at is null
  ) dep on true
 where t.deleted_at is null;

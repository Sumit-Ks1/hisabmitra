-- HisabMitra · 0005 · Onboarding, subscription pricing, approval workflow, admin operations
-- Everything here is SECURITY DEFINER with explicit checks, because it touches
-- account status, limits and prices — things an owner must never write directly.

-- Price for an owner: their assigned plan if any, otherwise the global setting.
-- The amount is ALWAYS computed here; a price sent by a browser is never used.
create or replace function private.quote_subscription(p_owner uuid, p_rooms int)
returns table (plan_id uuid, price_per_room numeric, duration_months int, discount_percent numeric, amount numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_plan public.plans%rowtype;
  v_cfg jsonb;
begin
  select pl.* into v_plan from public.pg_owners o join public.plans pl on pl.id = o.plan_id
   where o.id = p_owner and pl.active;
  if found then
    plan_id := v_plan.id;
    price_per_room := v_plan.price_per_room;
    duration_months := v_plan.duration_months;
    discount_percent := v_plan.discount_percent;
  else
    select s.value into v_cfg from public.app_settings s where s.key = 'pricing';
    plan_id := null;
    price_per_room := coalesce((v_cfg ->> 'price_per_room')::numeric, 50);
    duration_months := coalesce((v_cfg ->> 'duration_months')::int, 1);
    discount_percent := coalesce((v_cfg ->> 'discount_percent')::numeric, 0);
  end if;
  amount := round(p_rooms * price_per_room * duration_months * (1 - discount_percent / 100.0), 0);
  return next;
end $$;

create or replace function public.save_onboarding_draft(p_draft jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if pg_column_size(p_draft) > 20000 then raise exception 'DRAFT_TOO_LARGE' using errcode = 'P0001'; end if;
  update public.pg_owners set onboarding_draft = coalesce(p_draft, '{}'::jsonb)
   where id = (select auth.uid()) and status in ('onboarding', 'rejected', 'info_required');
end $$;

-- p = { owner: {full_name, phone, whatsapp, language},
--       building: {name, address, state, city, pincode, floors_count, rooms_count, beds_count, pg_type, description},
--       electricity: {discom, consumer_number, connection_type, meter_number, billing_cycle} }
create or replace function public.submit_onboarding(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner public.pg_owners%rowtype;
  v_building uuid;
  v_sub uuid;
  v_rooms int := (p -> 'building' ->> 'rooms_count')::int;
  v_q record;
  v_default_limit int;
  v_has_live_payment boolean;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into v_owner from public.pg_owners where id = v_uid for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_owner.status not in ('onboarding', 'rejected', 'info_required') then
    raise exception 'ONBOARDING_LOCKED' using errcode = 'P0001';
  end if;
  if v_rooms is null or v_rooms < 1 or v_rooms > 2000 then
    raise exception 'INVALID_ROOMS' using errcode = 'P0001';
  end if;

  update public.profiles set
    full_name = left(trim(p -> 'owner' ->> 'full_name'), 120),
    phone = p -> 'owner' ->> 'phone',
    whatsapp = nullif(p -> 'owner' ->> 'whatsapp', ''),
    language = coalesce(nullif(p -> 'owner' ->> 'language', ''), 'hinglish')
  where id = v_uid;

  select b.id into v_building from public.buildings b
   where b.owner_id = v_uid and b.status = 'pending' order by b.created_at limit 1;

  if v_building is null then
    insert into public.buildings (owner_id, name, address, state, city, pincode, floors_count, rooms_count, beds_count, pg_type, description)
    values (v_uid, trim(p -> 'building' ->> 'name'), trim(coalesce(p -> 'building' ->> 'address', '')),
            coalesce(nullif(p -> 'building' ->> 'state', ''), 'Uttar Pradesh'), trim(coalesce(p -> 'building' ->> 'city', '')),
            nullif(p -> 'building' ->> 'pincode', ''), coalesce((p -> 'building' ->> 'floors_count')::int, 1), v_rooms,
            nullif(p -> 'building' ->> 'beds_count', '')::int, coalesce(nullif(p -> 'building' ->> 'pg_type', ''), 'boys'),
            nullif(trim(coalesce(p -> 'building' ->> 'description', '')), ''))
    returning id into v_building;
  else
    update public.buildings set
      name = trim(p -> 'building' ->> 'name'),
      address = trim(coalesce(p -> 'building' ->> 'address', '')),
      state = coalesce(nullif(p -> 'building' ->> 'state', ''), 'Uttar Pradesh'),
      city = trim(coalesce(p -> 'building' ->> 'city', '')),
      pincode = nullif(p -> 'building' ->> 'pincode', ''),
      floors_count = coalesce((p -> 'building' ->> 'floors_count')::int, 1),
      rooms_count = v_rooms,
      beds_count = nullif(p -> 'building' ->> 'beds_count', '')::int,
      pg_type = coalesce(nullif(p -> 'building' ->> 'pg_type', ''), 'boys'),
      description = nullif(trim(coalesce(p -> 'building' ->> 'description', '')), '')
    where id = v_building;
  end if;

  if nullif(p -> 'electricity' ->> 'consumer_number', '') is not null then
    insert into public.electricity_connections as c (owner_id, building_id, discom, consumer_number, connection_type, meter_number, billing_cycle)
    values (v_uid, v_building, p -> 'electricity' ->> 'discom', p -> 'electricity' ->> 'consumer_number',
            nullif(p -> 'electricity' ->> 'connection_type', ''), nullif(p -> 'electricity' ->> 'meter_number', ''),
            nullif(p -> 'electricity' ->> 'billing_cycle', ''))
    on conflict (building_id) do update
      set discom = excluded.discom, consumer_number = excluded.consumer_number,
          connection_type = excluded.connection_type, meter_number = excluded.meter_number,
          billing_cycle = excluded.billing_cycle;
  end if;

  select * into v_q from private.quote_subscription(v_uid, v_rooms);

  select s.id into v_sub from public.building_subscriptions s
   where s.building_id = v_building and s.status = 'pending' order by s.created_at desc limit 1;
  if v_sub is null then
    insert into public.building_subscriptions (owner_id, building_id, plan_id, rooms_count, price_per_room, duration_months, discount_percent, amount)
    values (v_uid, v_building, v_q.plan_id, v_rooms, v_q.price_per_room, v_q.duration_months, v_q.discount_percent, v_q.amount)
    returning id into v_sub;
  else
    update public.building_subscriptions set
      plan_id = v_q.plan_id, rooms_count = v_rooms, price_per_room = v_q.price_per_room,
      duration_months = v_q.duration_months, discount_percent = v_q.discount_percent, amount = v_q.amount
    where id = v_sub;
  end if;

  -- Correcting details after "more information required": if a payment for the
  -- same amount is already on file, go straight back into the review queue.
  select exists (
    select 1 from public.payment_submissions ps
     where ps.subscription_id = v_sub and ps.status in ('pending', 'verified') and ps.amount = v_q.amount
  ) into v_has_live_payment;

  update public.pg_owners set
    onboarding_draft = '{}'::jsonb,
    status = case when v_has_live_payment then 'submitted' else 'onboarding' end,
    submitted_at = case when v_has_live_payment then now() else submitted_at end
  where id = v_uid;

  if v_has_live_payment then
    perform private.audit('owner.resubmitted', 'pg_owner', v_uid, v_uid, '{}'::jsonb);
    perform private.notify_admins('review', 'Application resubmitted', 'An owner updated their details.', '/admin/owners/' || v_uid);
  end if;

  return jsonb_build_object(
    'building_id', v_building, 'subscription_id', v_sub, 'rooms_count', v_rooms,
    'price_per_room', v_q.price_per_room, 'duration_months', v_q.duration_months,
    'discount_percent', v_q.discount_percent, 'amount', v_q.amount,
    'awaiting_payment', not v_has_live_payment);
end $$;

-- A submitted reference is a CLAIM, never proof. It only moves the account into
-- the admin review queue.
create or replace function public.submit_payment(p_reference text, p_paid_on date, p_screenshot_path text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner public.pg_owners%rowtype;
  v_sub public.building_subscriptions%rowtype;
  v_ref text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  v_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if not private.hit_rate_limit('payment_submission', 5, 3600) then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  select * into v_owner from public.pg_owners where id = v_uid for update;
  if v_owner.status not in ('onboarding', 'rejected', 'info_required', 'payment_pending') then
    raise exception 'ONBOARDING_LOCKED' using errcode = 'P0001';
  end if;
  if v_ref !~ '^[A-Z0-9]{6,40}$' then raise exception 'INVALID_REFERENCE' using errcode = 'P0001'; end if;
  if p_paid_on is null or p_paid_on > private.today() + 1 or p_paid_on < private.today() - 60 then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;
  if p_screenshot_path is not null
     and (p_screenshot_path not like v_uid::text || '/%' or p_screenshot_path like '%..%') then
    raise exception 'INVALID_PATH' using errcode = 'P0001';
  end if;

  select * into v_sub from public.building_subscriptions
   where owner_id = v_uid and status = 'pending' order by created_at desc limit 1;
  if not found then raise exception 'NO_PENDING_SUBSCRIPTION' using errcode = 'P0001'; end if;

  -- an earlier unreviewed claim for this subscription is superseded
  update public.payment_submissions
     set status = 'rejected', review_note = 'Replaced by a newer submission', reviewed_at = now()
   where subscription_id = v_sub.id and status = 'pending';

  begin
    insert into public.payment_submissions (owner_id, subscription_id, amount, upi_reference, paid_on, screenshot_path)
    values (v_uid, v_sub.id, v_sub.amount, v_ref, p_paid_on, p_screenshot_path)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'DUPLICATE_REFERENCE' using errcode = 'P0001';
  end;

  update public.pg_owners set status = 'submitted', submitted_at = now(), review_note = null where id = v_uid;
  perform private.audit('owner.payment_submitted', 'payment_submission', v_id, v_uid,
                        jsonb_build_object('amount', v_sub.amount));
  perform private.notify_admins('review', 'New application to review', 'A PG owner submitted payment details.', '/admin/owners/' || v_uid);
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Admin operations — each one re-checks the admin role and writes the audit log
-- ---------------------------------------------------------------------------
create or replace function private.require_admin() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
end $$;

create or replace function public.admin_review_payment(p_payment uuid, p_verified boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.payment_submissions%rowtype;
begin
  perform private.require_admin();
  select * into v_p from public.payment_submissions where id = p_payment for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_p.status <> 'pending' then raise exception 'ALREADY_REVIEWED' using errcode = 'P0001'; end if;
  if not p_verified and length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  update public.payment_submissions
     set status = case when p_verified then 'verified' else 'rejected' end,
         reviewed_by = (select auth.uid()), reviewed_at = now(), review_note = nullif(trim(coalesce(p_note, '')), '')
   where id = p_payment;

  if p_verified then
    perform private.notify(v_p.owner_id, 'payment', 'Payment verified', 'Aapka payment verify ho gaya hai.', '/onboarding/status');
  else
    update public.pg_owners set status = 'payment_pending', review_note = trim(p_note)
     where id = v_p.owner_id and status in ('submitted', 'under_review', 'payment_pending');
    perform private.notify(v_p.owner_id, 'payment', 'Payment could not be verified', trim(p_note), '/onboarding/status');
  end if;
  perform private.audit(case when p_verified then 'payment.verified' else 'payment.rejected' end,
                        'payment_submission', p_payment, v_p.owner_id,
                        jsonb_build_object('amount', v_p.amount, 'note', p_note));
end $$;

-- p_action: under_review | approve | reject | request_info | suspend | reactivate
create or replace function public.admin_review_owner(p_owner uuid, p_action text, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_o public.pg_owners%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_sub record;
begin
  perform private.require_admin();
  select * into v_o from public.pg_owners where id = p_owner for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  if p_action = 'under_review' then
    if v_o.status not in ('submitted', 'payment_pending') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
    update public.pg_owners set status = 'under_review' where id = p_owner;

  elsif p_action = 'approve' then
    if v_o.status not in ('submitted', 'under_review', 'payment_pending', 'info_required', 'rejected') then
      raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.buildings b where b.owner_id = p_owner) then
      raise exception 'NO_BUILDING' using errcode = 'P0001';
    end if;
    -- approval needs money to be accounted for: a verified payment, or a
    -- subscription the admin has already activated by hand
    if not exists (select 1 from public.payment_submissions ps where ps.owner_id = p_owner and ps.status = 'verified')
       and not exists (select 1 from public.building_subscriptions s where s.owner_id = p_owner and s.status = 'active') then
      raise exception 'PAYMENT_NOT_VERIFIED' using errcode = 'P0001';
    end if;
    for v_sub in
      select s.id, s.duration_months, s.building_id from public.building_subscriptions s
       where s.owner_id = p_owner and s.status = 'pending'
         and exists (select 1 from public.payment_submissions ps where ps.subscription_id = s.id and ps.status = 'verified')
    loop
      update public.building_subscriptions
         set status = 'active', starts_on = private.today(),
             expires_on = (private.today() + make_interval(months => v_sub.duration_months))::date
       where id = v_sub.id;
    end loop;
    update public.buildings set status = 'active' where owner_id = p_owner and status = 'pending';
    update public.pg_owners set status = 'approved', review_note = null, approved_at = now(), approved_by = (select auth.uid())
     where id = p_owner;
    perform private.notify(p_owner, 'approval', 'Account approved', 'Badhai ho! Aapka HisabMitra account approve ho gaya hai.', '/app');

  elsif p_action in ('reject', 'request_info') then
    if v_note is null or length(v_note) < 3 then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
    if v_o.status = 'approved' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
    update public.pg_owners
       set status = case when p_action = 'reject' then 'rejected' else 'info_required' end, review_note = v_note
     where id = p_owner;
    perform private.notify(p_owner, 'approval',
      case when p_action = 'reject' then 'Application rejected' else 'More information required' end, v_note, '/onboarding/status');

  elsif p_action = 'suspend' then
    if v_note is null or length(v_note) < 3 then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
    if v_o.status <> 'approved' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
    update public.pg_owners set status = 'suspended', review_note = v_note where id = p_owner;
    perform private.notify(p_owner, 'approval', 'Account suspended', v_note, '/onboarding/status');

  elsif p_action = 'reactivate' then
    if v_o.status <> 'suspended' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
    update public.pg_owners set status = 'approved', review_note = null where id = p_owner;
    perform private.notify(p_owner, 'approval', 'Account reactivated', 'Aapka account phir se active hai.', '/app');

  else
    raise exception 'INVALID_ACTION' using errcode = 'P0001';
  end if;

  perform private.audit('owner.' || p_action, 'pg_owner', p_owner, p_owner, jsonb_build_object('note', v_note, 'from', v_o.status));
end $$;

create or replace function public.admin_update_owner_limits(
  p_owner uuid, p_building_limit int, p_room_limit int, p_plan uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_o public.pg_owners%rowtype;
begin
  perform private.require_admin();
  select * into v_o from public.pg_owners where id = p_owner for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_building_limit is null or p_building_limit < 1 or p_building_limit > 100 then
    raise exception 'INVALID_LIMIT' using errcode = 'P0001';
  end if;
  update public.pg_owners set building_limit = p_building_limit, room_limit = p_room_limit, plan_id = p_plan
   where id = p_owner;
  perform private.audit('owner.limits_changed', 'pg_owner', p_owner, p_owner, jsonb_build_object(
    'building_limit', jsonb_build_array(v_o.building_limit, p_building_limit),
    'room_limit', jsonb_build_array(v_o.room_limit, p_room_limit),
    'plan_id', jsonb_build_array(v_o.plan_id, p_plan)));
end $$;

create or replace function public.admin_update_subscription(
  p_subscription uuid, p_status text, p_expires_on date, p_rooms_count int
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.building_subscriptions%rowtype;
begin
  perform private.require_admin();
  select * into v_s from public.building_subscriptions where id = p_subscription for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_status not in ('pending', 'active', 'expired', 'cancelled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if p_rooms_count is null or p_rooms_count < 1 then raise exception 'INVALID_ROOMS' using errcode = 'P0001'; end if;
  update public.building_subscriptions
     set status = p_status,
         expires_on = p_expires_on,
         starts_on = case when p_status = 'active' then coalesce(starts_on, private.today()) else starts_on end,
         rooms_count = p_rooms_count
   where id = p_subscription;
  perform private.audit('subscription.updated', 'building_subscription', p_subscription, v_s.owner_id, jsonb_build_object(
    'status', jsonb_build_array(v_s.status, p_status),
    'expires_on', jsonb_build_array(v_s.expires_on, p_expires_on),
    'rooms_count', jsonb_build_array(v_s.rooms_count, p_rooms_count)));
  if p_status = 'active' and v_s.status <> 'active' then
    perform private.notify(v_s.owner_id, 'subscription', 'Subscription active',
      'Valid till ' || coalesce(to_char(p_expires_on, 'DD Mon YYYY'), '-'), '/app/settings');
  end if;
end $$;

-- Owner adds another building (only possible when the admin has raised the
-- limit — the trigger on buildings enforces it). The building rides on the
-- owner's existing subscription term; the admin manages renewals.
create or replace function public.add_building(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_rooms int := (p ->> 'rooms_count')::int;
  v_id uuid;
  v_q record;
  v_expiry date;
begin
  if not private.is_active_owner() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_rooms is null or v_rooms < 1 or v_rooms > 2000 then raise exception 'INVALID_ROOMS' using errcode = 'P0001'; end if;

  insert into public.buildings (owner_id, name, address, state, city, pincode, floors_count, rooms_count, pg_type, status)
  values (v_uid, trim(p ->> 'name'), trim(coalesce(p ->> 'address', '')), coalesce(nullif(p ->> 'state', ''), 'Uttar Pradesh'),
          trim(coalesce(p ->> 'city', '')), nullif(p ->> 'pincode', ''), coalesce((p ->> 'floors_count')::int, 1),
          v_rooms, coalesce(nullif(p ->> 'pg_type', ''), 'boys'), 'active')
  returning id into v_id;

  select * into v_q from private.quote_subscription(v_uid, v_rooms);
  select max(s.expires_on) into v_expiry from public.building_subscriptions s
   where s.owner_id = v_uid and s.status = 'active';
  insert into public.building_subscriptions (owner_id, building_id, plan_id, rooms_count, price_per_room, duration_months, discount_percent, amount, status, starts_on, expires_on)
  values (v_uid, v_id, v_q.plan_id, v_rooms, v_q.price_per_room, v_q.duration_months, v_q.discount_percent, v_q.amount,
          'active', private.today(), v_expiry);

  perform private.audit('owner.building_added', 'building', v_id, v_uid, jsonb_build_object('rooms', v_rooms));
  perform private.notify_admins('info', 'Owner added a building', trim(p ->> 'name'), '/admin/owners/' || v_uid);
  return v_id;
end $$;

-- Daily housekeeping (service role / cron): expire subscriptions and warn owners.
create or replace function public.run_daily_maintenance() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_expired int;
  v_warned int;
begin
  with e as (
    update public.building_subscriptions set status = 'expired'
     where status = 'active' and expires_on is not null and expires_on < private.today()
    returning owner_id
  ), n as (
    insert into public.notifications (user_id, kind, title, body, link)
    select distinct owner_id, 'subscription', 'Subscription expired',
           'Aapka subscription khatam ho gaya hai. Renew karne ke liye support se sampark karein.', '/app/settings'
      from e returning 1
  ) select count(*) into v_expired from n;

  with w as (
    insert into public.notifications (user_id, kind, title, body, link)
    select distinct s.owner_id, 'subscription', 'Subscription expiring soon',
           'Valid till ' || to_char(s.expires_on, 'DD Mon YYYY'), '/app/settings'
      from public.building_subscriptions s
     where s.status = 'active' and s.expires_on = private.today() + 5
    returning 1
  ) select count(*) into v_warned from w;

  return jsonb_build_object('expired', v_expired, 'warned', v_warned);
end $$;

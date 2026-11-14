-- HisabMitra · 0006 · Row Level Security, privileges
-- Isolation model:
--   * every business row has owner_id; an owner sees only owner_id = auth.uid()
--   * owners can WRITE only while their account is approved (private.is_active_owner())
--   * the admin can read account-level data (owners, buildings, subscriptions, payments)
--     but NOT tenant personal data, documents or tenant ledgers
--   * status, limits, prices, roles and payment verification are never writable by owners

-- Start from zero: nothing is reachable unless granted below.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
alter table private.rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Account-level tables
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone, whatsapp, language, avatar_path) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select on public.pg_owners to authenticated;
create policy pg_owners_select on public.pg_owners for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());

grant select on public.plans to authenticated;
grant insert, update, delete on public.plans to authenticated;
create policy plans_select on public.plans for select to authenticated
  using (private.is_admin() or id = (select o.plan_id from public.pg_owners o where o.id = (select auth.uid())));
create policy plans_admin_insert on public.plans for insert to authenticated with check (private.is_admin());
create policy plans_admin_update on public.plans for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy plans_admin_delete on public.plans for delete to authenticated using (private.is_admin());

grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;
create policy app_settings_public on public.app_settings for select to anon using (visibility = 'public');
create policy app_settings_select on public.app_settings for select to authenticated
  using (visibility in ('public', 'authenticated') or private.is_admin());
create policy app_settings_admin_insert on public.app_settings for insert to authenticated with check (private.is_admin());
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

grant select on public.admin_audit_logs to authenticated;
create policy admin_audit_logs_select on public.admin_audit_logs for select to authenticated using (private.is_admin());

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Owner-readable, admin-readable; written only through SECURITY DEFINER RPCs
-- ---------------------------------------------------------------------------
grant select on public.building_subscriptions, public.payment_submissions to authenticated;
create policy building_subscriptions_select on public.building_subscriptions for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_admin());
create policy payment_submissions_select on public.payment_submissions for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_admin());

-- Buildings: owners edit details and preferences; never owner, status or room count.
grant select on public.buildings to authenticated;
grant update (name, address, state, city, pincode, floors_count, beds_count, pg_type, description,
              billing_day, rent_due_day, grace_days, late_fee_amount, proration_rule, rent_basis,
              electricity_billing_day, electricity_method, electricity_rate, common_area_rule, last_cycle_check)
  on public.buildings to authenticated;
create policy buildings_select on public.buildings for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_admin());
create policy buildings_update on public.buildings for update to authenticated
  using (owner_id = (select auth.uid()) and private.is_active_owner())
  with check (owner_id = (select auth.uid()) and private.is_active_owner());

-- ---------------------------------------------------------------------------
-- Owner business tables: identical owner-only policies
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  admin_readable text[] := array['rooms', 'floors', 'electricity_connections'];
begin
  foreach t in array array[
    'floors', 'rooms', 'beds', 'tenants', 'tenant_billing_preferences', 'tenant_documents',
    'room_allocations', 'billing_cycles', 'invoices', 'invoice_items', 'rent_payments',
    'electricity_connections', 'electricity_bills', 'electricity_payments',
    'electricity_meter_readings', 'electricity_allocations', 'whatsapp_consents', 'whatsapp_messages'
  ] loop
    execute format('grant select on public.%I to authenticated', t);
    if t = any (admin_readable) then
      execute format(
        'create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()) or private.is_admin())',
        t || '_select', t);
    else
      execute format(
        'create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()))',
        t || '_select', t);
    end if;
  end loop;

  -- tables the owner may write directly (still only their own rows, only while approved)
  foreach t in array array[
    'floors', 'rooms', 'beds', 'tenants', 'tenant_billing_preferences', 'tenant_documents',
    'room_allocations', 'billing_cycles', 'invoices', 'invoice_items', 'rent_payments',
    'electricity_connections', 'electricity_meter_readings', 'electricity_allocations', 'whatsapp_consents'
  ] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner_id = (select auth.uid()) and private.is_active_owner())',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (owner_id = (select auth.uid()) and private.is_active_owner()) with check (owner_id = (select auth.uid()) and private.is_active_owner())',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (owner_id = (select auth.uid()) and private.is_active_owner())',
      t || '_delete', t);
  end loop;
end $$;

-- Column / verb level privileges (policies above only matter where a grant exists)
grant insert, update on public.floors, public.rooms, public.beds to authenticated;
grant insert, update on public.tenants, public.tenant_billing_preferences to authenticated;
grant insert, delete on public.tenant_documents to authenticated;
grant insert on public.room_allocations to authenticated;
grant update (ended_on, end_reason) on public.room_allocations to authenticated;
grant insert on public.billing_cycles, public.invoices to authenticated;
grant insert, update, delete on public.invoice_items to authenticated;
grant insert on public.rent_payments to authenticated;
grant update (voided_at, void_reason) on public.rent_payments to authenticated;
grant insert, update on public.electricity_connections to authenticated;
grant insert, update on public.electricity_meter_readings, public.electricity_allocations to authenticated;
grant insert, update on public.whatsapp_consents to authenticated;

-- DISCOM bills: an owner may only hand-enter bills. Provider-fetched bills
-- (mock / setu) and all bill payments are written by the server after it has
-- talked to the provider, so a browser can never forge "fetched" or "paid".
grant insert, delete on public.electricity_bills to authenticated;
grant update (amount, bill_date, due_date, period_start, period_end, units) on public.electricity_bills to authenticated;
create policy electricity_bills_insert on public.electricity_bills for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.is_active_owner() and source = 'manual');
create policy electricity_bills_update on public.electricity_bills for update to authenticated
  using (owner_id = (select auth.uid()) and private.is_active_owner() and source = 'manual')
  with check (owner_id = (select auth.uid()) and source = 'manual');
create policy electricity_bills_delete on public.electricity_bills for delete to authenticated
  using (owner_id = (select auth.uid()) and private.is_active_owner() and source = 'manual' and status = 'unpaid');

-- Views
grant select on public.v_rooms, public.v_invoices, public.v_tenant_balances to authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
grant execute on all functions in schema private to anon, authenticated, service_role;

grant execute on function
  public.check_rate_limit(text),
  public.save_onboarding_draft(jsonb),
  public.submit_onboarding(jsonb),
  public.submit_payment(text, date, text),
  public.add_building(jsonb),
  public.add_room(uuid, int, text, text, int, numeric, numeric, text),
  public.bulk_add_rooms(uuid, jsonb),
  public.allocate_bed(uuid, uuid, date),
  public.swap_beds(uuid, uuid, date),
  public.create_tenant(jsonb),
  public.vacate_tenant(uuid, date, boolean),
  public.generate_invoices(uuid, date),
  public.ensure_billing(uuid, boolean),
  public.record_payment(uuid, uuid, numeric, date, text, text, text, text, text),
  public.void_payment(uuid, text),
  public.save_meter_reading(uuid, date, numeric, date, numeric, numeric, text, boolean, text, numeric),
  public.confirm_electricity_charges(uuid, date, jsonb),
  public.admin_review_payment(uuid, boolean, text),
  public.admin_review_owner(uuid, text, text),
  public.admin_update_owner_limits(uuid, int, int, uuid),
  public.admin_update_subscription(uuid, text, date, int)
to authenticated;

-- service-role only
grant execute on function
  public.bootstrap_admin(text),
  public.claim_whatsapp_messages(int, uuid),
  public.run_daily_maintenance(),
  public.generate_invoices(uuid, date),
  public.ensure_billing(uuid, boolean)
to service_role;
grant all on all tables in schema public to service_role;
grant all on private.rate_limits to service_role;

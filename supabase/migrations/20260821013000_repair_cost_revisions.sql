-- Audited, tenant-scoped repair pricing with included VAT and atomic inventory.

alter table public.organization_settings
  add column if not exists repair_max_discount_percent numeric(5, 2) not null default 20,
  add column if not exists repair_labor_tax_rate numeric(5, 2) not null default 10;

alter table public.products
  add column if not exists tax_rate numeric(5, 2);

alter table public.repair_parts
  add column if not exists discount_amount numeric(14, 2) not null default 0,
  add column if not exists tax_rate numeric(5, 2) not null default 10;

alter table public.repairs
  add column if not exists additional_charges numeric(14, 2) not null default 0,
  add column if not exists deductions numeric(14, 2) not null default 0,
  add column if not exists current_cost_revision_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_settings_repair_discount_check'
  ) then
    alter table public.organization_settings add constraint organization_settings_repair_discount_check
      check (repair_max_discount_percent between 0 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'organization_settings_repair_labor_tax_check'
  ) then
    alter table public.organization_settings add constraint organization_settings_repair_labor_tax_check
      check (repair_labor_tax_rate in (0, 5, 10));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'products_tax_rate_check'
  ) then
    alter table public.products add constraint products_tax_rate_check
      check (tax_rate is null or tax_rate in (0, 5, 10));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'repair_parts_financial_values_check'
  ) then
    alter table public.repair_parts add constraint repair_parts_financial_values_check
      check (discount_amount >= 0 and tax_rate in (0, 5, 10));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'repairs_adjustments_nonnegative_check'
  ) then
    alter table public.repairs add constraint repairs_adjustments_nonnegative_check
      check (additional_charges >= 0 and deductions >= 0);
  end if;
end;
$$;

update public.products product
set tax_rate = coalesce(settings.repair_labor_tax_rate, 10)
from public.organization_settings settings
where settings.organization_id = product.organization_id
  and product.tax_rate is null;

update public.products set tax_rate = 10 where tax_rate is null;

update public.repair_parts part
set tax_rate = coalesce(
  (select product.tax_rate from public.products product where product.id = part.product_id),
  (select settings.repair_labor_tax_rate
   from public.organization_settings settings
   join public.repairs repair on repair.organization_id = settings.organization_id
   where repair.id = part.repair_id),
  10
);

create table if not exists public.repair_cost_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_id uuid not null references public.repairs(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  actor_id uuid,
  actor_role text not null,
  reason text,
  labor_amount numeric(14, 2) not null check (labor_amount >= 0),
  labor_tax_rate numeric(5, 2) not null check (labor_tax_rate in (0, 5, 10)),
  parts_subtotal numeric(14, 2) not null check (parts_subtotal >= 0),
  parts_internal_cost numeric(14, 2) not null check (parts_internal_cost >= 0),
  additional_charges numeric(14, 2) not null check (additional_charges >= 0),
  deductions numeric(14, 2) not null check (deductions >= 0),
  discount_amount numeric(14, 2) not null check (discount_amount >= 0),
  subtotal_before_discount numeric(14, 2) not null check (subtotal_before_discount >= 0),
  final_total numeric(14, 2) not null check (final_total >= 0),
  paid_amount_snapshot numeric(14, 2) not null check (paid_amount_snapshot >= 0),
  balance_snapshot numeric(14, 2) not null check (balance_snapshot >= 0),
  tax_breakdown jsonb not null default '[]'::jsonb,
  policy_snapshot jsonb not null default '{}'::jsonb,
  previous_snapshot jsonb,
  intent_hash text not null,
  idempotency_key text not null,
  result_snapshot jsonb,
  created_at timestamptz not null default now(),
  unique (repair_id, revision_number),
  unique (organization_id, idempotency_key)
);

create table if not exists public.repair_cost_revision_parts (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.repair_cost_revisions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_id uuid not null references public.repairs(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  part_name text not null,
  part_number text,
  supplier text,
  quantity integer not null check (quantity > 0),
  unit_cost_snapshot numeric(14, 2) not null check (unit_cost_snapshot >= 0),
  unit_price_snapshot numeric(14, 2) not null check (unit_price_snapshot >= 0),
  discount_amount numeric(14, 2) not null check (discount_amount >= 0),
  tax_rate numeric(5, 2) not null check (tax_rate in (0, 5, 10)),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create index if not exists repair_cost_revisions_scope_idx
  on public.repair_cost_revisions (organization_id, branch_id, repair_id, created_at desc);
create index if not exists repair_cost_revision_parts_revision_idx
  on public.repair_cost_revision_parts (revision_id);

alter table public.repair_cost_revisions enable row level security;
alter table public.repair_cost_revision_parts enable row level security;

revoke all on table public.repair_cost_revisions from public;
revoke all on table public.repair_cost_revisions from anon, authenticated;
revoke all on table public.repair_cost_revision_parts from public;
revoke all on table public.repair_cost_revision_parts from anon, authenticated;
grant select on table public.repair_cost_revisions to authenticated;
grant select on table public.repair_cost_revision_parts to authenticated;
grant select, insert on table public.repair_cost_revisions to service_role;
grant select, insert on table public.repair_cost_revision_parts to service_role;

drop policy if exists repair_cost_revisions_tenant_read on public.repair_cost_revisions;
create policy repair_cost_revisions_tenant_read
on public.repair_cost_revisions for select
to authenticated
using (
  exists (
    select 1 from public.organization_members membership
    where membership.organization_id = repair_cost_revisions.organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
);

drop policy if exists repair_cost_revision_parts_tenant_read on public.repair_cost_revision_parts;
create policy repair_cost_revision_parts_tenant_read
on public.repair_cost_revision_parts for select
to authenticated
using (
  exists (
    select 1 from public.organization_members membership
    where membership.organization_id = repair_cost_revision_parts.organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
);

create or replace function public.prevent_repair_cost_revision_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'REPAIR_COST_REVISION_IMMUTABLE';
end;
$$;

drop trigger if exists repair_cost_revisions_append_only on public.repair_cost_revisions;
create trigger repair_cost_revisions_append_only
before update or delete on public.repair_cost_revisions
for each row execute function public.prevent_repair_cost_revision_mutation();

drop trigger if exists repair_cost_revision_parts_append_only on public.repair_cost_revision_parts;
create trigger repair_cost_revision_parts_append_only
before update or delete on public.repair_cost_revision_parts
for each row execute function public.prevent_repair_cost_revision_mutation();

create or replace function public.save_repair_cost_revision(
  p_repair_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_labor_amount numeric,
  p_parts jsonb,
  p_additional_charges numeric,
  p_deductions numeric,
  p_discount_amount numeric,
  p_override_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_repair public.repairs%rowtype;
  existing_revision public.repair_cost_revisions%rowtype;
  membership_role text;
  is_admin boolean := false;
  max_discount_percent numeric := 20;
  labor_tax_rate numeric := 10;
  normalized_labor numeric := round(coalesce(p_labor_amount, 0), 2);
  normalized_charges numeric := round(coalesce(p_additional_charges, 0), 2);
  normalized_deductions numeric := round(coalesce(p_deductions, 0), 2);
  normalized_discount numeric := round(coalesce(p_discount_amount, 0), 2);
  normalized_reason text := nullif(trim(coalesce(p_override_reason, '')), '');
  normalized_parts jsonb := coalesce(p_parts, '[]'::jsonb);
  request_hash text;
  item jsonb;
  resolved_parts jsonb := '[]'::jsonb;
  old_item record;
  resolved_product_id uuid;
  resolved_name text;
  resolved_part_number text;
  resolved_supplier text;
  resolved_quantity integer;
  resolved_unit_price numeric;
  resolved_unit_cost numeric;
  resolved_part_discount numeric;
  resolved_tax_rate numeric;
  resolved_subtotal numeric;
  previous_stock integer;
  available_stock integer;
  parts_subtotal numeric := 0;
  parts_internal_cost numeric := 0;
  subtotal_before_discount numeric := 0;
  final_total numeric := 0;
  paid_snapshot numeric := 0;
  balance_snapshot numeric := 0;
  discount_percent numeric := 0;
  tax_gross_0 numeric := 0;
  tax_gross_5 numeric := 0;
  tax_gross_10 numeric := 0;
  allocation_factor numeric := 0;
  tax_breakdown jsonb := '[]'::jsonb;
  policy_snapshot jsonb;
  previous_snapshot jsonb;
  new_revision_id uuid;
  new_revision_number integer;
  result_payload jsonb;
begin
  if jsonb_typeof(normalized_parts) <> 'array' or jsonb_array_length(normalized_parts) > 100 then
    raise exception 'INVALID_REPAIR_PARTS';
  end if;
  if normalized_labor < 0 or normalized_charges < 0 or normalized_deductions < 0
     or normalized_discount < 0 or trim(coalesce(p_idempotency_key, '')) = '' then
    raise exception 'INVALID_REPAIR_COST_INPUT';
  end if;

  request_hash := md5(jsonb_build_object(
    'repair_id', p_repair_id, 'labor', normalized_labor, 'parts', normalized_parts,
    'charges', normalized_charges, 'deductions', normalized_deductions,
    'discount', normalized_discount, 'reason', normalized_reason
  )::text);

  -- Serialize retries for the same tenant/key before checking the unique row.
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_idempotency_key, 0));

  select * into existing_revision
  from public.repair_cost_revisions revision
  where revision.organization_id = p_organization_id
    and revision.idempotency_key = p_idempotency_key;
  if found then
    if existing_revision.intent_hash is distinct from request_hash then
      raise exception 'REPAIR_COST_IDEMPOTENCY_CONFLICT';
    end if;
    return existing_revision.result_snapshot;
  end if;

  select * into target_repair
  from public.repairs repair
  where repair.id = p_repair_id
    and repair.organization_id = p_organization_id
    and repair.branch_id = p_branch_id
  for update;
  if not found then raise exception 'REPAIR_NOT_FOUND'; end if;
  if target_repair.status in ('entregado', 'cancelado') then
    raise exception 'REPAIR_COST_NOT_EDITABLE';
  end if;

  select membership.role::text into membership_role
  from public.organization_members membership
  where membership.organization_id = p_organization_id
    and membership.user_id = p_actor_id
    and membership.status = 'active';
  if membership_role is null then raise exception 'REPAIR_COST_FORBIDDEN'; end if;
  is_admin := membership_role in ('owner', 'admin', 'super_admin');

  select coalesce(settings.repair_max_discount_percent, 20),
         coalesce(settings.repair_labor_tax_rate, 10)
  into max_discount_percent, labor_tax_rate
  from public.organization_settings settings
  where settings.organization_id = p_organization_id;
  max_discount_percent := coalesce(max_discount_percent, 20);
  labor_tax_rate := coalesce(labor_tax_rate, 10);

  perform 1
  from public.branch_inventory inventory
  where inventory.branch_id = p_branch_id
    and inventory.product_id in (
      select product_id from public.repair_parts
      where repair_id = p_repair_id and product_id is not null
      union
      select (value->>'product_id')::uuid
      from jsonb_array_elements(normalized_parts)
      where nullif(value->>'product_id', '') is not null
    )
  order by inventory.product_id
  for update;

  for old_item in
    select product_id, sum(quantity)::integer quantity
    from public.repair_parts
    where repair_id = p_repair_id and product_id is not null
    group by product_id order by product_id
  loop
    select inventory.stock_quantity into previous_stock
    from public.branch_inventory inventory
    where inventory.branch_id = p_branch_id and inventory.product_id = old_item.product_id
    for update;
    if not found then raise exception 'REPAIR_INVENTORY_ROW_MISSING|%', old_item.product_id; end if;
    update public.branch_inventory
    set stock_quantity = previous_stock + old_item.quantity, updated_at = now()
    where branch_id = p_branch_id and product_id = old_item.product_id;
    insert into public.product_movements (
      product_id, movement_type, quantity, previous_stock, new_stock,
      reference_id, reference_type, notes, user_id, branch_id, organization_id, created_at
    ) values (
      old_item.product_id, 'return', old_item.quantity, previous_stock,
      previous_stock + old_item.quantity, p_repair_id, 'repair',
      'Reposicion automatica al editar costos de reparacion', p_actor_id,
      p_branch_id, p_organization_id, now()
    );
  end loop;

  for item in select value from jsonb_array_elements(normalized_parts)
  loop
    resolved_product_id := nullif(item->>'product_id', '')::uuid;
    resolved_name := trim(coalesce(item->>'part_name', ''));
    resolved_part_number := nullif(trim(coalesce(item->>'part_number', '')), '');
    resolved_supplier := nullif(trim(coalesce(item->>'supplier', '')), '');
    resolved_quantity := coalesce((item->>'quantity')::integer, 0);
    resolved_unit_price := round(coalesce((item->>'unit_price')::numeric, 0), 2);
    resolved_part_discount := round(coalesce((item->>'discount_amount')::numeric, 0), 2);
    resolved_unit_cost := round(coalesce(nullif(item->>'unit_cost', '')::numeric, 0), 2);
    resolved_tax_rate := coalesce(nullif(item->>'tax_rate', '')::numeric, labor_tax_rate);
    if resolved_name = '' or resolved_quantity <= 0 or resolved_unit_price < 0
       or resolved_part_discount < 0 or resolved_part_discount > resolved_unit_price * resolved_quantity
       or resolved_tax_rate not in (0, 5, 10) then
      raise exception 'INVALID_REPAIR_PART';
    end if;

    if resolved_product_id is not null then
      select round(coalesce(product.purchase_price, 0), 2),
             coalesce(product.tax_rate, labor_tax_rate)
      into resolved_unit_cost, resolved_tax_rate
      from public.products product
      where product.id = resolved_product_id
        and product.organization_id = p_organization_id
        and product.is_active = true
      for update;
      if not found then raise exception 'REPAIR_PRODUCT_NOT_FOUND|%', resolved_product_id; end if;

      select inventory.stock_quantity into available_stock
      from public.branch_inventory inventory
      where inventory.branch_id = p_branch_id and inventory.product_id = resolved_product_id
      for update;
      if not found or available_stock < resolved_quantity then
        raise exception 'REPAIR_STOCK_CHANGED|%|%', resolved_product_id, coalesce(available_stock, 0);
      end if;
    end if;

    resolved_subtotal := round(resolved_unit_price * resolved_quantity - resolved_part_discount, 2);
    if resolved_subtotal / resolved_quantity < resolved_unit_cost then
      if not is_admin then raise exception 'REPAIR_PART_BELOW_COST'; end if;
      if normalized_reason is null or length(normalized_reason) < 5 then
        raise exception 'REPAIR_OVERRIDE_REASON_REQUIRED';
      end if;
    end if;
    parts_subtotal := parts_subtotal + resolved_subtotal;
    parts_internal_cost := parts_internal_cost + resolved_unit_cost * resolved_quantity;
    resolved_parts := resolved_parts || jsonb_build_array(jsonb_build_object(
      'product_id', resolved_product_id, 'part_name', resolved_name,
      'part_number', resolved_part_number, 'supplier', resolved_supplier,
      'quantity', resolved_quantity, 'unit_price', resolved_unit_price,
      'unit_cost', resolved_unit_cost, 'discount_amount', resolved_part_discount,
      'tax_rate', resolved_tax_rate, 'subtotal', resolved_subtotal
    ));
  end loop;

  subtotal_before_discount := round(normalized_labor + parts_subtotal + normalized_charges, 2);
  if normalized_discount + normalized_deductions > subtotal_before_discount then
    raise exception 'REPAIR_DISCOUNT_EXCEEDS_SUBTOTAL';
  end if;
  discount_percent := case when subtotal_before_discount = 0 then 0
    else normalized_discount * 100 / subtotal_before_discount end;
  if discount_percent > max_discount_percent then
    if not is_admin then raise exception 'REPAIR_DISCOUNT_LIMIT_EXCEEDED'; end if;
    if normalized_reason is null or length(normalized_reason) < 5 then
      raise exception 'REPAIR_OVERRIDE_REASON_REQUIRED';
    end if;
  end if;
  final_total := round(greatest(0, subtotal_before_discount - normalized_discount - normalized_deductions), 2);
  paid_snapshot := round(greatest(coalesce(target_repair.paid_amount, 0), 0), 2);
  if final_total < paid_snapshot then raise exception 'REPAIR_FINAL_BELOW_PAID_AMOUNT'; end if;
  balance_snapshot := round(greatest(final_total - paid_snapshot, 0), 2);
  allocation_factor := case when subtotal_before_discount = 0 then 0 else final_total / subtotal_before_discount end;

  if labor_tax_rate = 0 then tax_gross_0 := tax_gross_0 + normalized_labor + normalized_charges;
  elsif labor_tax_rate = 5 then tax_gross_5 := tax_gross_5 + normalized_labor + normalized_charges;
  else tax_gross_10 := tax_gross_10 + normalized_labor + normalized_charges; end if;
  for item in select value from jsonb_array_elements(resolved_parts)
  loop
    if (item->>'tax_rate')::numeric = 0 then tax_gross_0 := tax_gross_0 + (item->>'subtotal')::numeric;
    elsif (item->>'tax_rate')::numeric = 5 then tax_gross_5 := tax_gross_5 + (item->>'subtotal')::numeric;
    else tax_gross_10 := tax_gross_10 + (item->>'subtotal')::numeric; end if;
  end loop;
  with raw_buckets(rate, gross_amount) as (
    values
      (0::numeric, round(tax_gross_0 * allocation_factor, 2)),
      (5::numeric, round(tax_gross_5 * allocation_factor, 2)),
      (10::numeric, round(tax_gross_10 * allocation_factor, 2))
  ), nonzero_buckets as (
    select rate, gross_amount from raw_buckets where gross_amount > 0
  ), adjusted_buckets as (
    select rate,
      case when rate = (select max(rate) from nonzero_buckets)
        then gross_amount + final_total - (select coalesce(sum(gross_amount), 0) from nonzero_buckets)
        else gross_amount end as gross_amount
    from nonzero_buckets
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'rate', rate, 'grossAmount', gross_amount,
    'taxableBase', round(gross_amount / (1 + rate / 100), 2),
    'taxAmount', round(gross_amount - gross_amount / (1 + rate / 100), 2)
  ) order by rate), '[]'::jsonb)
  into tax_breakdown
  from adjusted_buckets;

  select coalesce(max(revision.revision_number), 0) + 1 into new_revision_number
  from public.repair_cost_revisions revision where revision.repair_id = p_repair_id;
  select jsonb_build_object(
    'laborAmount', revision.labor_amount, 'partsSubtotal', revision.parts_subtotal,
    'additionalCharges', revision.additional_charges, 'deductions', revision.deductions,
    'discountAmount', revision.discount_amount, 'finalTotal', revision.final_total
  ) into previous_snapshot
  from public.repair_cost_revisions revision
  where revision.id = target_repair.current_cost_revision_id;
  policy_snapshot := jsonb_build_object(
    'maxDiscountPercent', max_discount_percent, 'laborTaxRate', labor_tax_rate,
    'administratorOverride', is_admin and normalized_reason is not null
  );

  new_revision_id := gen_random_uuid();
  result_payload := jsonb_build_object(
    'revisionId', new_revision_id, 'revisionNumber', new_revision_number,
    'summary', jsonb_build_object(
      'laborAmount', normalized_labor, 'partsSubtotal', round(parts_subtotal, 2),
      'partsInternalCost', round(parts_internal_cost, 2),
      'additionalCharges', normalized_charges, 'deductions', normalized_deductions,
      'discountAmount', normalized_discount, 'subtotalBeforeDiscount', subtotal_before_discount,
      'finalTotal', final_total, 'paidAmount', paid_snapshot,
      'balance', balance_snapshot, 'taxBreakdown', tax_breakdown
    ),
    'parts', resolved_parts
  );

  insert into public.repair_cost_revisions (
    id, organization_id, branch_id, repair_id, revision_number, actor_id, actor_role,
    reason, labor_amount, labor_tax_rate, parts_subtotal, parts_internal_cost,
    additional_charges, deductions, discount_amount, subtotal_before_discount,
    final_total, paid_amount_snapshot, balance_snapshot, tax_breakdown,
    policy_snapshot, previous_snapshot, intent_hash, idempotency_key, result_snapshot
  ) values (
    new_revision_id, p_organization_id, p_branch_id, p_repair_id, new_revision_number, p_actor_id,
    membership_role, normalized_reason, normalized_labor, labor_tax_rate,
    round(parts_subtotal, 2), round(parts_internal_cost, 2), normalized_charges,
    normalized_deductions, normalized_discount, subtotal_before_discount,
    final_total, paid_snapshot, balance_snapshot, tax_breakdown, policy_snapshot,
    previous_snapshot, request_hash, p_idempotency_key, result_payload
  );

  delete from public.repair_parts where repair_id = p_repair_id;
  for item in select value from jsonb_array_elements(resolved_parts)
  loop
    resolved_product_id := nullif(item->>'product_id', '')::uuid;
    resolved_quantity := (item->>'quantity')::integer;
    resolved_unit_cost := (item->>'unit_cost')::numeric;
    if resolved_product_id is not null then
      select inventory.stock_quantity into available_stock
      from public.branch_inventory inventory
      where inventory.branch_id = p_branch_id and inventory.product_id = resolved_product_id
      for update;
      if not found or available_stock < resolved_quantity then
        raise exception 'REPAIR_STOCK_CHANGED|%|%', resolved_product_id, coalesce(available_stock, 0);
      end if;
      update public.branch_inventory set stock_quantity = available_stock - resolved_quantity, updated_at = now()
      where branch_id = p_branch_id and product_id = resolved_product_id;
      insert into public.product_movements (
        product_id, movement_type, quantity, previous_stock, new_stock, unit_cost,
        total_cost, reference_id, reference_type, notes, user_id, branch_id,
        organization_id, created_at
      ) values (
        resolved_product_id, 'repair_use', resolved_quantity, available_stock,
        available_stock - resolved_quantity, resolved_unit_cost,
        resolved_unit_cost * resolved_quantity, p_repair_id, 'repair',
        'Consumo al confirmar revision de costos', p_actor_id, p_branch_id,
        p_organization_id, now()
      );
    end if;
    insert into public.repair_parts (
      repair_id, product_id, part_name, part_number, quantity, unit_cost,
      unit_price, discount_amount, tax_rate, supplier, status
    ) values (
      p_repair_id, resolved_product_id, item->>'part_name', nullif(item->>'part_number', ''),
      resolved_quantity, resolved_unit_cost, (item->>'unit_price')::numeric,
      (item->>'discount_amount')::numeric, (item->>'tax_rate')::numeric,
      nullif(item->>'supplier', ''), 'installed'
    );
    insert into public.repair_cost_revision_parts (
      revision_id, organization_id, branch_id, repair_id, product_id, part_name,
      part_number, supplier, quantity, unit_cost_snapshot, unit_price_snapshot,
      discount_amount, tax_rate, subtotal
    ) values (
      new_revision_id, p_organization_id, p_branch_id, p_repair_id,
      resolved_product_id, item->>'part_name', nullif(item->>'part_number', ''),
      nullif(item->>'supplier', ''), resolved_quantity, resolved_unit_cost,
      (item->>'unit_price')::numeric, (item->>'discount_amount')::numeric,
      (item->>'tax_rate')::numeric, (item->>'subtotal')::numeric
    );
  end loop;

  update public.repairs set
    labor_cost = normalized_labor, parts_cost = round(parts_internal_cost, 2),
    additional_charges = normalized_charges, deductions = normalized_deductions,
    discount_amount = normalized_discount, final_cost = final_total,
    estimated_cost = final_total, pricing_mode = 'automatic',
    price_override_reason = normalized_reason, pricing_updated_by = p_actor_id,
    pricing_updated_at = now(), current_cost_revision_id = new_revision_id,
    updated_at = now()
  where id = p_repair_id and organization_id = p_organization_id and branch_id = p_branch_id;

  return result_payload;
end;
$$;

revoke all on function public.save_repair_cost_revision(uuid, uuid, uuid, uuid, numeric, jsonb, numeric, numeric, numeric, text, text) from public;
revoke all on function public.save_repair_cost_revision(uuid, uuid, uuid, uuid, numeric, jsonb, numeric, numeric, numeric, text, text) from anon;
revoke all on function public.save_repair_cost_revision(uuid, uuid, uuid, uuid, numeric, jsonb, numeric, numeric, numeric, text, text) from authenticated;
grant execute on function public.save_repair_cost_revision(uuid, uuid, uuid, uuid, numeric, jsonb, numeric, numeric, numeric, text, text) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'repairs_current_cost_revision_fk'
  ) then
    alter table public.repairs add constraint repairs_current_cost_revision_fk
      foreign key (current_cost_revision_id) references public.repair_cost_revisions(id) on delete set null;
  end if;
end;
$$;

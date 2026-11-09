-- Finanzas: las compras de mercadería y repuestos no son gasto del negocio.
--
-- «No lo tengo, lo compro» (repuesto para una reparación) y las compras de
-- stock se registraban en «Proveedores y compras», de tipo operating_expense.
-- El resumen las restaba como gasto el día de la compra y otra vez como costo
-- directo cuando se entregaba la reparación o se vendía el producto: la
-- ganancia salía más baja de lo real.
--
-- Esta migración agrega la categoría de sistema «Compras de mercadería y
-- repuestos» (tipo direct_cost). El resumen la cuenta solo como plata que salió
-- (caja), no como gasto: el costo ya entra cuando se vende.
-- Idempotente: se puede volver a correr sin efectos. No modifica gastos ni importes.

begin;

-- 1) Categorías por defecto de un negocio nuevo (misma función, una fila más).
create or replace function public.seed_default_finance_categories(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if p_organization_id is null or not exists (
    select 1 from public.organizations organization
    where organization.id = p_organization_id
  ) then
    raise exception 'FINANCE_ORGANIZATION_NOT_FOUND';
  end if;

  insert into public.finance_categories (
    organization_id,
    code,
    name,
    category_type,
    scope,
    is_system
  )
  values
    (p_organization_id, 'rent', 'Alquiler', 'operating_expense', 'organization', true),
    (p_organization_id, 'electricity', 'Electricidad / ANDE', 'operating_expense', 'organization', true),
    (p_organization_id, 'water', 'Agua / ESSAP', 'operating_expense', 'organization', true),
    (p_organization_id, 'internet', 'Internet', 'operating_expense', 'organization', true),
    (p_organization_id, 'telephony', 'Telefonía', 'operating_expense', 'organization', true),
    (p_organization_id, 'taxes_fees', 'Impuestos y tasas', 'operating_expense', 'organization', true),
    (p_organization_id, 'suppliers_purchases', 'Proveedores y compras', 'operating_expense', 'organization', true),
    (p_organization_id, 'inventory_purchases', 'Compras de mercadería y repuestos', 'direct_cost', 'organization', true),
    (p_organization_id, 'marketing', 'Marketing', 'operating_expense', 'organization', true),
    (p_organization_id, 'maintenance', 'Mantenimiento', 'operating_expense', 'organization', true),
    (p_organization_id, 'transport', 'Transporte', 'operating_expense', 'organization', true),
    (p_organization_id, 'software_subscriptions', 'Software y suscripciones', 'operating_expense', 'organization', true),
    (p_organization_id, 'bank_fees', 'Comisiones bancarias', 'operating_expense', 'organization', true),
    (p_organization_id, 'other', 'Otros', 'other', 'organization', true)
  on conflict (organization_id, code) do nothing;
end;
$$;

revoke all on function public.seed_default_finance_categories(uuid) from public;
grant all on function public.seed_default_finance_categories(uuid) to service_role;

-- 2) La categoría nueva para los negocios que ya tienen categorías.
insert into public.finance_categories (organization_id, code, name, category_type, scope, is_system)
select distinct category.organization_id, 'inventory_purchases', 'Compras de mercadería y repuestos', 'direct_cost', 'organization', true
  from public.finance_categories category
on conflict (organization_id, code) do nothing;

-- Las compras de repuestos ya registradas NO se mueven de categoría: el trigger
-- validate_finance_obligation_state no permite cambiar la categoría de un
-- gasto con pagos o anulado (protege la historia). El resumen las reconoce por
-- su marca (`notes` = 'repair-part-purchase:…').

-- 3) Tilde que faltaba.
update public.finance_categories
   set name = 'Telefonía'
 where code = 'telephony'
   and is_system
   and name = 'Telefonia';

commit;

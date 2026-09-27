-- La misma función idempotente acredita ventas y reparaciones pagadas.
-- Conservamos el control de permisos: solo operadores autorizados en POS o
-- reparaciones pueden invocarla. El reemplazo acotado evita duplicar una
-- función extensa y falla si la definición instalada no es la esperada.
do $migration$
declare
  function_sql text;
  old_condition constant text :=
    'if not public.has_org_permission(p_organization_id, ''pos.sales.create'') then';
  new_condition constant text :=
    'if not (' ||
    'public.has_org_permission(p_organization_id, ''pos.sales.create'') ' ||
    'or public.has_org_permission(p_organization_id, ''repairs.orders.update'')' ||
    ') then';
begin
  select pg_get_functiondef(
    'public.award_loyalty_points_for_sale(uuid,uuid,numeric,uuid,text)'::regprocedure
  ) into function_sql;

  -- Una instalación nueva ya contiene la condición ampliada porque la
  -- migración base también fue corregida.
  if strpos(
    function_sql,
    'public.has_org_permission(p_organization_id, ''repairs.orders.update'')'
  ) > 0 then
    return;
  end if;

  if function_sql is null or strpos(function_sql, old_condition) = 0 then
    raise exception 'Expected loyalty permission condition was not found';
  end if;

  execute replace(function_sql, old_condition, new_condition);
end
$migration$;

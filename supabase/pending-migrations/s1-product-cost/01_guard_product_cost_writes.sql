-- BORRADOR PARA REVISIÓN — NO EJECUTAR EN PRODUCCIÓN.
-- S1, Etapa 1: impedir que un miembro sin `products.update_cost` cambie costos
-- directo por la Data API de Supabase. No cambia ninguna lectura.
-- Ver docs/security/s1-product-cost-column-security.md (pruebas, despliegue y reversión).
-- Orden: 01 (este) → 02 → despliegue web → 03. Reversión en rollback_*.sql.
--
-- Sin permiso:
--   * Un alta nueva con costo distinto de 0 se rechaza (PRODUCT_COST_FORBIDDEN).
--   * En una fila existente de la misma organización, el costo NO se cambia: se
--     conserva el guardado, sin error. Devolver un error solo cuando el valor
--     enviado difiere del guardado permitía adivinar el costo exacto probando
--     valores (auditoría final, 2026-10-20). La API ya rechaza con 403 antes de
--     llegar acá, así que esto solo afecta escrituras directas por la Data API.
--   * Cambiar la moneda cuando hay costo extranjero se rechaza: el trigger
--     apply_product_foreign_prices lo borraría.
--   * Un INSERT con el id de un producto de OTRA organización se trata como alta
--     nueva: nunca se compara contra una fila ajena.

begin;
-- Si una tabla está ocupada, abortar en vez de dejar la tienda esperando.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Misma regla que src/lib/products/cost-access.ts: dueño/administrador con membresía
-- activa en ese comercio, o el permiso concedido para ese comercio. El rol global y los
-- permisos legados con organization_id NULL no cuentan.
create or replace function public.has_product_cost_access(p_organization_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.user_id = auth.uid()
      and m.organization_id = p_organization_id
      and m.status = 'active'
      and (
        m.role in ('owner', 'admin')
        or exists (
          select 1 from public.user_permissions up
          where up.user_id = m.user_id
            and up.organization_id = p_organization_id
            and up.is_active
            and up.permission = p_permission
        )
      )
  );
$$;

revoke all on function public.has_product_cost_access(uuid, text) from public, anon;
grant execute on function public.has_product_cost_access(uuid, text) to authenticated, service_role;

create or replace function public.guard_product_cost_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.products%rowtype;
  v_found boolean := false;
begin
  -- Rol de servicio / trabajos del servidor: la API ya validó el permiso.
  if auth.uid() is null then
    return new;
  end if;
  if public.has_product_cost_access(new.organization_id, 'products.update_cost') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- save_product_with_variants guarda con INSERT … ON CONFLICT DO UPDATE, y el BEFORE
    -- INSERT corre antes de detectar el conflicto. Solo cuenta una fila de la MISMA
    -- organización; un id ajeno se trata como alta nueva.
    select * into v_existing from public.products p
      where p.id = new.id and p.organization_id = new.organization_id;
    v_found := found;
    if not v_found then
      if coalesce(new.purchase_price, 0) <> 0 or new.foreign_purchase_price is not null then
        raise exception 'PRODUCT_COST_FORBIDDEN' using errcode = '42501',
          detail = 'No tenés permiso para modificar costos en esta organización.';
      end if;
      return new;
    end if;
  else
    v_existing := old;
    if new.price_currency is distinct from old.price_currency and old.foreign_purchase_price is not null then
      raise exception 'PRODUCT_COST_FORBIDDEN' using errcode = '42501',
        detail = 'No tenés permiso para cambiar la moneda de un producto con costo extranjero.';
    end if;
  end if;

  -- Fila existente: el costo queda como estaba, sin revelar si el valor enviado coincidía.
  new.purchase_price := v_existing.purchase_price;
  new.foreign_purchase_price := v_existing.foreign_purchase_price;
  return new;
end;
$$;

create or replace function public.guard_product_variant_cost_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_cost numeric;
  v_found boolean := false;
begin
  if auth.uid() is null then
    return new;
  end if;
  if public.has_product_cost_access(new.organization_id, 'products.update_cost') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Mismo caso del upsert de save_product_with_variants; solo la misma organización.
    select v.purchase_price into v_existing_cost from public.product_variants v
      where v.id = new.id and v.organization_id = new.organization_id;
    v_found := found;
    if not v_found then
      if coalesce(new.purchase_price, 0) <> 0 then
        raise exception 'PRODUCT_COST_FORBIDDEN' using errcode = '42501',
          detail = 'No tenés permiso para modificar costos en esta organización.';
      end if;
      return new;
    end if;
  else
    v_existing_cost := old.purchase_price;
  end if;
  new.purchase_price := v_existing_cost;
  return new;
end;
$$;

-- Solo se ejecutan como trigger: nadie necesita llamarlas (el trigger no exige EXECUTE).
revoke all on function public.guard_product_cost_writes() from public, anon, authenticated;
revoke all on function public.guard_product_variant_cost_writes() from public, anon, authenticated;

-- «aa»: los BEFORE se ejecutan por orden alfabético; tiene que ver lo que mandó el
-- cliente antes de products_apply_foreign_prices.
drop trigger if exists products_aa_guard_cost_writes on public.products;
create trigger products_aa_guard_cost_writes
  before insert or update on public.products
  for each row execute function public.guard_product_cost_writes();

drop trigger if exists product_variants_aa_guard_cost_writes on public.product_variants;
create trigger product_variants_aa_guard_cost_writes
  before insert or update on public.product_variants
  for each row execute function public.guard_product_variant_cost_writes();

commit;

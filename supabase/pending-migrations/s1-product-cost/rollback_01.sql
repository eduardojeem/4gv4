-- Reversión de 01: quita la protección de escritura de costos. No toca datos.
-- Si 02 está aplicada, primero rollback_02 (can_read_product_cost depende de
-- has_product_cost_access).
begin;
-- Si una tabla está ocupada, abortar en vez de dejar la tienda esperando.
set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- Las políticas de la 04 usan has_product_cost_access: borrarla obligaría a revertir
-- la 04 y volvería a abrir los datos de clientes. Para quitar solo la protección de
-- escritura, usar rollback_01_triggers_only.sql.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and policyname in
      ('customer_order_item_cost_snapshots_cost_read', 'repair_cost_revisions_cost_read', 'repair_cost_revision_parts_cost_read')) then
    raise exception 'La 04 está aplicada: usar rollback_01_triggers_only.sql (no revertir la 04).';
  end if;
end $$;
drop trigger if exists products_aa_guard_cost_writes on public.products;
drop trigger if exists product_variants_aa_guard_cost_writes on public.product_variants;
drop function if exists public.guard_product_cost_writes();
drop function if exists public.guard_product_variant_cost_writes();
drop function if exists public.has_product_cost_access(uuid, text);
commit;

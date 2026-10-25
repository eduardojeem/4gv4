-- Recuperación de 01 SIN tocar la 04: quita los triggers de escritura de costos y sus
-- funciones, pero conserva has_product_cost_access (la usan las políticas de la 04).
-- No vuelve a abrir ningún acceso de lectura. No toca datos.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
drop trigger if exists products_aa_guard_cost_writes on public.products;
drop trigger if exists product_variants_aa_guard_cost_writes on public.product_variants;
drop function if exists public.guard_product_cost_writes();
drop function if exists public.guard_product_variant_cost_writes();
commit;

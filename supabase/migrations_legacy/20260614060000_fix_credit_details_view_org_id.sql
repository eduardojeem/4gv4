-- Fix: la vista credit_details se creó con `SELECT cc.*` en 20251213, ANTES de que la
-- migración multitenant (20260601000000) agregara organization_id a customer_credits.
-- Las vistas congelan la expansión de `*` al momento de su creación, así que credit_details
-- quedó SIN organization_id. El endpoint GET /api/credits filtra por organization_id sobre
-- esta vista → PostgREST no encuentra la columna → 500.
--
-- La recreamos (DROP + CREATE para evitar la restricción de orden de columnas de
-- CREATE OR REPLACE VIEW) para que `cc.*` vuelva a expandirse e incluya organization_id.

drop view if exists public.credit_details;

create view public.credit_details as
select
  cc.*,
  c.name as customer_name
from public.customer_credits cc
join public.customers c on c.id = cc.customer_id;

grant select on public.credit_details to authenticated;

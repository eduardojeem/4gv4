-- Optimiza el directorio de clientes para la paginación y búsqueda server-side.
-- No cambia datos, permisos ni el alcance de RLS.

create extension if not exists pg_trgm;

create index if not exists idx_customers_org_created_desc
  on public.customers (organization_id, created_at desc, id desc);

create index if not exists idx_customers_org_status_created
  on public.customers (organization_id, status, created_at desc, id desc);

create index if not exists idx_customers_org_type_created
  on public.customers (organization_id, customer_type, created_at desc, id desc);

create index if not exists idx_customers_org_segment_created
  on public.customers (organization_id, segment, created_at desc, id desc);

create index if not exists idx_customers_org_city_created
  on public.customers (organization_id, city, created_at desc, id desc);

create index if not exists idx_customers_search_name_trgm
  on public.customers using gin (name gin_trgm_ops);

create index if not exists idx_customers_search_first_name_trgm
  on public.customers using gin (first_name gin_trgm_ops);

create index if not exists idx_customers_search_last_name_trgm
  on public.customers using gin (last_name gin_trgm_ops);

create index if not exists idx_customers_search_company_trgm
  on public.customers using gin (company gin_trgm_ops);

create index if not exists idx_customers_search_company_name_trgm
  on public.customers using gin (company_name gin_trgm_ops);

comment on index public.idx_customers_org_created_desc is
  'Paginacion tenant-safe del directorio de clientes';

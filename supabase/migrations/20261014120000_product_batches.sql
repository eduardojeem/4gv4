-- Lotes y vencimientos de productos (alimentos, cosmética, farmacia…).
--
-- Cada ingreso de mercadería con fecha de vencimiento es un lote: cuántas
-- unidades entraron y cuándo vencen. El stock sigue siendo uno solo por
-- producto (las ventas no cambian): cuánto queda de cada lote se estima
-- suponiendo que se vende primero lo que vence antes. Un lote se descarta
-- (vencido, roto, devuelto al proveedor) para que deje de avisar.

begin;

create table if not exists public.product_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  lot_code text check (lot_code is null or char_length(lot_code) <= 60),
  expires_on date not null,
  quantity integer not null check (quantity > 0 and quantity <= 10000000),
  received_on date not null default current_date,
  notes text check (notes is null or char_length(notes) <= 500),
  discarded_at timestamptz,
  discarded_reason text check (discarded_reason is null or char_length(discarded_reason) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists product_batches_org_expiry_idx
  on public.product_batches (organization_id, expires_on)
  where discarded_at is null;
create index if not exists product_batches_product_idx on public.product_batches (product_id);

alter table public.product_batches enable row level security;

drop policy if exists product_batches_read on public.product_batches;
create policy product_batches_read on public.product_batches
  for select to authenticated
  using (public.has_org_permission(organization_id, 'inventory.products.read'));

drop policy if exists product_batches_insert on public.product_batches;
create policy product_batches_insert on public.product_batches
  for insert to authenticated
  with check (
    (public.has_org_permission(organization_id, 'inventory.stock.manage')
      or public.has_org_permission(organization_id, 'inventory.products.create'))
    and exists (select 1 from public.products p where p.id = product_id and p.organization_id = product_batches.organization_id)
  );

drop policy if exists product_batches_update on public.product_batches;
create policy product_batches_update on public.product_batches
  for update to authenticated
  using (public.has_org_permission(organization_id, 'inventory.stock.manage') or public.has_org_permission(organization_id, 'inventory.products.create'))
  with check (public.has_org_permission(organization_id, 'inventory.stock.manage') or public.has_org_permission(organization_id, 'inventory.products.create'));

commit;

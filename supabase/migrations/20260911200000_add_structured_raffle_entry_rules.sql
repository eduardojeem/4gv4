alter table public.raffles
  add column if not exists min_purchase_amount numeric(14, 2),
  add column if not exists auto_entry_on_sale boolean not null default false,
  add column if not exists allow_point_purchase boolean not null default true,
  add column if not exists point_purchase_price numeric(14, 2);

alter table public.raffles
  drop constraint if exists raffles_min_purchase_positive;

alter table public.raffles
  add constraint raffles_min_purchase_positive
  check (min_purchase_amount is null or min_purchase_amount >= 0);

alter table public.raffles
  drop constraint if exists raffles_point_purchase_price_positive;

alter table public.raffles
  add constraint raffles_point_purchase_price_positive
  check (point_purchase_price is null or point_purchase_price > 0);

create index if not exists raffles_auto_entry_window_idx
  on public.raffles (organization_id, starts_at, ends_at)
  where status = 'published' and auto_entry_on_sale = true;

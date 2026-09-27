alter table public.repairs
  add column if not exists pricing_mode text not null default 'automatic',
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists price_override_reason text,
  add column if not exists pricing_updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists pricing_updated_at timestamptz;

-- Existing totals are treated as agreed budgets so the migration never
-- silently replaces a price that was already shown to a customer.
update public.repairs
set pricing_mode = case when final_cost is not null then 'budget' else 'automatic' end,
    pricing_updated_at = coalesce(updated_at, created_at, now())
where pricing_updated_at is null;

alter table public.repairs
  drop constraint if exists repairs_pricing_mode_check;

alter table public.repairs
  add constraint repairs_pricing_mode_check
  check (pricing_mode in ('automatic', 'budget', 'manual'));

alter table public.repairs
  drop constraint if exists repairs_discount_amount_check;

alter table public.repairs
  add constraint repairs_discount_amount_check
  check (discount_amount >= 0);

comment on column public.repairs.pricing_mode is
  'automatic: labor + parts - discount; budget: total agreed derives labor; manual: administrative override';
comment on column public.repairs.price_override_reason is
  'Audit explanation required for discounts and authorized pricing exceptions.';

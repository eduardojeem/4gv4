-- Customer forms use `wholesale` consistently for mayoristas. Preserve every
-- legacy value already accepted by the database and add the application value.
alter table public.customers
  drop constraint if exists customers_customer_type_check;

alter table public.customers
  add constraint customers_customer_type_check
  check (customer_type in ('regular', 'premium', 'vip', 'empresa', 'wholesale'));

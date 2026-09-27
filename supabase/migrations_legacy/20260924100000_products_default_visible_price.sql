-- Los productos nuevos nacen con precio visible para todos por defecto.
alter table public.products
  alter column hide_price set default false;

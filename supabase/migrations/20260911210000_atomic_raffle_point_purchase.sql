alter table public.loyalty_ledger
  add column if not exists payment_method text,
  add column if not exists payment_reference text;

alter table public.loyalty_ledger
  drop constraint if exists loyalty_ledger_payment_method_valid;

alter table public.loyalty_ledger
  add constraint loyalty_ledger_payment_method_valid
  check (payment_method is null or payment_method in ('cash', 'transfer', 'card'));

create or replace function public.purchase_points_and_redeem_raffle_tickets(
  p_raffle_id uuid, p_customer_id uuid, p_quantity integer,
  p_payment_method text, p_payment_reference text default null
)
returns setof public.raffle_tickets
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  raffle public.raffles;
  account public.loyalty_accounts;
  customer_org uuid;
  points integer;
  price numeric;
begin
  if p_quantity is null or p_quantity <= 0 or p_quantity > 100 then
    raise exception 'La cantidad de números debe estar entre 1 y 100.' using errcode = 'invalid_parameter_value';
  end if;
  if p_payment_method not in ('cash', 'transfer', 'card') then
    raise exception 'Elegí un medio de pago válido.' using errcode = 'invalid_parameter_value';
  end if;
  select * into raffle from public.raffles where id = p_raffle_id for update;
  if not found then raise exception 'El sorteo no existe.' using errcode = 'no_data_found'; end if;
  if not raffle.allow_point_purchase then raise exception 'La compra directa de puntos no está habilitada para este sorteo.' using errcode = 'invalid_parameter_value'; end if;
  if not public.has_org_permission(raffle.organization_id, 'pos.sales.create') then raise exception 'No tenés permiso para vender puntos.' using errcode = 'insufficient_privilege'; end if;
  select organization_id into customer_org from public.customers where id = p_customer_id;
  if customer_org is null or customer_org <> raffle.organization_id then raise exception 'El cliente no pertenece a la organización del sorteo.' using errcode = 'invalid_parameter_value'; end if;
  points := raffle.points_per_ticket * p_quantity;
  price := coalesce(raffle.point_purchase_price, 0) * points;
  if price <= 0 then raise exception 'El sorteo no tiene precio de puntos configurado.' using errcode = 'invalid_parameter_value'; end if;
  select * into account from public.loyalty_accounts where customer_id = p_customer_id for update;
  if not found then
    insert into public.loyalty_accounts (customer_id, organization_id, balance) values (p_customer_id, raffle.organization_id, 0) returning * into account;
  elsif account.organization_id <> raffle.organization_id then
    raise exception 'La cuenta de puntos no pertenece a la organización del sorteo.' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.loyalty_ledger (organization_id, customer_id, points, balance_after, source, description, raffle_id, payment_method, payment_reference, created_by)
  values (raffle.organization_id, p_customer_id, points, account.balance + points, 'purchase', format('Compra de %s puntos para el sorteo "%s" (Gs. %s)', points, raffle.name, price::bigint), p_raffle_id, p_payment_method, nullif(trim(p_payment_reference), ''), auth.uid());
  select * into account from public.loyalty_accounts where customer_id = p_customer_id for update;
  return query select * from public.redeem_points_for_raffle_tickets(p_raffle_id, p_customer_id, p_quantity);
end;
$$;

revoke all on function public.purchase_points_and_redeem_raffle_tickets(uuid, uuid, integer, text, text) from public, anon;
grant execute on function public.purchase_points_and_redeem_raffle_tickets(uuid, uuid, integer, text, text) to authenticated;

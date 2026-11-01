-- Pruebas gratis y cupones de descuento de la suscripción.
--
-- 1. expire_trials() existía pero nadie la programaba: una prueba con la fecha
--    pasada seguía con el plan completo para siempre. Ahora corre todos los
--    días (antes que los vencimientos de períodos pagos) y marca la cuenta como
--    impaga, igual que un período vencido; a los 7 días
--    downgrade_overdue_accounts la baja a Gratuito.
-- 2. Los cupones de descuento se canjeaban pero ningún cobro los usaba. El
--    descuento se reserva para un pago concreto (applied_payment_id) al iniciar
--    el cobro con tarjeta o QR; si ese pago falla o vence, vuelve a quedar libre.

create or replace function public.expire_trials()
returns integer language plpgsql security definer set search_path = public as $$
declare
  affected integer;
begin
  update public.subscriptions
     set status = 'past_due',
         payment_status = 'unpaid',
         updated_at = now()
   where status = 'trialing'
     and trial_ends_at is not null
     and trial_ends_at < now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_trials() from public, anon, authenticated;
grant execute on function public.expire_trials() to service_role;

alter table public.subscription_promo_redemptions
  add column if not exists applied_payment_id uuid references public.subscription_payments(id) on delete set null;

create index if not exists subscription_promo_redemptions_applied_payment
  on public.subscription_promo_redemptions(applied_payment_id)
  where applied_payment_id is not null;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('subscriptions_expire_trials', '10 6 * * *', 'select public.expire_trials()');
  else
    raise notice 'pg_cron no está disponible: programar expire_trials().';
  end if;
end;
$$;

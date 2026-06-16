-- Unidad de duración para códigos de suscripción: días o meses calendario.
-- Para activaciones de planes mensuales, 'months' hace que el período caiga el mismo
-- día del mes siguiente (sin el drift de sumar 30 días). 'days' mantiene el comportamiento previo.

alter table public.subscription_promo_codes
  add column if not exists duration_unit text not null default 'days'
    check (duration_unit in ('days', 'months'));

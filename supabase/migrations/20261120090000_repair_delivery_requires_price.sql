-- Una reparación no se puede entregar como «reparada» sin precio.
--
-- La API ya lo controla (/api/repairs/:id/delivery, REPAIR_PRICE_REQUIRED),
-- pero la política de RLS deja que un miembro con repairs.orders.update cambie
-- el estado directo en la tabla, y así la reparación quedaba entregada en ₲ 0
-- para Finanzas (el 13/10/2026 había 70). Esta migración agrega la misma regla
-- al trigger que ya valida cada entrega (capture_pos_repair_payment).
--
-- «Tiene precio» es la misma regla que src/lib/repairs/price-required.ts:
-- precio final (aunque sea 0, «Sin cargo»), presupuesto, mano de obra o algún
-- repuesto cobrado. Las entregas sin reparar (retirado o sin solución) no
-- necesitan precio: solo se cobra el cargo de revisión, si hay.
--
-- No cambia la RLS, los permisos ni los datos existentes: solo frena entregas
-- nuevas sin precio.

create or replace function public.capture_pos_repair_payment()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  if new.status = 'entregado' and old.status is distinct from 'entregado' then
    if old.status <> 'listo' then
      raise exception 'REPAIR_DELIVERY_INVALID_STATE';
    end if;
    if new.delivery_outcome not in ('repaired', 'withdrawn', 'unrepairable') then
      raise exception 'REPAIR_DELIVERY_OUTCOME_INVALID';
    end if;
    if new.delivery_outcome = 'repaired'
       and new.final_cost is null
       and coalesce(new.estimated_cost, 0) <= 0
       and coalesce(new.labor_cost, 0) <= 0
       and not exists (
         select 1
           from public.repair_parts part
          where part.repair_id = new.id
            and coalesce(part.unit_price, part.unit_cost, 0) * greatest(coalesce(part.quantity, 0), 0) > 0
       ) then
      raise exception 'REPAIR_PRICE_REQUIRED';
    end if;
    new.warranty_expires_at := case
      when coalesce(new.warranty_months, 0) > 0
        then coalesce(new.delivered_at, now()) + make_interval(months => new.warranty_months)
      else null
    end;
  end if;

  return new;
end;
$$;

alter function public.capture_pos_repair_payment() owner to postgres;

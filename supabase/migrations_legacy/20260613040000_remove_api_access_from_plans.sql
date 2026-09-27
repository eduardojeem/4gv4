-- Quita "API access" del comparativo comercial de los planes.
-- No existe un sistema de API para clientes (sin tabla api_keys, sin auth por key entrante,
-- sin rate limiting por plan), así que no se debe ofrecer hasta implementarlo.
-- Es solo feature comercial (no es un módulo técnico), por eso no toca el trigger ni plans.modules.

update public.subscription_plans
set features = (
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  from jsonb_array_elements(features) elem
  where elem->>'label' <> 'API access'
)
where features @> '[{"label": "API access"}]'::jsonb;

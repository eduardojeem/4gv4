-- Plantillas de tienda habilitadas por plan.
--
-- Super Admin decide qué plantillas trae cada plan técnico (BASIC, PRO,
-- ENTERPRISE «Pro Max», FREE). No se guarda en `plans.limits` porque el trigger
-- `sync_technical_plan_from_subscription_plan` reconstruye ese JSON campo por
-- campo y descartaría la lista.
--
-- Una tienda conserva la plantilla que ya usa aunque su plan no la incluya:
-- la regla solo impide cambiar a una plantilla bloqueada (ver
-- src/lib/website/template-plan-access.ts y las rutas de website settings).
begin;

create table if not exists public.storefront_template_plan_access (
  plan_code text primary key check (plan_code in ('FREE', 'BASIC', 'PRO', 'ENTERPRISE')),
  templates text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.storefront_template_plan_access is
  'Plantillas de tienda online habilitadas por plan técnico. Solo la edita Super Admin (service role).';

-- Sin políticas: solo el service role (rutas de servidor) lee y escribe.
alter table public.storefront_template_plan_access enable row level security;

-- Valores iniciales en tres niveles: Basic (base), Pro (+ rubro), Pro Max (+ premium).
insert into public.storefront_template_plan_access (plan_code, templates) values
  ('FREE', array['auto', 'classic', 'catalog-basic', 'modern']),
  ('BASIC', array['auto', 'classic', 'catalog-basic', 'modern']),
  ('PRO', array['auto', 'classic', 'catalog-basic', 'modern', 'fashion', 'sport', 'tech', 'market', 'beauty', 'services']),
  ('ENTERPRISE', array['auto', 'classic', 'catalog-basic', 'modern', 'fashion', 'sport', 'tech', 'market', 'beauty', 'services', 'informatica-electronica', 'wholesale-pro', 'barber'])
on conflict (plan_code) do nothing;

commit;

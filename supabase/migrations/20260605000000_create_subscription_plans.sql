-- Create subscription_plans table

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  tier text not null unique check (tier in ('free', 'basic', 'pro', 'enterprise')),
  name text not null,
  price numeric not null default 0,
  price_note text,
  description text,
  is_popular boolean not null default false,
  is_active boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  color_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.subscription_plans enable row level security;

-- Policies

-- Everyone can read active plans
create policy "Anyone can read active plans"
  on public.subscription_plans for select
  using (true);

-- Only superadmins can modify plans
-- Reusing the same pattern we use for system_settings or relying on role
create policy "Superadmins can insert plans"
  on public.subscription_plans for insert
  with check (
    auth.role() = 'authenticated' and
    (select role from public.profiles where id = auth.uid()) = 'superadmin'
  );

create policy "Superadmins can update plans"
  on public.subscription_plans for update
  using (
    auth.role() = 'authenticated' and
    (select role from public.profiles where id = auth.uid()) = 'superadmin'
  )
  with check (
    auth.role() = 'authenticated' and
    (select role from public.profiles where id = auth.uid()) = 'superadmin'
  );

create policy "Superadmins can delete plans"
  on public.subscription_plans for delete
  using (
    auth.role() = 'authenticated' and
    (select role from public.profiles where id = auth.uid()) = 'superadmin'
  );

-- Seed Initial Data

insert into public.subscription_plans (tier, name, price, price_note, description, is_popular, limits, highlights, features, color_config)
values 
(
  'free',
  'FREE',
  0,
  'Siempre gratis',
  'Para explorar la plataforma y negocios que recién empiezan.',
  false,
  '{"users": "2", "products": "50", "branches": "1", "repairs": "10/mes"}'::jsonb,
  '["POS básico", "Inventario esencial", "Soporte comunidad"]'::jsonb,
  '[
    {"label": "Punto de Venta (POS)", "iconName": "ShoppingCart", "value": "Básico"},
    {"label": "Inventario", "iconName": "Boxes", "value": "50 productos"},
    {"label": "Usuarios", "iconName": "Users", "value": "2"},
    {"label": "Sucursales", "iconName": "Building2", "value": "1"},
    {"label": "Reparaciones", "iconName": "Wrench", "value": "10/mes"},
    {"label": "Gestión de clientes", "iconName": "Users", "value": false},
    {"label": "WhatsApp", "iconName": "MessageSquare", "value": false},
    {"label": "Ecommerce / Marketplace", "iconName": "Globe", "value": false},
    {"label": "Analytics avanzado", "iconName": "TrendingUp", "value": false},
    {"label": "Reportes exportables", "iconName": "Download", "value": false},
    {"label": "API access", "iconName": "Zap", "value": false},
    {"label": "Soporte", "iconName": "Crown", "value": "Comunidad"}
  ]'::jsonb,
  '{
    "badge": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    "icon": "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    "border": "border-slate-200 dark:border-slate-800",
    "accent": "text-slate-700 dark:text-slate-300",
    "ring": "ring-slate-200 dark:ring-slate-700"
  }'::jsonb
),
(
  'basic',
  'BASIC',
  29,
  'por mes',
  'Para negocios pequeños que necesitan POS, inventario y clientes.',
  false,
  '{"users": "10", "products": "500", "branches": "2", "repairs": "100/mes"}'::jsonb,
  '["POS completo", "Reparaciones", "Gestión de clientes"]'::jsonb,
  '[
    {"label": "Punto de Venta (POS)", "iconName": "ShoppingCart", "value": true},
    {"label": "Inventario", "iconName": "Boxes", "value": "500 productos"},
    {"label": "Usuarios", "iconName": "Users", "value": "10"},
    {"label": "Sucursales", "iconName": "Building2", "value": "2"},
    {"label": "Reparaciones", "iconName": "Wrench", "value": "100/mes"},
    {"label": "Gestión de clientes", "iconName": "Users", "value": true},
    {"label": "WhatsApp", "iconName": "MessageSquare", "value": false},
    {"label": "Ecommerce / Marketplace", "iconName": "Globe", "value": false},
    {"label": "Analytics avanzado", "iconName": "TrendingUp", "value": false},
    {"label": "Reportes exportables", "iconName": "Download", "value": true},
    {"label": "API access", "iconName": "Zap", "value": false},
    {"label": "Soporte", "iconName": "Crown", "value": "Email"}
  ]'::jsonb,
  '{
    "badge": "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    "icon": "bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400",
    "border": "border-blue-100 dark:border-blue-900/50",
    "accent": "text-blue-700 dark:text-blue-400",
    "ring": "ring-blue-100 dark:ring-blue-900/50"
  }'::jsonb
),
(
  'pro',
  'PRO',
  79,
  'por mes',
  'La mejor opción para negocios en crecimiento con ecommerce y analytics.',
  true,
  '{"users": "25", "products": "5 000", "branches": "5", "repairs": "Ilimitadas"}'::jsonb,
  '["WhatsApp integrado", "Analytics avanzado", "Ecommerce + Marketplace"]'::jsonb,
  '[
    {"label": "Punto de Venta (POS)", "iconName": "ShoppingCart", "value": true},
    {"label": "Inventario", "iconName": "Boxes", "value": "5 000 productos"},
    {"label": "Usuarios", "iconName": "Users", "value": "25"},
    {"label": "Sucursales", "iconName": "Building2", "value": "5"},
    {"label": "Reparaciones", "iconName": "Wrench", "value": true},
    {"label": "Gestión de clientes", "iconName": "Users", "value": true},
    {"label": "WhatsApp", "iconName": "MessageSquare", "value": true},
    {"label": "Ecommerce / Marketplace", "iconName": "Globe", "value": true},
    {"label": "Analytics avanzado", "iconName": "TrendingUp", "value": true},
    {"label": "Reportes exportables", "iconName": "Download", "value": true},
    {"label": "API access", "iconName": "Zap", "value": "Rate limitado"},
    {"label": "Soporte", "iconName": "Crown", "value": "Prioritario"}
  ]'::jsonb,
  '{
    "badge": "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
    "icon": "bg-violet-50 text-violet-500 dark:bg-violet-950/40 dark:text-violet-400",
    "border": "border-violet-200 dark:border-violet-800/60",
    "accent": "text-violet-700 dark:text-violet-400",
    "ring": "ring-violet-200 dark:ring-violet-800/60"
  }'::jsonb
),
(
  'enterprise',
  'ENTERPRISE',
  199,
  'por mes',
  'Para grandes empresas con múltiples sucursales y soporte dedicado.',
  false,
  '{"users": "Ilimitados", "products": "Ilimitados", "branches": "Ilimitadas", "repairs": "Ilimitadas"}'::jsonb,
  '["Soporte 24/7 dedicado", "SLA garantizado", "Onboarding personalizado"]'::jsonb,
  '[
    {"label": "Punto de Venta (POS)", "iconName": "ShoppingCart", "value": true},
    {"label": "Inventario", "iconName": "Boxes", "value": "Ilimitado"},
    {"label": "Usuarios", "iconName": "Users", "value": "Ilimitados"},
    {"label": "Sucursales", "iconName": "Building2", "value": "Ilimitadas"},
    {"label": "Reparaciones", "iconName": "Wrench", "value": true},
    {"label": "Gestión de clientes", "iconName": "Users", "value": true},
    {"label": "WhatsApp", "iconName": "MessageSquare", "value": true},
    {"label": "Ecommerce / Marketplace", "iconName": "Globe", "value": true},
    {"label": "Analytics avanzado", "iconName": "TrendingUp", "value": true},
    {"label": "Reportes exportables", "iconName": "Download", "value": true},
    {"label": "API access", "iconName": "Zap", "value": "Full access"},
    {"label": "Soporte", "iconName": "Crown", "value": "24/7 dedicado"}
  ]'::jsonb,
  '{
    "badge": "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    "icon": "bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400",
    "border": "border-amber-200 dark:border-amber-800/60",
    "accent": "text-amber-700 dark:text-amber-400",
    "ring": "ring-amber-200 dark:ring-amber-800/60"
  }'::jsonb
) on conflict (tier) do nothing;

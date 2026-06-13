-- Comunicaciones con clientes: plantillas, campañas e historial de envíos
-- Fecha: 2026-06-12
-- Descripción:
--   Persiste el sistema de Mensajes de la sección de clientes, que hasta ahora
--   estaba 100% hardcodeado (plantillas/campañas en memoria y sendCampaign falso).
--   Todo aislado por organización con RLS (patrón public.get_org_role).
--   Canal soportado por ahora: email (vía Resend). El campo `channel` queda
--   preparado para sms/whatsapp en el futuro.
--
-- Idempotente: segura de re-ejecutar.

-- 1. Plantillas
create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name varchar(150) not null,
  subject varchar(300) not null default '',
  content text not null default '',
  channel varchar(20) not null default 'email',
  category varchar(30) not null default 'marketing',
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Campañas
create table if not exists public.communication_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name varchar(150) not null,
  description text,
  template_id uuid references public.communication_templates(id) on delete set null,
  target_segment text,
  channel varchar(20) not null default 'email',
  status varchar(20) not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Historial de mensajes (un registro por destinatario)
create table if not exists public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.communication_campaigns(id) on delete set null,
  customer_id uuid,
  customer_name text,
  to_email text not null,
  subject text,
  channel varchar(20) not null default 'email',
  status varchar(20) not null default 'sent'
    check (status in ('sent', 'delivered', 'read', 'failed')),
  provider_id text,           -- id devuelto por Resend
  error text,
  sent_at timestamptz not null default now()
);

-- Índices
create index if not exists idx_comm_templates_org on public.communication_templates(organization_id);
create index if not exists idx_comm_campaigns_org_created on public.communication_campaigns(organization_id, created_at desc);
create index if not exists idx_comm_messages_org_sent on public.communication_messages(organization_id, sent_at desc);
create index if not exists idx_comm_messages_campaign on public.communication_messages(campaign_id);

-- updated_at automático (reutiliza la función existente del proyecto)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_comm_templates_updated_at on public.communication_templates;
create trigger update_comm_templates_updated_at
  before update on public.communication_templates
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_comm_campaigns_updated_at on public.communication_campaigns;
create trigger update_comm_campaigns_updated_at
  before update on public.communication_campaigns
  for each row execute function public.update_updated_at_column();

-- RLS por organización
alter table public.communication_templates enable row level security;
alter table public.communication_campaigns enable row level security;
alter table public.communication_messages enable row level security;

-- Plantillas
drop policy if exists "org members manage templates" on public.communication_templates;
create policy "org members manage templates" on public.communication_templates
  for all using (public.get_org_role(organization_id) is not null)
  with check (public.get_org_role(organization_id) is not null);

-- Campañas
drop policy if exists "org members manage campaigns" on public.communication_campaigns;
create policy "org members manage campaigns" on public.communication_campaigns
  for all using (public.get_org_role(organization_id) is not null)
  with check (public.get_org_role(organization_id) is not null);

-- Historial (lectura para miembros; la escritura la hace el server con service role)
drop policy if exists "org members read messages" on public.communication_messages;
create policy "org members read messages" on public.communication_messages
  for select using (public.get_org_role(organization_id) is not null);

-- Documentación
comment on table public.communication_templates is 'Plantillas de mensajes (email) por organización';
comment on table public.communication_campaigns is 'Campañas de comunicación dirigidas a segmentos de clientes';
comment on table public.communication_messages is 'Historial de mensajes enviados, un registro por destinatario';
comment on column public.communication_messages.provider_id is 'ID del mensaje devuelto por el proveedor (Resend)';

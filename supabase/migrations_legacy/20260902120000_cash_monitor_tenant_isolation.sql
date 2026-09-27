-- Aislamiento por tienda en las tablas del monitor de caja.
--
-- Las tres tablas que creo `database/migrations/create_cash_admin_monitor.sql`
-- quedaron con seis politicas cuya condicion completa era "que quien consulta
-- tenga rol admin o super_admin". Ninguna miraba la organizacion, y ninguna de
-- las tres tiene columna para mirarla: su unico vinculo con una tienda es la
-- sesion de caja a la que apuntan, y las politicas no lo recorrian.
--
-- El resultado es que cualquier admin de cualquier tienda podia leer las
-- alertas de caja y el registro de auditoria de todas las demas. Cuatro de esas
-- politicas eran FOR ALL, asi que tambien podia modificarlos y borrarlos. Lo
-- unico que lo evitaba era el filtro que hace el codigo del navegador antes de
-- consultar, y un filtro del cliente no es una frontera.
--
-- Se denormaliza `organization_id` en las tres tablas en vez de resolverlo por
-- la sesion en cada politica. Dos razones: `cash_admin_audit.session_id` es
-- ON DELETE SET NULL, asi que al borrar una sesion su auditoria quedaria sin
-- tienda asignable —justo el registro que hay que conservar—, y
-- `cash_register_config` no tiene sesion de la que colgarse.

begin;

-- ── 1. Columna de tienda ───────────────────────────────────────────────────
alter table public.cash_alerts
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.cash_admin_audit
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.cash_register_config
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

-- La sucursal viaja junto con la tienda: la pantalla filtra por sucursal y, sin
-- la columna aca, ese filtro solo se podia aplicar recorriendo la sesion —que es
-- justo lo que el camino de tiempo real no hacia.
--
-- Va uuid, no text: `cash_closures.branch_id` es uuid desde
-- 20260517010000_add_multi_branch_foundation, que justamente borra la version
-- text anterior y la recrea apuntando a `branches`. El
-- `create_cash_admin_monitor.sql` de database/migrations todavia dice TEXT, pero
-- ese ADD COLUMN IF NOT EXISTS ya no hace nada; guiarse por ahi hacia fallar el
-- backfill con "COALESCE types text and uuid cannot be matched".

-- Por si una corrida anterior alcanzo a crear la columna con el tipo viejo.
-- Estas dos tablas no traen `branch_id` de origen, asi que si existe con otro
-- tipo es de un intento fallido y no tiene datos que perder.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cash_alerts'
      and column_name = 'branch_id' and data_type <> 'uuid'
  ) then
    alter table public.cash_alerts drop column branch_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cash_admin_audit'
      and column_name = 'branch_id' and data_type <> 'uuid'
  ) then
    alter table public.cash_admin_audit drop column branch_id;
  end if;
end $$;

alter table public.cash_alerts
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.cash_admin_audit
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

-- ── 2. Backfill desde la sesion de caja ────────────────────────────────────
update public.cash_alerts a
set organization_id = coalesce(a.organization_id, c.organization_id),
    branch_id = coalesce(a.branch_id, c.branch_id)
from public.cash_closures c
where c.id = a.session_id
  and (a.organization_id is null or a.branch_id is null);

update public.cash_admin_audit x
set organization_id = coalesce(x.organization_id, c.organization_id),
    branch_id = coalesce(x.branch_id, c.branch_id)
from public.cash_closures c
where c.id = x.session_id
  and (x.organization_id is null or x.branch_id is null);

-- La configuracion no tiene sesion: se resuelve por el codigo de caja, tomando
-- la sesion mas reciente de ese codigo.
update public.cash_register_config cfg
set organization_id = origen.organization_id
from (
  select distinct on (register_id) register_id, organization_id
  from public.cash_closures
  where organization_id is not null
  order by register_id, created_at desc
) as origen
where origen.register_id = cfg.register_id
  and cfg.organization_id is null;

-- ── 3. Indices ─────────────────────────────────────────────────────────────
create index if not exists idx_cash_alerts_organization
  on public.cash_alerts (organization_id, branch_id, created_at desc);

create index if not exists idx_cash_admin_audit_organization
  on public.cash_admin_audit (organization_id, branch_id, created_at desc);

create index if not exists idx_cash_register_config_organization
  on public.cash_register_config (organization_id);

-- ── 4. La configuracion era unica a nivel plataforma ───────────────────────
-- `register_id` es texto libre y su valor por defecto es 'principal'. Con un
-- unique global, la primera tienda que guardaba configuracion para 'principal'
-- se quedaba con ella y ninguna otra podia tener la suya. Pasa a ser unica
-- dentro de cada tienda.
alter table public.cash_register_config
  drop constraint if exists cash_register_config_register_id_key;

create unique index if not exists cash_register_config_org_register_key
  on public.cash_register_config (organization_id, register_id);

-- ── 5. Politicas por tienda ────────────────────────────────────────────────
-- Se usa el mismo helper que el resto del esquema: comprueba que quien consulta
-- sea miembro de esa organizacion y tenga el permiso. Devuelve falso cuando la
-- organizacion es nula, asi que una fila sin tienda asignada queda invisible
-- para todos en vez de visible para cualquiera.

alter table public.cash_alerts enable row level security;
alter table public.cash_admin_audit enable row level security;
alter table public.cash_register_config enable row level security;

drop policy if exists "Admin can read cash_alerts" on public.cash_alerts;
drop policy if exists "Admin can manage cash_alerts" on public.cash_alerts;
drop policy if exists "Admin can read cash_admin_audit" on public.cash_admin_audit;
drop policy if exists "Admin can manage cash_admin_audit" on public.cash_admin_audit;
drop policy if exists "Admin can read cash_register_config" on public.cash_register_config;
drop policy if exists "Admin can manage cash_register_config" on public.cash_register_config;

drop policy if exists "tenant members can read cash alerts" on public.cash_alerts;
create policy "tenant members can read cash alerts"
on public.cash_alerts for select to authenticated
using (public.has_org_permission(organization_id, 'pos.cash.manage'));

-- La pantalla marca alertas como leidas y resueltas. El `with check` impide que
-- una actualizacion mueva la fila a otra tienda.
drop policy if exists "tenant members can update cash alerts" on public.cash_alerts;
create policy "tenant members can update cash alerts"
on public.cash_alerts for update to authenticated
using (public.has_org_permission(organization_id, 'pos.cash.manage'))
with check (public.has_org_permission(organization_id, 'pos.cash.manage'));

drop policy if exists "tenant members can read cash admin audit" on public.cash_admin_audit;
create policy "tenant members can read cash admin audit"
on public.cash_admin_audit for select to authenticated
using (public.has_org_permission(organization_id, 'pos.cash.manage'));

-- La auditoria no se edita ni se borra desde la aplicacion: es el registro de
-- lo que hicieron los administradores. Antes cualquier admin podia borrar la de
-- otra tienda; ahora nadie la borra desde el cliente.
drop policy if exists "tenant members can append cash admin audit" on public.cash_admin_audit;
create policy "tenant members can append cash admin audit"
on public.cash_admin_audit for insert to authenticated
with check (public.has_org_permission(organization_id, 'pos.cash.manage'));

drop policy if exists "tenant members can read cash register config" on public.cash_register_config;
create policy "tenant members can read cash register config"
on public.cash_register_config for select to authenticated
using (public.has_org_permission(organization_id, 'pos.cash.manage'));

drop policy if exists "tenant members can manage cash register config" on public.cash_register_config;
create policy "tenant members can manage cash register config"
on public.cash_register_config for all to authenticated
using (public.has_org_permission(organization_id, 'pos.cash.manage'))
with check (public.has_org_permission(organization_id, 'pos.cash.manage'));

-- ── 6. El generador de alertas debe asignar la tienda ──────────────────────
-- Sin esto toda alerta nueva nace sin organizacion y, con las politicas de
-- arriba, invisible para todos: el arreglo dejaria la pantalla vacia.
create or replace function public.check_long_open_sessions()
returns void
language plpgsql
as $$
declare
  session_record record;
begin
  for session_record in
    select c.id, c.register_id, c.created_at, c.organization_id, c.branch_id
    from public.cash_closures c
    where c.status = 'open'
      and c.created_at < now() - interval '12 hours'
  loop
    if not exists (
      select 1 from public.cash_alerts
      where session_id = session_record.id
        and alert_type = 'long_open'
        and is_resolved = false
    ) then
      insert into public.cash_alerts (
        session_id, register_id, organization_id, branch_id, alert_type, severity, title, description
      )
      values (
        session_record.id,
        session_record.register_id,
        session_record.organization_id,
        session_record.branch_id,
        'long_open',
        'high',
        'Caja abierta por más de 12 horas',
        format('La caja %s lleva abierta desde %s',
          session_record.register_id,
          session_record.created_at::text)
      );
    end if;
  end loop;
end;
$$;

commit;

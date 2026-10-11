-- EJEMPLOS PARA PRODUCCIÓN. No es una migración; ejecutar manualmente.
-- Requiere migraciones de agenda hasta 20261014120007.
-- 1. Consultar la empresa con el SELECT siguiente (solo lectura).
-- 2. Completar v_requested_org, v_verified_service_limit y confirmar true.
-- Verificar en la aplicación que el plan habilita agenda y admite estos servicios.
-- El límite se declara manualmente; este SQL no sustituye la validación comercial de la API.
-- Datos ficticios PYG: 6 servicios ocultos/no online, 2 perfiles nuevos inactivos,
-- 4 tarifas. No crea reservas, clientes, usuarios, ventas, caja ni horarios.
-- No cambia planes/permisos ni publica la tienda. Los servicios cuentan para el cupo.
-- Usa los mismos identificadores DEMO de desarrollo: no duplica ni modifica existentes.
-- Si los ejemplos ya fueron publicados/activados antes, NO los vuelve a ocultar.
-- Ejecutar fuera del horario de atención: usa bloqueos breves y falla si hay contención.

select o.id as organization_id,o.name,m.role,m.status
from public.organizations o
join public.organization_members m on m.organization_id=o.id
join auth.users u on u.id=m.user_id
where lower(u.email)='jesentrix@gmail.com' and m.status='active'
  and m.role::text in ('owner','admin');

begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

do $demo$
declare
  v_confirm_production boolean := false;
  v_email text := 'jesentrix@gmail.com';
  -- Si el usuario administra varias empresas, completar el UUID exacto.
  v_requested_org uuid := null;
  v_verified_service_limit integer := 0; -- Completar con el tope real de servicios del plan.
  v_actor uuid;
  v_org uuid;
  v_org_count integer;
  v_tz text;
  v_currency text;
  v_prof uuid;
  v_product uuid;
  v_result jsonb;
  v_services jsonb := '{}'::jsonb;
  item record;
begin
  if not v_confirm_production then
    raise exception 'CONFIRMAR_PRODUCCION: verificá el proyecto y cambiá v_confirm_production a true.';
  end if;
  if v_requested_org is null or v_verified_service_limit < 6 then
    raise exception 'EMPRESA_Y_LIMITE: completá el UUID exacto y el tope real de servicios (mínimo 6).';
  end if;
  if not exists(select 1 from public.agenda_settings where organization_id=v_requested_org) then
    raise exception 'Configurá primero la agenda de la empresa. Este ejemplo no crea ni cambia horarios.';
  end if;
  select id into strict v_actor from auth.users where lower(email)=lower(v_email);
  select count(*), (array_agg(m.organization_id))[1] into v_org_count,v_org
    from public.organization_members m
    where m.user_id=v_actor and m.status='active' and m.role::text in ('owner','admin')
      and (v_requested_org is null or m.organization_id=v_requested_org);
  if v_org_count <> 1 then
    raise exception 'ORGANIZACION_AMBIGUA: se esperaba una empresa activa administrada por %, encontradas %. Completá v_requested_org.',v_email,v_org_count;
  end if;
  if not exists(select 1 from public.organizations where id=v_org and business_vertical in ('barbershop','beauty_services')) then
    raise exception 'Configurá primero el rubro Barbería/peluquería o Belleza en el perfil del negocio. No se modificó ningún dato.';
  end if;
  select coalesce(timezone,'America/Asuncion'),coalesce(currency,'PYG') into v_tz,v_currency
    from public.organization_settings where organization_id=v_org;
  v_tz:=coalesce(v_tz,'America/Asuncion'); v_currency:=coalesce(v_currency,'PYG');
  if v_currency <> 'PYG' then raise exception 'Los precios DEMO están en PYG; la organización usa %. Adaptá los importes antes de ejecutar.',v_currency; end if;
  if to_regprocedure('public.create_agenda_service(uuid,uuid,uuid,jsonb,integer,text)') is null then
    raise exception 'Falta aplicar 20261014120007_agenda_service_creation_atomic.sql';
  end if;

  -- Rechazar contención; no bloquear un cobro ni desactivar triggers/RLS.
  lock table public.products in share row exclusive mode nowait;
  if not pg_try_advisory_xact_lock(hashtextextended(v_org::text||':agenda-v2',0)) then
    raise exception 'Hay una operación de agenda en curso. Reintentá después.';
  end if;

  for item in select * from (values
    ('clasico','Corte clásico (DEMO)',50000,30),
    ('degradado','Degradado / fade (DEMO)',65000,45),
    ('combo','Corte + barba (DEMO)',85000,60),
    ('barba','Perfilado de barba (DEMO)',35000,25),
    ('infantil','Corte infantil (DEMO)',40000,30),
    ('lavado','Lavado y peinado (DEMO)',25000,20)
  ) as x(code,name,price,minutes) loop
    v_result:=public.create_agenda_service(v_org,v_actor,md5('jesentrix-barber-demo-v1:'||v_org::text||':'||item.code)::uuid,
      jsonb_build_object('name',item.name,'price',item.price,'durationMinutes',item.minutes,'catalogVisible',false,'online',false),
      v_verified_service_limit,public.agenda_service_policy_revision(v_org));
    -- El operador debe verificar el límite y la habilitación del módulo en la aplicación.
    v_services:=v_services||jsonb_build_object(item.code,v_result->>'id');
  end loop;

  for item in select * from (values
    ('mateo','Mateo (DEMO)','Cortes clásicos y barba','#2563eb',1),
    ('diego','Diego (DEMO)','Degradados y cortes infantiles','#16a34a',2)
  ) as x(code,name,specialty,color,sort_order) loop
    v_prof:=md5('jesentrix-barber-demo-v1:'||v_org::text||':prof:'||item.code)::uuid;
    if exists(select 1 from public.agenda_professionals where id=v_prof and organization_id<>v_org) then raise exception 'Identificador DEMO ocupado por otra empresa'; end if;
    insert into public.agenda_professionals(id,organization_id,name,specialty,color,sort_order,is_active,online_visible)
    values(v_prof,v_org,item.name,item.specialty,item.color,item.sort_order,false,false) on conflict(id) do nothing;
    -- Asignaciones explícitas: estos perfiles DEMO no atienden otros servicios reales.
    insert into public.agenda_professional_services(organization_id,professional_id,product_id)
      select v_org,v_prof,value::uuid from jsonb_each_text(v_services)
      on conflict(professional_id,product_id) do nothing;
  end loop;

  for item in select * from (values
    ('mateo','clasico',55000,35),('mateo','combo',95000,65),
    ('diego','clasico',45000,30),('diego','degradado',70000,50)
  ) as x(prof,service,price,minutes) loop
    insert into public.agenda_professional_service_rates(organization_id,professional_id,product_id,price,duration_minutes,buffer_minutes)
    values(v_org,md5('jesentrix-barber-demo-v1:'||v_org::text||':prof:'||item.prof)::uuid,
      (v_services->>item.service)::uuid,item.price,item.minutes,5)
    on conflict(organization_id,professional_id,product_id) do nothing;
  end loop;

  raise notice 'DEMO preparado en empresa %: 6 servicios ocultos, 2 perfiles nuevos inactivos y 4 tarifas. Sin reservas ni movimientos financieros; registros existentes conservados.',v_org;
end;
$demo$;

commit;

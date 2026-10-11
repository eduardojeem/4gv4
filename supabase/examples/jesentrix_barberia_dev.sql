-- DATOS FICTICIOS, SOLO DESARROLLO. NO es una migración.
-- Ejecutar todo el archivo en SQL Editor del proyecto Supabase de DESARROLLO.
-- Abrir localhost NO garantiza que la base sea de desarrollo: verificar proyecto.
-- Requiere las migraciones de agenda hasta 20261014120007.
-- Cambiar v_confirm_development a true solo después de verificar el proyecto.
-- No crea usuarios, clientes CRM, ventas, pagos ni movimientos de caja.
-- No cambia planes, permisos, rubro ni horarios existentes. No publica la tienda.
-- Precios ficticios en PYG. Servicios/profesionales identificados como DEMO.
-- Repetir no duplica mientras se conserven los identificadores y notas DEMO.

begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

do $demo$
declare
  v_confirm_development boolean := false;
  v_email text := 'jesentrix@gmail.com';
  -- Si el usuario administra varias empresas, completar el UUID exacto.
  v_requested_org uuid := null;
  v_actor uuid;
  v_org uuid;
  v_org_count integer;
  v_tz text;
  v_currency text;
  v_prof uuid;
  v_product uuid;
  v_result jsonb;
  v_services jsonb := '{}'::jsonb;
  v_marker text;
  v_start timestamptz;
  v_duration integer;
  v_buffer integer;
  v_i integer;
  item record;
begin
  if not v_confirm_development then
    raise exception 'CONFIRMAR_DESARROLLO: verificá el proyecto y cambiá v_confirm_development a true.';
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
  insert into public.agenda_settings(organization_id,slot_minutes,opening_hours,online_booking,require_confirmation,booking_message,notify_email)
  values(v_org,30,'{"1":[["08:00","12:00"],["14:00","19:00"]],"2":[["08:00","12:00"],["14:00","19:00"]],"3":[["08:00","12:00"],["14:00","19:00"]],"4":[["08:00","12:00"],["14:00","19:00"]],"5":[["08:00","12:00"],["14:00","19:00"]],"6":[["08:00","16:00"]]}'::jsonb,false,true,'Agenda de ejemplo para desarrollo.',false)
  on conflict(organization_id) do nothing;

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
      50,public.agenda_service_policy_revision(v_org));
    -- 50 es un tope conservador de este ejemplo; no cambia el plan ni habilita módulos.
    v_services:=v_services||jsonb_build_object(item.code,v_result->>'id');
  end loop;

  for item in select * from (values
    ('mateo','Mateo (DEMO)','Cortes clásicos y barba','#2563eb',1),
    ('diego','Diego (DEMO)','Degradados y cortes infantiles','#16a34a',2)
  ) as x(code,name,specialty,color,sort_order) loop
    v_prof:=md5('jesentrix-barber-demo-v1:'||v_org::text||':prof:'||item.code)::uuid;
    if exists(select 1 from public.agenda_professionals where id=v_prof and organization_id<>v_org) then raise exception 'Identificador DEMO ocupado por otra empresa'; end if;
    insert into public.agenda_professionals(id,organization_id,name,specialty,color,sort_order,is_active,online_visible)
    values(v_prof,v_org,item.name,item.specialty,item.color,item.sort_order,true,false) on conflict(id) do nothing;
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

  for v_i in 1..6 loop
    v_marker:='[DEMO-BARBERIA-JESENTRIX-V1-'||v_i||']';
    if exists(select 1 from public.appointments where organization_id=v_org and notes=v_marker) then continue; end if;
    v_prof:=md5('jesentrix-barber-demo-v1:'||v_org::text||':prof:'||case when v_i%2=0 then 'diego' else 'mateo' end)::uuid;
    v_product:=(v_services->>case when v_i%3=0 then 'combo' when v_i%2=0 then 'degradado' else 'clasico' end)::uuid;
    select coalesce(r.duration_minutes,s.duration_minutes),coalesce(r.buffer_minutes,s.buffer_minutes,0)
      into v_duration,v_buffer from public.agenda_services s
      left join public.agenda_professional_service_rates r on r.organization_id=s.organization_id and r.product_id=s.product_id and r.professional_id=v_prof
      where s.organization_id=v_org and s.product_id=v_product;
    -- Buscar huecos reales de los próximos 21 días, sin forzar fuera de horario.
    select slots.candidate into v_start
      from public.agenda_settings settings
      cross join generate_series(1,21) d(day)
      cross join lateral jsonb_array_elements(coalesce(settings.opening_hours->
        (extract(dow from (now() at time zone v_tz)::date+d.day)::integer)::text,'[]'::jsonb)) hours(period)
      cross join lateral generate_series(
        ((now() at time zone v_tz)::date+d.day+(hours.period->>0)::time) at time zone v_tz,
        ((now() at time zone v_tz)::date+d.day+(hours.period->>1)::time) at time zone v_tz,
        make_interval(mins=>settings.slot_minutes)) slots(candidate)
      where settings.organization_id=v_org and public.agenda_time_is_open(v_org,v_prof,candidate,v_duration,v_buffer)
      and not exists(select 1 from public.appointments a where a.organization_id=v_org and a.professional_id=v_prof
        and a.status in ('pending','confirmed') and tstzrange(a.starts_at,a.occupied_until)&&tstzrange(candidate,candidate+make_interval(mins=>v_duration+v_buffer)))
      and not exists(select 1 from public.agenda_time_off t where t.organization_id=v_org and (t.professional_id is null or t.professional_id=v_prof)
        and tstzrange(t.starts_at,t.ends_at)&&tstzrange(candidate,candidate+make_interval(mins=>v_duration+v_buffer)))
      order by candidate limit 1;
    if v_start is null then raise exception 'No hay horario disponible para turnos DEMO. No se guardó nada; revisá el horario de atención.'; end if;
    perform public.save_agenda_appointment(v_org,null,jsonb_build_object(
      'professional_id',v_prof,'service_product_id',v_product,'customer_name','Cliente ficticio '||v_i||' (DEMO)',
      'starts_at',v_start,'status','confirmed','notes',v_marker),v_actor);
  end loop;
  raise notice 'DEMO listo para empresa %: 6 servicios, 2 profesionales, 4 tarifas y 6 turnos. Sin ventas ni caja. Los ejemplos no se publicaron.',v_org;
end;
$demo$;

commit;

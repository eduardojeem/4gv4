-- Avisos globales del superadmin (/superadmin/communications).
--
-- 1. Los avisos programados se publican solos: pg_cron corre
--    dispatch_due_global_notifications() cada minuto. Antes se publicaban recién
--    cuando alguna tienda abría su panel, y cada apertura escribía en la base.
-- 2. Las lecturas se cuentan en la base: el panel ya no baja todas las filas de
--    global_notification_reads para contarlas en el servidor.

create or replace function public.global_notification_read_stats(p_notification_ids uuid[] default null)
returns table (notification_id uuid, read_count bigint, dismissed_count bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.notification_id,
         count(*) as read_count,
         count(*) filter (where r.dismissed) as dismissed_count
    from public.global_notification_reads r
   where p_notification_ids is null or r.notification_id = any (p_notification_ids)
   group by r.notification_id;
$$;

revoke all on function public.global_notification_read_stats(uuid[]) from public;
revoke all on function public.global_notification_read_stats(uuid[]) from anon, authenticated;
grant execute on function public.global_notification_read_stats(uuid[]) to service_role;

comment on function public.global_notification_read_stats(uuid[]) is
  'Lecturas y descartes por aviso global. Solo service_role (panel de superadmin).';

-- Nombre fijo: volver a programar reemplaza el trabajo, no lo duplica.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('global_notifications_dispatch', '* * * * *', 'select public.dispatch_due_global_notifications()');
  else
    raise notice 'pg_cron no está disponible: los avisos programados se publican solo al abrir /superadmin/communications.';
  end if;
end;
$$;

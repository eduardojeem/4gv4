-- Avisos globales del superadmin (/superadmin/communications).
--
-- Los avisos programados se publican solos: pg_cron corre
-- dispatch_due_global_notifications() cada minuto. Antes se publicaban recién
-- cuando alguna tienda abría su bandeja, y cada apertura escribía en la base.
--
-- Requiere la extensión pg_cron (Supabase: Database > Extensions). Sin ella la
-- migración no falla, pero los avisos programados quedan sin publicar.

-- Nombre fijo: volver a programar reemplaza el trabajo, no lo duplica.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('global_notifications_dispatch', '* * * * *', 'select public.dispatch_due_global_notifications()');
  else
    raise warning 'pg_cron no está disponible: los avisos programados no se publicarán solos hasta activarlo y volver a correr esta migración.';
  end if;
end;
$$;

-- Arreglos de la fila global de configuración (system_settings id='system').
-- Idempotente: se puede volver a correr sin efectos.
--
-- 1) La moneda global solo aceptaba PYG/USD/EUR/MXN, pero la pantalla ofrece
--    todas las de src/lib/regional/contract.ts (REGIONAL_CURRENCY_CODES): elegir
--    BRL o ARS fallaba con un error genérico.
-- 2) El email de la empresa por defecto es opcional en la app (vacío = sin
--    email), pero el CHECK exigía siempre un email válido.
-- 3) Los triggers ponían `updated_by` / `user_id` = auth.uid(). Las APIs
--    guardan con service_role (auth.uid() es null), así que pisaban con null el
--    autor que mandaba la ruta y la auditoría quedaba sin usuario.

-- 1) Moneda: las mismas que REGIONAL_CURRENCY_CODES.
alter table public.system_settings
  drop constraint if exists system_settings_currency_check;
alter table public.system_settings
  add constraint system_settings_currency_check
  check (currency = any (array['PYG', 'USD', 'BRL', 'ARS', 'UYU', 'CLP', 'BOB', 'PEN', 'COP', 'MXN', 'EUR']::text[]));

-- 2) Email: vacío o nulo permitido; si hay texto, tiene que ser un email.
alter table public.system_settings
  drop constraint if exists system_settings_company_email_check;
alter table public.system_settings
  add constraint system_settings_company_email_check
  check (
    company_email is null
    or company_email = ''
    or company_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

-- 3a) updated_by: el usuario de la sesión si lo hay; si no (service_role), el
--     que mandó la ruta.
create or replace function public.update_system_settings_timestamp()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    NEW.updated_at := now();
    NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
    return NEW;
end;
$$;

revoke all on function public.update_system_settings_timestamp() from public;
grant all on function public.update_system_settings_timestamp() to service_role;

-- 3b) Auditoría por campo: mismo criterio para user_id. Es un trigger AFTER,
--     así que NEW.updated_by ya trae el valor que resolvió el trigger anterior.
create or replace function public.log_settings_change()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
    field_name text;
    old_val jsonb;
    new_val jsonb;
begin
    for field_name in
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'system_settings'
          and column_name not in ('id', 'updated_at', 'updated_by')
    loop
        old_val := to_jsonb(OLD) -> field_name;
        new_val := to_jsonb(NEW) -> field_name;

        if old_val is distinct from new_val then
            insert into system_settings_audit (
                user_id,
                action,
                field_name,
                old_value,
                new_value,
                severity,
                details
            ) values (
                coalesce(auth.uid(), NEW.updated_by),
                'update',
                field_name,
                old_val,
                new_val,
                case
                    when field_name in ('maintenance_mode', 'allow_registration', 'require_two_factor') then 'critical'
                    when field_name in ('max_login_attempts', 'password_min_length', 'require_email_verification') then 'high'
                    when field_name in ('tax_rate', 'currency', 'session_timeout') then 'medium'
                    else 'low'
                end,
                jsonb_build_object('trigger', 'log_settings_change')
            );
        end if;
    end loop;

    return NEW;
end;
$$;

revoke all on function public.log_settings_change() from public;
grant all on function public.log_settings_change() to service_role;

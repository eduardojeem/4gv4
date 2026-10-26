-- «Exigir verificación en dos pasos (2FA) a los administradores» de cada organización.
--
-- Aditiva: una columna con default false (nadie queda bloqueado al aplicarla) y un
-- trigger. No cambia ninguna política de RLS: las existentes de organization_settings
-- siguen decidiendo quién lee (miembros) y quién actualiza (settings.manage).
--
-- El trigger impide que un administrador con sólo contraseña (sesión aal1) apague o
-- prenda la exigencia yendo directo a la API de datos: hace falta una sesión que ya
-- pasó el código de la app autenticadora (aal2). El servidor (service_role) y las
-- conexiones sin JWT (migraciones, SQL del dashboard) no pasan por esta regla.

alter table public.organization_settings
  add column if not exists require_admin_mfa boolean not null default false;

comment on column public.organization_settings.require_admin_mfa is
  'Si es true, owner y admin de la organización necesitan una sesión aal2 (2FA) para usar el panel y sus APIs.';

create or replace function public.guard_require_admin_mfa_change() returns trigger
language plpgsql security invoker
set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.require_admin_mfa)
     or (tg_op = 'UPDATE' and new.require_admin_mfa is distinct from old.require_admin_mfa) then
    if coalesce(auth.role(), '') in ('authenticated', 'anon')
       and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
      raise exception 'REQUIRE_ADMIN_MFA_NEEDS_AAL2'
        using errcode = '42501',
              hint = 'Confirmá tu sesión con la verificación en dos pasos para cambiar esta opción.';
    end if;
  end if;
  return new;
end $$;

revoke all on function public.guard_require_admin_mfa_change() from public, anon, authenticated;

drop trigger if exists organization_settings_require_admin_mfa_guard on public.organization_settings;
create trigger organization_settings_require_admin_mfa_guard
before insert or update of require_admin_mfa on public.organization_settings
for each row execute function public.guard_require_admin_mfa_change();

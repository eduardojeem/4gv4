-- ============================================================================
-- El onboarding deja de borrar la configuracion de la pagina publica
-- ============================================================================
--
-- `complete_organization_onboarding` hacia `set value = excluded.value` sobre la
-- fila `company_info`: un REEMPLAZO completo. Y la ruta que la llama arma ese
-- valor desde cero en cada guardado, con decisiones de diseno escritas a mano
-- como si fuera una instalacion nueva.
--
-- Resultado: un admin que personalizo su tienda en /admin/website, vuelve a
-- /dashboard/onboarding a corregir un telefono, guarda, y pierde:
--
--   customBrandColor  (el hexadecimal propio: ni siquiera viajaba en el payload)
--   brandColor        -> volvia a 'blue'
--   headerStyle       -> volvia a 'glass'
--   headerColor       -> volvia a vacio
--   showTopBar        -> volvia a true
--   slogan, description, mapsUrl, slug   -> se borraban
--   hours.sunday      -> se ponia en vacio
--
-- Nada avisaba. La pantalla tiene un modo «revisita» explicito —titulo propio,
-- insignia «Completado», boton «Descartar»— o sea que volver es justamente lo
-- que se espera que hagas.
--
-- El arreglo tiene dos mitades: aca, que la fila se fusione en vez de
-- reemplazarse; y en la ruta, que deje de mandar constantes de diseno que no le
-- pertenecen.
-- ============================================================================

begin;

create or replace function public.complete_organization_onboarding(
  p_organization_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_currency text,
  p_timezone text,
  p_logo_url text,
  p_modules jsonb,
  p_branch jsonb,
  p_company_info jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_branch_id uuid;
  completed_at timestamptz := now();
  existing_company jsonb;
  merged_company jsonb;
  publication jsonb;
begin
  if not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin')
  ) and not exists (
    select 1
    from public.profiles profile
    where profile.id = p_user_id
      and profile.role = 'super_admin'
      and coalesce(profile.status, 'active') not in ('inactive', 'suspended')
  ) then
    raise exception 'ONBOARDING_FORBIDDEN';
  end if;

  update public.organizations
  set name = p_display_name,
      logo_url = nullif(p_logo_url, ''),
      updated_at = completed_at
  where id = p_organization_id;

  if not found then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  insert into public.organization_settings (
    organization_id, display_name, currency, timezone, branding, modules, updated_at
  )
  values (
    p_organization_id, p_display_name, p_currency, p_timezone,
    '{}'::jsonb, coalesce(p_modules, '{}'::jsonb), completed_at
  )
  on conflict (organization_id) do update
  set display_name = excluded.display_name,
      currency = excluded.currency,
      timezone = excluded.timezone,
      modules = excluded.modules,
      updated_at = excluded.updated_at;

  select branch.id
  into target_branch_id
  from public.branches branch
  where branch.organization_id = p_organization_id
    and (branch.is_default = true or branch.slug = 'principal')
  order by branch.is_default desc, branch.created_at asc
  limit 1
  for update;

  if target_branch_id is null then
    insert into public.branches (
      organization_id, code, name, slug, address, city, phone, email,
      is_active, is_default, metadata, updated_at
    )
    values (
      p_organization_id, 'principal', 'Sucursal principal', 'principal',
      p_branch->>'address', p_branch->>'city',
      nullif(p_branch->>'phone', ''), nullif(p_branch->>'email', ''),
      true, true,
      jsonb_build_object('onboarding_completed_at', completed_at),
      completed_at
    )
    returning id into target_branch_id;
  else
    update public.branches
    set address = p_branch->>'address',
        city = p_branch->>'city',
        phone = nullif(p_branch->>'phone', ''),
        email = nullif(p_branch->>'email', ''),
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object('onboarding_completed_at', completed_at),
        updated_at = completed_at
    where id = target_branch_id;
  end if;

  -- ---------------------------------------------------------------------
  -- company_info: fusion, no reemplazo
  -- ---------------------------------------------------------------------
  select value into existing_company
  from public.website_settings
  where organization_id = p_organization_id and key = 'company_info';

  existing_company := coalesce(existing_company, '{}'::jsonb);

  -- `||` deja ganar al lado derecho y conserva las claves que solo estan en el
  -- izquierdo: lo que el onboarding no menciona sobrevive.
  merged_company := existing_company || coalesce(p_company_info, '{}'::jsonb);

  -- `hours` es un objeto anidado y `||` es superficial: sin este paso, mandar
  -- {weekdays, saturday} borraria el domingo que el admin habia cargado.
  if p_company_info ? 'hours' then
    merged_company := jsonb_set(
      merged_company,
      '{hours}',
      coalesce(existing_company->'hours', '{}'::jsonb) || coalesce(p_company_info->'hours', '{}'::jsonb)
    );
  end if;

  -- La publicacion es la unica que se reafirma desde la tabla canonica: nunca
  -- se habilita implicitamente al completar o revisitar el onboarding.
  select jsonb_build_object(
    'marketplacePublic', marketplace_public,
    'storefrontPublic', storefront_public
  )
  into publication
  from public.organizations
  where id = p_organization_id;

  merged_company := merged_company || coalesce(publication, '{}'::jsonb);

  insert into public.website_settings (
    organization_id, key, value, updated_by, updated_at
  )
  values (
    p_organization_id, 'company_info', merged_company, p_user_id, completed_at
  )
  on conflict (organization_id, key) do update
  set value = excluded.value,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'branch_id', target_branch_id,
    'completed_at', completed_at
  );
end;
$$;

revoke all on function public.complete_organization_onboarding(
  uuid, uuid, text, text, text, text, jsonb, jsonb, jsonb
) from public;

grant execute on function public.complete_organization_onboarding(
  uuid, uuid, text, text, text, text, jsonb, jsonb, jsonb
) to service_role;

comment on function public.complete_organization_onboarding(
  uuid, uuid, text, text, text, text, jsonb, jsonb, jsonb
) is
'Persiste el onboarding de forma atomica. company_info se FUSIONA con lo que ya hubiera (incluido el objeto hours) para no borrar la personalizacion hecha en /admin/website. La publicacion de la tienda nunca se habilita desde aca.';

commit;

notify pgrst, 'reload schema';

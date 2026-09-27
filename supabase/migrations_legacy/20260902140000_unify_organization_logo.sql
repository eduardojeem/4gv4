-- Un solo logo por tienda.
--
-- Habia dos lugares donde cargarlo y guardaban en campos distintos:
--
--   * El onboarding escribia `organizations.logo_url`, que es lo que leen el
--     directorio de /marketplace/empresas, el contexto de la organizacion y los
--     comprobantes de reparaciones.
--   * La pantalla /admin/website escribia `website_settings.company_info.logoUrl`,
--     que solo alimenta el encabezado de la tienda publica.
--
-- El endpoint de esa pantalla actualizaba la organizacion con nombre, slug y
-- visibilidad, pero no con el logo. Como el onboarding era el unico lugar del
-- proyecto que escribia `organizations.logo_url`, ese campo quedaba congelado
-- desde la creacion de la tienda: cambiar el logo despues no llegaba nunca al
-- directorio ni a los recibos.
--
-- El codigo ya escribe los dos. Falta emparejar lo que quedo desalineado.

begin;

-- Gana el de website_settings cuando hay diferencia, y no al reves.
--
-- No es arbitrario: `organizations.logo_url` solo se podia escribir una vez, al
-- crear la tienda, mientras que el de website_settings es el unico que el
-- comerciante podia editar. Cuando difieren, el editable es el que expresa lo
-- que quiso poner; el otro es lo que cargo el primer dia y no pudo cambiar.
update public.organizations o
set logo_url = nullif(trim(ws.value->>'logoUrl'), ''),
    updated_at = now()
from public.website_settings ws
where ws.organization_id = o.id
  and ws.key = 'company_info'
  and nullif(trim(ws.value->>'logoUrl'), '') is not null
  and coalesce(o.logo_url, '') is distinct from nullif(trim(ws.value->>'logoUrl'), '');

-- El camino inverso, para las tiendas que cargaron el logo en el onboarding y
-- nunca abrieron la pantalla del sitio: sin esto su encabezado publico seguiria
-- sin logo aunque el directorio lo muestre.
update public.website_settings ws
set value = jsonb_set(ws.value, '{logoUrl}', to_jsonb(o.logo_url), true),
    updated_at = now()
from public.organizations o
where o.id = ws.organization_id
  and ws.key = 'company_info'
  and nullif(trim(o.logo_url), '') is not null
  and coalesce(nullif(trim(ws.value->>'logoUrl'), ''), '') = '';

commit;

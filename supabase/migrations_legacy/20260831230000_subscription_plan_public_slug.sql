-- URL publica propia para cada plan comercial.
--
-- El parametro de la URL era el `tier`, un codigo interno que no coincide con
-- el nombre que se vende: el tier `free` es un plan pago llamado "Lite", asi
-- que quien lo elegia terminaba en /register?plan=free, como si fuera gratis.
--
-- No se puede derivar del nombre: "Pro" y "PRO+" producen el mismo texto al
-- limpiarlos ("pro"), y esa URL apuntaria a dos planes de precios distintos.
-- Por eso el slug es un campo explicito con unicidad garantizada por la base.

begin;

alter table public.subscription_plans
  add column if not exists public_slug text;

-- Backfill: se parte del nombre y, si ya esta tomado, se cae al tier, que es
-- unico por definicion. Asi ningun plan queda sin URL ni pisa a otro.
with slugged as (
  select
    id,
    tier,
    -- Se usa translate en vez de la extension unaccent para no depender de que
    -- este instalada en el proyecto.
    nullif(
      regexp_replace(
        regexp_replace(
          lower(translate(name, 'áàäâãéèëêíìïîóòöôõúùüûñÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑ',
                                'aaaaaeeeeiiiiooooouuuunAAAAAEEEEIIIIOOOOOUUUUN')),
          '[^a-z0-9]+', '-', 'g'
        ),
        '(^-+|-+$)', '', 'g'
      ),
      ''
    ) as base_slug
  from public.subscription_plans
),
resolved as (
  select
    id,
    case
      when base_slug is null then tier
      when count(*) over (partition by base_slug) > 1 then tier
      else base_slug
    end as final_slug
  from slugged
)
update public.subscription_plans sp
set public_slug = resolved.final_slug
from resolved
where resolved.id = sp.id
  and sp.public_slug is null;

-- A partir de aca el slug es obligatorio y unico: sin esto volveria a existir
-- la ambiguedad que hace que un cliente contrate el plan equivocado.
alter table public.subscription_plans
  alter column public_slug set not null;

create unique index if not exists subscription_plans_public_slug_key
  on public.subscription_plans (public_slug);

-- Solo minusculas, numeros y guiones: es lo que va en una URL.
alter table public.subscription_plans
  drop constraint if exists subscription_plans_public_slug_format;

alter table public.subscription_plans
  add constraint subscription_plans_public_slug_format
  check (public_slug ~ '^[a-z0-9][a-z0-9-]{0,47}$');

commit;

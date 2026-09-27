-- Repara productos de dabasica importados con combinaciones existentes, pero
-- con la bandera/configuración del padre y todas sus variantes desactivadas.
-- El usuario confirmó que incluso las combinaciones sin stock deben permanecer
-- activas para mostrarse como agotadas en catálogo, detalle y POS.

with affected_products as (
  select p.id
  from public.products p
  join public.organizations o on o.id = p.organization_id
  where o.slug = 'dabasica'
    and exists (select 1 from public.product_variants pv where pv.product_id = p.id)
    and (
      coalesce(p.has_variants, false) = false
      or coalesce(jsonb_array_length(p.variant_attribute_config), 0) = 0
    )
)
update public.product_variants pv
set is_active = true,
    updated_at = now()
where pv.product_id in (select id from affected_products);

with affected_products as (
  select p.id
  from public.products p
  join public.organizations o on o.id = p.organization_id
  where o.slug = 'dabasica'
    and exists (select 1 from public.product_variants pv where pv.product_id = p.id)
), variant_options as (
  select
    ap.id as product_id,
    coalesce((
      select jsonb_agg(color_value order by color_value)
      from (
        select distinct pv.attributes ->> 'color' as color_value
        from public.product_variants pv
        where pv.product_id = ap.id
          and nullif(trim(pv.attributes ->> 'color'), '') is not null
      ) colors
    ), '[]'::jsonb) as colors,
    coalesce((
      select jsonb_agg(size_value order by
        case upper(size_value)
          when 'XXS' then 1 when 'XS' then 2 when 'S' then 3 when 'M' then 4
          when 'L' then 5 when 'XL' then 6 when '2XL' then 7 when 'XXL' then 8
          else 99
        end,
        size_value
      )
      from (
        select distinct pv.attributes ->> 'size' as size_value
        from public.product_variants pv
        where pv.product_id = ap.id
          and nullif(trim(pv.attributes ->> 'size'), '') is not null
      ) sizes
    ), '[]'::jsonb) as sizes
  from affected_products ap
)
update public.products p
set has_variants = true,
    variant_attribute_config = (
      case when jsonb_array_length(vo.colors) > 0 then
        jsonb_build_array(jsonb_build_object(
          'key', 'color', 'label', 'Color', 'control', 'color', 'options', vo.colors
        ))
      else '[]'::jsonb end
      ||
      case when jsonb_array_length(vo.sizes) > 0 then
        jsonb_build_array(jsonb_build_object(
          'key', 'size', 'label', 'Talle', 'control', 'select', 'options', vo.sizes
        ))
      else '[]'::jsonb end
    ),
    updated_at = now()
from variant_options vo
where p.id = vo.product_id;


-- Read-only public catalog projection. Only the server service role may invoke it.
create extension if not exists unaccent with schema extensions;

create or replace function public.get_marketplace_effective_catalog(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_limit int := coalesce((p_filters->>'limit')::int,28);
  v_offset int := coalesce((p_filters->>'offset')::int,0);
  v_sort text := coalesce(p_filters->>'sort','default');
  v_offers boolean := coalesce((p_filters->>'only_offers')::boolean,false);
  v_category_ids uuid[];
  v_brand_ids uuid[];
  v_words text[];
  v_result jsonb;
begin
  if jsonb_typeof(p_filters) <> 'object' or v_limit not between 1 and 100 or v_offset<0
    or v_sort not in ('default','price_asc','price_desc','newest','name_asc') then
    raise exception 'INVALID_CATALOG_FILTERS' using errcode='22023';
  end if;
  select array_agg(value::uuid) into v_category_ids from jsonb_array_elements_text(p_filters->'category_ids');
  select array_agg(value::uuid) into v_brand_ids from jsonb_array_elements_text(p_filters->'brand_ids');
  v_words := regexp_split_to_array(lower(extensions.unaccent(left(trim(coalesce(p_filters->>'q','')),120))), '\s+');

  with eligible as materialized (
    select p.*,coalesce(gb.name,b.name,nullif(trim(p.brand),'')) as facet_brand,
      coalesce(gb.logo_url,b.logo_url) as brand_logo,
      coalesce(gc.id,c.id) as facet_category_id,coalesce(gc.name,c.name) as facet_category_name,
      coalesce(gc.parent_id,c.parent_id) as facet_category_parent,
      (p.has_variants or exists(select 1 from public.product_variants v where v.product_id=p.id and v.organization_id=p.organization_id)) as uses_variants
    from public.products p
    join public.organizations o on o.id=p.organization_id and o.marketplace_public and o.storefront_public
    left join public.brands b on b.id=p.brand_id and b.organization_id=p.organization_id
    left join public.global_brands gb on gb.id=b.global_brand_id
    left join public.categories c on c.id=p.category_id and c.organization_id=p.organization_id
    left join public.global_categories gc on gc.id=c.global_category_id
    where p.is_active and p.visibility='public'
      and not exists(select 1 from public.subscriptions s where s.organization_id=o.id and s.status::text in ('past_due','canceled','suspended'))
      and (v_category_ids is null or p.category_id=any(v_category_ids))
      and not exists(select 1 from unnest(v_words) word where word<>'' and strpos(
        lower(extensions.unaccent(concat_ws(' ',p.name,p.sku,p.brand,p.description,p.device_brand))),word)=0)
  ), parent_prices as (
    select e.*, promo.name as promo_name,
      case when e.has_offer and e.offer_price>0 and e.offer_price<e.sale_price
        and (promo.price is null or e.offer_price<=promo.price) then e.offer_price
        else promo.price end as parent_offer,
      case when e.has_offer and e.offer_price>0 and e.offer_price<e.sale_price
        and (promo.price is null or e.offer_price<=promo.price) then null else promo.name end as effective_promo_name
    from eligible e
    left join lateral (
      select pr.name,round(e.sale_price*(1-pr.value::numeric/100)) as price
      from public.promotions pr
      where pr.organization_id=e.organization_id and pr.is_active and pr.public_mode='automatic' and pr.type='percentage'
        and coalesce(pr.min_purchase,0)<=0
        and (pr.start_date is null or pr.start_date<=statement_timestamp())
        and (pr.end_date is null or pr.end_date>=statement_timestamp())
        and (pr.usage_limit is null or coalesce(pr.usage_count,0)<pr.usage_limit)
        and (e.id::text=any(pr.applicable_products::text[]) or e.category_id::text=any(pr.applicable_categories::text[]))
        and round(e.sale_price*(1-pr.value::numeric/100))>0
        and round(e.sale_price*(1-pr.value::numeric/100))<e.sale_price
      order by price,pr.id limit 1
    ) promo on true
  ), options as (
    select e.id as product_id,null::uuid as variant_id,e.sale_price as base_price,
      coalesce(e.parent_offer,e.sale_price) as price,e.stock_quantity as stock
    from parent_prices e where not e.uses_variants and e.stock_quantity>0
    union all
    select e.id,v.id,v.sale_price,
      case when e.parent_offer>0 and e.sale_price>0
        and round(v.sale_price*e.parent_offer/e.sale_price)>0
        and round(v.sale_price*e.parent_offer/e.sale_price)<v.sale_price
        then round(v.sale_price*e.parent_offer/e.sale_price) else v.sale_price end,
      v.stock_quantity
    from parent_prices e join public.product_variants v on v.product_id=e.id and v.organization_id=e.organization_id
    where e.uses_variants and v.is_active and v.stock_quantity>0
  ), stock as (
    select product_id,sum(stock) as quantity from options group by product_id
  ), selected_options as (
    select * from options where not v_offers or (price>0 and price<base_price)
  ), representatives as (
    select distinct on(product_id) * from selected_options order by product_id,price,variant_id
  ), ranges as (
    select product_id,min(price)<>max(price) as price_from from selected_options group by product_id
  ), summaries as materialized (
    select e.*,r.price as effective_price,r.base_price as original_price,r.variant_id,
      s.quantity,ran.price_from,(r.price>0 and r.price<r.base_price) as is_offer
    from parent_prices e join representatives r on r.product_id=e.id
    join stock s on s.product_id=e.id join ranges ran on ran.product_id=e.id
  ), filtered as materialized (
    select * from summaries s where nullif(trim(p_filters->>'brand'),'') is null
      or lower(s.brand)=lower(trim(p_filters->>'brand')) or s.brand_id=any(v_brand_ids)
      or lower(s.facet_brand)=lower(trim(p_filters->>'brand'))
  ), ranked as (
    select f.*,row_number() over(order by
      case when v_sort in ('price_asc','price_desc') then f.hide_price else false end,
      case when v_sort='price_asc' and not f.hide_price then f.effective_price end asc,
      case when v_sort='price_desc' and not f.hide_price then f.effective_price end desc,
      case when v_sort='name_asc' then f.name end asc,
      case when v_sort='default' then f.featured end desc,
      case when v_sort not in ('price_asc','price_desc') or not f.hide_price then f.created_at end desc,
      f.id) as row_position
    from filtered f
  ), page as (
    select * from ranked order by row_position limit v_limit offset v_offset
  ), brands as (
    select facet_brand as name,count(*) as product_count,count(distinct organization_id) as organization_count,max(brand_logo) as logo_url
    from summaries where facet_brand is not null group by facet_brand
  ), categories as (
    select facet_category_id as id,facet_category_name as name,facet_category_parent as parent_id,count(*) as product_count,count(distinct organization_id) as organization_count
    from summaries where facet_category_id is not null group by facet_category_id,facet_category_name,facet_category_parent
  )
  select jsonb_build_object(
    'total',(select count(*) from filtered),
    'rows',coalesce((select jsonb_agg(jsonb_build_object('product_id',id,
    'pricing',case when hide_price then null else jsonb_build_object('has_offer',parent_offer is not null,'offer_price',parent_offer,'promotion_name',effective_promo_name) end,
    'summary',jsonb_build_object(
      'stockQuantity',quantity,'price',case when hide_price then null else effective_price end,
      'originalPrice',case when hide_price or not is_offer then null else original_price end,
      'priceFrom',not hide_price and price_from,'hasOffer',not hide_price and is_offer,
      'representativeVariantId',case when hide_price then null else variant_id end,
      'promotionName',case when hide_price or not is_offer then null else effective_promo_name end
    )) order by row_position) from page),'[]'::jsonb),
    'brands',coalesce((select jsonb_agg(to_jsonb(b) order by product_count desc,name) from brands b),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(to_jsonb(c) order by name,id) from categories c),'[]'::jsonb)
  ) into v_result;
  return v_result;
end
$function$;

revoke all on function public.get_marketplace_effective_catalog(jsonb) from public,anon,authenticated;
grant execute on function public.get_marketplace_effective_catalog(jsonb) to service_role;

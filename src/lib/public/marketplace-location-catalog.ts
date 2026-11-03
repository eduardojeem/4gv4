import 'server-only'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAllMarketplaceOrganizations, getMarketplaceCatalogBatch, type MarketplaceOrganization, type MarketplaceProduct, resolveCategoryIds, getMarketplaceCategories, type MarketplaceCategory, type MarketplaceBrand } from './marketplace'
import { locationFacets, type MarketplaceLocation, type PublicLocation } from './marketplace-location'
let pending: {value:Promise<{stores:MarketplaceOrganization[];products:MarketplaceProduct[]}>} | null = null
/** Reuses bounded public-page caches; never caches a user's search/favorites. */
export function getLocationCatalog():Promise<{stores:MarketplaceOrganization[];products:MarketplaceProduct[]}> {
 if(pending)return pending.value
 const value=(async()=>{
  const [stores,first]=await Promise.all([getAllMarketplaceOrganizations(),getMarketplaceCatalogBatch()])
  const products=[...first.products]
  for(let offset=100;offset<first.total;offset+=100){const page=await getMarketplaceCatalogBatch(offset);products.push(...page.products)}
  if(new Set(products.map(product=>product.id)).size!==products.length)throw new Error('El catálogo cambió durante la consulta; reintentá.')
  const ids=new Set(stores.map(store=>store.id))
  return {stores,products:products.filter(product=>ids.has(product.organization_id))}
 })()
 pending={value}
 value.then(()=>{if(pending?.value===value)pending=null},()=>{if(pending?.value===value)pending=null})
 return value
}
export function storeMatchesLocation(store:Pick<MarketplaceOrganization,'countryCode'|'locations'>,selection:MarketplaceLocation) {
 if(selection.country!=='all'&&(store.countryCode??'unknown')!==selection.country)return false
 return selection.city==='all'||Boolean(store.locations?.some(location=>location.key===selection.city))
}
export async function getScopedLocationCatalog(selection:MarketplaceLocation){
 const catalog=await getLocationCatalog()
 const stores=catalog.stores.filter(store=>storeMatchesLocation(store,selection))
 const ids=new Set(stores.map(store=>store.id))
 return {stores,products:catalog.products.filter(product=>ids.has(product.organization_id)),facets:{...locationFacets(catalog.stores.map(store=>({...store,locations:store.locations??[]})),selection.country),allCities:locationFacets(catalog.stores.map(store=>({...store,locations:store.locations??[]}))).cities}}
}
export type LocatedProductOptions={country?:string;city?:string;q?:string;categoria?:string;subcategoria?:string;marca?:string;organizationId?:string;onlyOffers?:boolean;offset?:number;orden?:string}
export async function getLocatedProductsPage(limit:number,options:LocatedProductOptions){
 const {products}=await getScopedLocationCatalog({country:options.country??'all',city:options.city??'all'})
 const q=options.q?.trim().toLowerCase(),category=options.subcategoria||options.categoria,brand=options.marca?.toLowerCase()
 const categoryIds=category?await resolveCategoryIds(createAdminSupabase(),category):undefined
 let list=products.filter(product=>(!options.organizationId||product.organization_id===options.organizationId)&&(!q||[product.name,product.brand,product.organization_name,product.category?.name].some(value=>value?.toLowerCase().includes(q)))&&(!category||Boolean(categoryIds?.includes(product.category?.id??'')))&&(!brand||product.brand?.toLowerCase()===brand)&&(!options.onlyOffers||product.has_offer&&!product.hide_price))
 const mixedCurrencies=new Set(list.map(product=>product.currency??'PYG')).size>1
 const order=mixedCurrencies&&options.orden?.startsWith('price_')?'default':options.orden
 list=[...list].sort((a,b)=>order==='price_asc'?a.sale_price-b.sale_price:order==='price_desc'?b.sale_price-a.sale_price:order==='name_asc'?a.name.localeCompare(b.name):order==='newest'?(b.created_at??'').localeCompare(a.created_at??''):Number(b.featured)-Number(a.featured))
 const metadata=await getMarketplaceCategories()
 const categoryMetadata=new Map(metadata.map(item=>[item.id,item])),categories=new Map<string,MarketplaceCategory>(),categoryStores=new Map<string,Set<string>>(),brands=new Map<string,MarketplaceBrand>(),brandStores=new Map<string,Set<string>>()
 for(const product of products){
  if(product.category){let key:string|null=product.category.id;const visited=new Set<string>();while(key&&!visited.has(key)){visited.add(key);const item=categoryMetadata.get(key)??(key===product.category.id?{...product.category,parent_id:(product.category as {parent_id?:string|null}).parent_id}:null);if(!item)break;const facet=categories.get(key)??{id:item.id,name:item.name,parent_id:item.parent_id,product_count:0,organization_count:0};facet.product_count++;const orgs=categoryStores.get(key)??new Set<string>();orgs.add(product.organization_id);categoryStores.set(key,orgs);facet.organization_count=orgs.size;categories.set(key,facet);key=item.parent_id??null}}
  if(product.brand){const facet=brands.get(product.brand)??{name:product.brand,product_count:0,organization_count:0,logo_url:null};facet.product_count++;const orgs=brandStores.get(product.brand)??new Set<string>();orgs.add(product.organization_id);brandStores.set(product.brand,orgs);facet.organization_count=orgs.size;brands.set(product.brand,facet)}
 }
 return {products:list.slice(options.offset??0,(options.offset??0)+limit),total:list.length,mixedCurrencies,categories:[...categories.values()],brands:[...brands.values()]}
}
export const directoryLocations=(store:MarketplaceOrganization):PublicLocation[]=>store.locations??[]

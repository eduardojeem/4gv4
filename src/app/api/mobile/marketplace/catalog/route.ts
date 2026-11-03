import { NextResponse } from 'next/server'
import { getScopedLocationCatalog } from '@/lib/public/marketplace-location-catalog'
import { parseMarketplaceLocation } from '@/lib/public/marketplace-location'
import { filterMarketProducts, marketPage } from '@/lib/public/mobile-marketplace-query'
import { getMarketplaceBrands } from '@/lib/public/marketplace'
import { getSiteUrl } from '@/lib/site-url'
import { logger } from '@/lib/logger'
const absolute=(url:string|null|undefined)=>!url?null:/^https?:\/\//i.test(url)?url:getSiteUrl().replace(/\/$/,'')+(url.startsWith('/')?'':'/')+url
export async function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams
  if(!/^(all|unknown|[A-Z]{2})$/.test(params.get('country')??'all')||!/^(all|(?:[A-Z]{2}|unknown):[a-z0-9-]+)$/.test(params.get('city')??'all'))return NextResponse.json({error:'Ubicación inválida.'},{status:400})
  if((params.get('country')??'all')!=='all'&&(params.get('city')??'all')!=='all'&&!params.get('city')!.startsWith(params.get('country')!+':'))return NextResponse.json({error:'La ciudad no corresponde al país seleccionado.'},{status:400})
  const selection=parseMarketplaceLocation({country:params.get('country')??'all',city:params.get('city')??'all'})
  const catalog=await getScopedLocationCatalog(selection)
  const brandMetadata=new Map((await getMarketplaceBrands(100)).map(brand=>[brand.name.toLowerCase(),brand.logo_url??null]))
  const stores=catalog.stores.map(store=>({id:store.id,name:store.name,slug:store.slug,logo:absolute(store.logo_url),city:store.city??null,cityKey:store.locations?.[0]?.key??null,countryCode:store.countryCode??null,locations:store.locations??[],businessVertical:store.business_vertical??null,operatingModel:store.operating_model??null,rubro:store.rubro??null,whatsapp:store.whatsapp??store.phone??null,products:store.products_count,rating:store.review_rating_avg??null}))
  const directory=new Map(catalog.stores.map(store=>[store.id,store]))
  const products=catalog.products.map(product=>{
   const store=directory.get(product.organization_id)
   return {id:product.id,name:product.name,brand:product.brand??null,category:product.category?{id:product.category.id,name:product.category.name,parentId:(product.category as {parent_id?:string|null}).parent_id??null}:null,image:absolute(product.image??product.images?.[0]),price:product.hide_price?null:product.sale_price,offerPrice:!product.hide_price&&product.has_offer&&product.offer_price&&product.offer_price<product.sale_price?product.offer_price:null,inStock:product.in_stock,featured:product.featured,currency:store?.currency??'PYG',store:{name:product.organization_name,slug:product.organization_slug,whatsapp:store?.whatsapp??store?.phone??null,countryCode:store?.countryCode??null,locations:store?.locations??[]}}
  })
  const currencies=[...new Set(products.map(product=>product.currency))]
  const priceFilteringAvailable=currencies.length<=1
  if((params.get('favorites')??'').split(',').length>1000)return NextResponse.json({error:'Demasiados favoritos para esta consulta.'},{status:400})
  const favorites=params.has('favorites')?(params.get('favorites')??'').split(',').filter(Boolean).slice(0,1000):undefined
  const filtered=filterMarketProducts(products,{q:params.get('q')??'',category:params.get('category')??'',brand:params.get('brand')??'',store:params.get('store')??'',onlyOffers:params.get('onlyOffers')==='1',inStock:params.get('inStock')==='1',priceRange:priceFilteringAvailable&&currencies[0]==='PYG'?params.get('priceRange')??'all':'all',favorites,sort:!priceFilteringAvailable&&params.get('sort')?.startsWith('price_')?'default':params.get('sort')??'default'})
  const offerList=filterMarketProducts(products,{q:params.get('offerQ')??'',onlyOffers:true,sort:!priceFilteringAvailable&&params.get('offerSort')?.startsWith('price_')?'default':params.get('offerSort')??'default'})
  const query=(params.get('storeQ')??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
  const filteredStores=stores.filter(store=>!query||[store.name,store.rubro,...store.locations.map(location=>location.city)].some(value=>value?.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query)))
  const productPage=marketPage(filtered,params.get('productPage'),10),offerPage=marketPage(offerList,params.get('offerPage'),10),storePage=marketPage(filteredStores,params.get('storePage'),8)
  const categories=new Map<string,{id:string;name:string;count:number}>(),brands=new Map<string,{name:string;logo:string|null;count:number}>()
  for(const product of products){if(product.category){const item=categories.get(product.category.id)??{id:product.category.id,name:product.category.name,count:0};item.count++;categories.set(item.id,item)}if(product.brand){const item=brands.get(product.brand)??{name:product.brand,logo:absolute(brandMetadata.get(product.brand.toLowerCase())),count:0};item.count++;brands.set(item.name,item)}}
  const {items:pp,...pmeta}=productPage,{items:op,...ometa}=offerPage,{items:sp,...smeta}=storePage
  return NextResponse.json({products:pp,offers:op,stores:sp,storeOptions:stores,categories:[...categories.values()],brands:[...brands.values()],stats:[{key:'stores',value:stores.length},{key:'products',value:products.length},{key:'cities',value:catalog.facets.cities.length}],location:{selection,...catalog.facets},priceFilteringAvailable,currency:currencies.length===1?currencies[0]:null,home:{products:filterMarketProducts(products,{q:params.get('homeQ')??''}).slice(0,8),total:filterMarketProducts(products,{q:params.get('homeQ')??''}).length,offers:filterMarketProducts(products,{onlyOffers:true}).slice(0,20),stores:stores.slice(0,4)},pagination:{products:pmeta,offers:ometa,stores:smeta}},{headers:{'Cache-Control':'no-store'}})
 }catch(error){logger.error('[marketplace-location] Consulta pública no disponible',error);return NextResponse.json({error:'No pudimos cargar el marketplace. Reintentá en unos momentos.'},{status:503})}
}

/** Read-only search body avoids putting large local favorites lists in URLs. */
export async function POST(request:Request){let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'Consulta inválida.'},{status:400})}const favorites=(body as {favorites?:unknown})?.favorites;if(!Array.isArray(favorites)||favorites.length>1000||favorites.some(id=>typeof id!=='string'||id.length>100||id.includes(',')))return NextResponse.json({error:'Favoritos inválidos.'},{status:400});const url=new URL(request.url);url.searchParams.set('favorites',favorites.join(','));return GET(new Request(url))}

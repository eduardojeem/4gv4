import { beforeEach, expect, it, vi } from 'vitest'
import { publicLocation,locationFacets } from '../lib/public/marketplace-location'
const state=vi.hoisted(()=>({fail:false}))
vi.mock('@/lib/site-url',()=>({getSiteUrl:()=> 'http://localhost:3000'}))
vi.mock('@/lib/logger',()=>({logger:{error:vi.fn()}}))
vi.mock('@/lib/public/marketplace',()=>({getMarketplaceBrands:async()=>[{name:'Marca',logo_url:'/logo.png'}]}))
vi.mock('@/lib/public/marketplace-location-catalog',()=>({getScopedLocationCatalog:async(selection:{country:string;city:string})=>{
 if(state.fail)throw new Error('unavailable')
 const allStores=[{id:'py',name:'Uno',slug:'uno',logo_url:null,city:'Asunción',countryCode:'PY',currency:'PYG',locations:[publicLocation('PY','Asunción')!,publicLocation('PY','Encarnación')!],rubro:'comercio',products_count:1500},{id:'ar',name:'Dos',slug:'dos',logo_url:null,city:'San Lorenzo',countryCode:'AR',currency:'ARS',locations:[publicLocation('AR','San Lorenzo')!],rubro:'comercio',products_count:1}]
 const stores=allStores.filter(store=>(selection.country==='all'||store.countryCode===selection.country)&&(selection.city==='all'||store.locations.some(location=>location.key===selection.city)))
 const products=Array.from({length:1501},(_,index)=>({id:String(index),name:'Producto '+index,brand:'Marca',organization_id:index===1500?'ar':'py',organization_name:index===1500?'Dos':'Uno',organization_slug:index===1500?'dos':'uno',sale_price:100,image:null,in_stock:true,featured:false,has_offer:index===1499,offer_price:50,hide_price:false,category:null})).filter(product=>stores.some(store=>store.id===product.organization_id))
 return {stores,products,facets:{...locationFacets(allStores,selection.country),allCities:locationFacets(allStores).cities}}
}}))
import {GET,POST} from '../app/api/mobile/marketplace/catalog/route'
beforeEach(()=>{state.fail=false})
it('paginates after geography, including records beyond the old 1000-product ceiling',async()=>{const response=await GET(new Request('http://localhost/catalog?country=PY&city=PY:encarnacion&productPage=150'));const body=await response.json();expect(response.status).toBe(200);expect(body.products).toHaveLength(10);expect(body.products[9].id).toBe('1499');expect(body.pagination.products.total).toBe(1500);expect(body.stores.map((store:{id:string})=>store.id)).toEqual(['py']);expect(body.offers).toHaveLength(1)})
it('never merges the same city from another country and rejects contradictory selection',async()=>{const body=await(await GET(new Request('http://localhost/catalog?country=AR&city=AR:san-lorenzo'))).json();expect(body.products.map((item:{id:string})=>item.id)).toEqual(['1500']);expect((await GET(new Request('http://localhost/catalog?country=PY&city=AR:san-lorenzo'))).status).toBe(400)})
it('keeps local favorites as a read-only request body and filters before pagination',async()=>{const response=await POST(new Request('http://localhost/catalog?country=PY',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({favorites:['1499']})}));const body=await response.json();expect(body.products.map((item:{id:string})=>item.id)).toEqual(['1499']);expect(body.pagination.products.total).toBe(1)})
it('reports a service failure rather than a successful empty marketplace',async()=>{state.fail=true;expect((await GET(new Request('http://localhost/catalog'))).status).toBe(503)})

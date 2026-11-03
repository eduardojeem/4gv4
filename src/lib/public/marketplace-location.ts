import { normalizeCity, removeAccents } from './city-normalizer'
import { countryLabel } from '../regional/country-labels'
export type PublicLocation = { key: string; city: string; countryCode: string | null }
export type MarketplaceLocation = { country: string; city: string }
export const ALL_LOCATIONS: MarketplaceLocation = { country:'all', city:'all' }
export function publicLocation(country: string | null | undefined, city: string | null | undefined): PublicLocation | null {
 if (!city?.trim()) return null
 const countryCode = country && /^[A-Z]{2}$/.test(country.toUpperCase()) ? country.toUpperCase() : null
 let display = city.trim()
 const label = countryCode ? countryLabel(countryCode) : ''
 if (label) display = display.replace(new RegExp('[, -]+(?:'+label+'|'+countryCode+')$','i'),'').trim()
 const normalized = countryCode === 'PY' ? normalizeCity(display) : null
 const slug = normalized?.key ?? removeAccents(display).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
 if (!slug) return null
 return {key:(countryCode??'unknown')+':'+slug,city:normalized?.display??display,countryCode}
}
export function locationMatches(locations: PublicLocation[], selection: MarketplaceLocation) {
 return locations.some(location => (selection.country==='all'||(location.countryCode??'unknown')===selection.country) && (selection.city==='all'||location.key===selection.city))
}
export function parseMarketplaceLocation(value: unknown): MarketplaceLocation {
 if (!value || typeof value!=='object') return ALL_LOCATIONS
 const input=value as Record<string,unknown>
 const country=typeof input.country==='string' && /^(all|unknown|[A-Z]{2})$/.test(input.country)?input.country:'all'
 const city=typeof input.city==='string' && /^(all|(?:[A-Z]{2}|unknown):[a-z0-9-]+)$/.test(input.city)?input.city:'all'
 return {country,city:city!=='all'&&country!=='all'&&!city.startsWith(country+':')?'all':city}
}
export function locationFacets(stores: {id:string;locations:PublicLocation[];countryCode?:string|null}[],country='all') {
 const countries=new Map<string,Set<string>>(),cities=new Map<string,{key:string;label:string;count:number;countryCode:string|null}>()
 for(const store of stores){
  const code=store.countryCode??store.locations[0]?.countryCode??'unknown'
  if(!countries.has(code))countries.set(code,new Set());countries.get(code)!.add(store.id)
  if(country!=='all'&&code!==country)continue
  for(const location of new Map(store.locations.map(location=>[location.key,location])).values()){
   const facet=cities.get(location.key)??{key:location.key,label:location.city,countryCode:location.countryCode,count:0};facet.count++;cities.set(location.key,facet)
  }
 }
 return {countries:[...countries].map(([code,ids])=>({code,label:code==='unknown'?'País sin confirmar':countryLabel(code),count:ids.size})).sort((a,b)=>a.label.localeCompare(b.label)),cities:[...cities.values()].sort((a,b)=>a.label.localeCompare(b.label))}
}
export function pageItems<T>(items:T[],page=1,size=10){const total=items.length;const totalPages=Math.max(1,Math.ceil(total/size));const safe=Math.min(Math.max(1,page),totalPages);return {items:items.slice((safe-1)*size,safe*size),page:safe,total,totalPages}}

export function publicStoreAction(store:{businessVertical?:string|null;operatingModel?:string|null}){if(store.operatingModel==='repair')return {kind:'repairs',label:'Consultar reparación'} as const;if(store.operatingModel==='service'||['barbershop','beauty_services'].includes(store.businessVertical??''))return {kind:'services',label:'Ver servicios y reservas'} as const;return {kind:'products',label:'Ver productos'} as const}

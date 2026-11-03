import { pageItems } from './marketplace-location'
export type CatalogCard={id:string;name:string;brand:string|null;category?:{id:string;name:string;parentId?:string|null}|null;price:number|null;offerPrice:number|null;inStock:boolean;featured:boolean;currency?:string;store:{slug:string;name:string}}
export type PublicMarketQuery={q?:string;category?:string;brand?:string;store?:string;onlyOffers?:boolean;inStock?:boolean;priceRange?:string;favorites?:string[];sort?:string}
const text=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
export function filterMarketProducts<T extends CatalogCard>(products:T[],query:PublicMarketQuery){
 const q=text(query.q??''),brand=text(query.brand??''),favoriteIds=query.favorites?new Set(query.favorites):null
 let list=products.filter(product=>{
  if(q&&![product.name,product.store.name,product.brand,product.category?.name].some(value=>value&&text(value).includes(q)))return false
  if(query.category&&product.category?.id!==query.category&&product.category?.parentId!==query.category)return false
  if(brand&&!text(product.brand??'').includes(brand)&&!text(product.name).includes(brand))return false
  if(query.store&&product.store.slug!==query.store)return false
  if(query.onlyOffers&&product.offerPrice===null)return false
  if(query.inStock&&!product.inStock)return false
  if(favoriteIds&&!favoriteIds.has(product.id))return false
  const price=product.offerPrice??product.price
  if(query.priceRange&&query.priceRange!=='all'){
   if(price===null)return false
   if(query.priceRange==='under_100k'&&price>100000)return false
   if(query.priceRange==='100k_500k'&&(price<100000||price>500000))return false
   if(query.priceRange==='over_500k'&&price<=500000)return false
  }
  return true
 })
 list=[...list].sort((a,b)=>{
  const aa=a.offerPrice??a.price,bb=b.offerPrice??b.price
  if(query.sort==='price_asc')return (aa??Infinity)-(bb??Infinity)
  if(query.sort==='price_desc')return (bb??-Infinity)-(aa??-Infinity)
  if(query.sort==='name_asc')return a.name.localeCompare(b.name)
  if(query.sort==='discount')return (b.offerPrice&&b.price?1-b.offerPrice/b.price:0)-(a.offerPrice&&a.price?1-a.offerPrice/a.price:0)
  return Number(b.featured)-Number(a.featured)
 })
 return list
}
export function marketPage<T>(items:T[],value:string|null,size:number){const number=Number(value??1);return pageItems(items,Number.isSafeInteger(number)&&number>0?number:1,size)}

import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { createListRequestScope } from '../../mobile/src/lib/list-request-scope'
import { hasActiveCatalogOffer } from '@/lib/products/offer-filter'
const read=(path:string)=>readFileSync(path,'utf8')
it('ignores an old page after the user changes filter or leaves the screen',async()=>{
 const scope=createListRequestScope();const visible:string[]=[]
 const old=scope.capture();let finish!:(value:string)=>void
 const pending=new Promise<string>(resolve=>{finish=resolve}).then(value=>{if(old())visible.push(value)})
 scope.invalidate();const current=scope.capture();visible.push('new filter first page')
 finish('old filter page 2');await pending
 expect(visible).toEqual(['new filter first page']);expect(current()).toBe(true)
 scope.invalidate();expect(current()).toBe(false)
})
it('filters valid offers across the dataset before slicing and counting pages',()=>{
 const rows=Array.from({length:65},(_,index)=>({id:index,has_offer:index>=30,offer_price:50,sale_price:100}))
 const filtered=rows.filter(hasActiveCatalogOffer)
 expect(filtered).toHaveLength(35);expect(filtered.slice(0,30)[0].id).toBe(30);expect(filtered.slice(30)[0].id).toBe(60)
 expect(hasActiveCatalogOffer({has_offer:true,offer_price:0,sale_price:100})).toBe(false)
 expect(hasActiveCatalogOffer({has_offer:true,offer_price:100,sale_price:100})).toBe(false)
 const route=read('src/app/api/products/route.ts')
 expect(route).toContain("queryBuilder.eq('has_offer', true).gt('offer_price', 0)")
 expect(route).toContain('(count ?? 0) > baseProducts.length')
 expect(route.indexOf('hasActiveCatalogOffer(product)')).toBeLessThan(route.indexOf('catalogFilteredProducts.slice(from, to + 1)'))
 const client=read('mobile/src/lib/products.ts')
 expect(client).toContain("search.set('offers', 'true')");expect(client).not.toContain('page.products.filter(hasActiveOffer)')
})
it('all paginated screens guard stale completions and retain pagination with offers',()=>{
 for(const section of ['products','customers','credits','orders','repairs']){
  const source=read(`mobile/src/app/panel/${section}/index.tsx`)
  const page=source.slice(source.indexOf('const loadMore ='),source.indexOf('const loadMore =')+1800)
  expect(page).toContain('requestScope.capture()');expect(page).toContain('if (!isCurrent()) return;')
  expect(page).not.toContain("filter === 'offers'")
  expect(source).toContain('<PanelAccessState />')
 }
})
it('exposes backend capabilities without granting writes from section-read access',()=>{
 const api=read('src/app/api/mobile/dashboard/route.ts')
 expect(api).toContain('roleHasPermission(organization.role, permission)')
 const panel=read('mobile/src/lib/panel.tsx')
 expect(panel).toContain('data?.capabilities?.[permission] === true')
 expect(read('mobile/src/app/panel/categories/index.tsx')).toContain("disabled={!can('products.update') && !can('products.delete')}")
 expect(read('mobile/src/app/panel/customers/form.tsx')).toContain("can('crm.customers.manage') || (!editing && can('pos.sales.create'))")
})
it('starts loading in the request effect rather than a repeated filter click',()=>{
 const source=read('mobile/src/app/panel/products/index.tsx')
 const change=source.slice(source.indexOf('const change ='),source.indexOf('const loadMore ='))
 expect(change).not.toContain('setLoading(true)')
 for(const section of ['customers','credits']){
  const screen=read(`mobile/src/app/panel/${section}/index.tsx`)
  expect(screen.match(/setLoading\(true\)/g)).toHaveLength(1)
 }
})

// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({org:'B',membership:'seller',globalRole:'admin',grants:[] as {organization_id:string;permission:string}[],writes:[] as any[],queries:[] as any[]}))
vi.mock('server-only',()=>({}))
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth:(_options:any,handler:any)=>(request:any,context?:any)=>handler(request,{user:{id:'user',role:state.globalRole},organization:{id:state.org,role:state.membership,slug:'shop'}},context)}))
function query(table:string){
 const filters:Record<string,any>={};let op='read';let payload:any
 const q:any={select:()=>q,order:()=>q,is:()=>q,limit:()=>q,range:()=>q,in:()=>q,neq:()=>q,eq:(k:string,v:any)=>{filters[k]=v;return q},update:(p:any)=>{op='update';payload=p;state.writes.push({table,payload,filters});return q},insert:(p:any)=>{op='insert';payload=p;state.writes.push({table,payload,filters});return q},delete:()=>{state.writes.push({table,op:'delete'});return q}}
 const result=(single=false)=>{
 state.queries.push({table,filters:{...filters},op})
 if(table==='organization_members')return {data:{role:state.membership},error:null}
 if(table==='user_permissions')return {data:state.grants.filter(g=>g.organization_id===filters.organization_id),error:null}
 if(table==='products')return {data:filters.id==='foreign'?null:(single?{id:'product',name:'Test',sale_price:100,purchase_price:33,foreign_purchase_price:2,variants:[{purchase_price:22,purchasePrice:22}]}:[{id:'product',name:'Test',purchase_price:33,foreign_purchase_price:2,stock_quantity:0}]),error:null}
 if(table==='product_variants')return {data:filters.id==='foreign'?null:{id:'variant',product_id:'product',sku:'SKU',purchase_price:22,sale_price:100,stock_quantity:2,product:{sale_price:100,purchase_price:33}},error:null}
 return {data:[],error:null}
 }
 q.maybeSingle=async()=>result(true);q.single=async()=>result(true);q.then=(resolve:any)=>Promise.resolve(result()).then(resolve);return q
}
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:query,rpc:vi.fn()})}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:query,rpc:vi.fn()})}))
vi.mock('@/lib/branches/server',()=>({getRequestedBranchId:()=>null,resolveBranchScopeForUser:async()=>({branchId:null}),getDefaultBranch:async()=>null}))
vi.mock('@/lib/branches/inventory',()=>({loadBranchInventoryStockMap:async()=>({stockMap:new Map(),branchScoped:false}),applyBranchInventoryToProducts:(rows:any)=>rows,upsertBranchInventoryStock:vi.fn()}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn(),revalidateTag:vi.fn()}))
vi.mock('@/lib/products/uniqueness',()=>({findProductConflict:async()=>null,conflictMessage:()=>''}))
vi.mock('@/lib/saas/subscription-service',()=>({canCreateResource:async()=>({allowed:true})}))
vi.mock('@/lib/products/device-persist',()=>({persistDeviceFields:async()=>({campos:{}})}))
vi.mock('@/lib/products/price-visibility',()=>({persistPriceVisibility:async()=>({campos:{}})}))
vi.mock('@/lib/products/device-columns',()=>({productsHaveDeviceColumns:async()=>false,DEVICE_COLUMNS_MISSING_MESSAGE:''}))
vi.mock('@/lib/products/foreign-price',()=>({productsHaveForeignPriceColumns:async()=>false,foreignPriceColumns:()=>({}),foreignPriceErrorMessage:()=>null}))
vi.mock('@/lib/products/product-brand',()=>({resolveProductBrand:async()=>({}),ProductBrandError:class extends Error {}}))
import {GET as detail,PUT as updateDetail} from './[id]/route'
import {GET as list,POST as create,PUT as update} from './route'
import {GET as variant,PUT as updateVariant} from '../variants/[id]/route'
import {PUT as updateVariants} from '../variants/route'
import {GET as access} from './access/route'
const request=(body?:any)=>({url:'https://app/api/products',headers:new Headers(),json:async()=>body}) as any
const params=(id='product')=>({params:Promise.resolve({id})})
beforeEach(()=>{state.org='B';state.membership='seller';state.globalRole='admin';state.grants=[];state.writes=[];state.queries=[]})
it('redacts detail costs for global admin who is seller here; foreign org grant grants nothing',async()=>{
 state.grants=[{organization_id:'A',permission:'products.read_cost'}]
 const response=await detail(request(),params());const body=await response.json()
 expect(body.data).not.toHaveProperty('purchase_price');expect(body.data).not.toHaveProperty('foreign_purchase_price');expect(body.data.variants[0]).not.toHaveProperty('purchasePrice')
 expect(state.queries.filter(q=>q.table==='products').every(q=>q.filters.organization_id==='B')).toBe(true)
})
it('does not return a product or variant outside tenant scope',async()=>{
 expect((await detail(request(),params('foreign'))).status).toBe(404)
 expect((await variant(request(),params('foreign'))).status).toBe(404)
})
it('returns scoped capabilities and read grant does not authorize writes',async()=>{
 state.grants=[{organization_id:'B',permission:'products.read_cost'}]
 const response=await access(request());expect(await response.json()).toEqual({organizationId:'B',canReadCost:true,canUpdateCost:false});expect(response.headers.get('cache-control')).toBe('no-store')
 expect((await updateDetail(request({purchase_price:0}),params())).status).toBe(403);expect(state.writes).toHaveLength(0)
})
it('rejects every explicit write alias on product and variant endpoints before effects',async()=>{
 for(const [handler,body,context] of [
 [create,{purchase_price:0}], [update,{id:'product',foreign_purchase_price:3}], [update,{id:'product',variants:[{purchasePrice:0}]}],
 [updateDetail,{purchasePrice:0},params()], [updateVariant,{cost_price:0},params('variant')], [updateVariants,{variants:[{id:'variant',name:'a'},{id:'variant2',cost_price:0}]}],
 ] as any[]){expect((await handler(request(body),context)).status).toBe(403)}
 expect(state.writes).toHaveLength(0)
})
it('supports write-only grants, preserves omitted cost, allows zero and redacts write responses',async()=>{
 state.grants=[{organization_id:'B',permission:'products.update_cost'}]
 let response=await updateVariant(request({name:'Updated'}),params('variant'));expect(response.status).toBe(200);expect(state.writes[0].payload).not.toHaveProperty('purchase_price');expect((await response.json()).data).not.toHaveProperty('cost_price')
 state.writes=[];response=await updateVariant(request({purchase_price:0}),params('variant'));expect(response.status).toBe(200);expect(state.writes[0].payload.purchase_price).toBe(0)
})
it('re-evaluates capabilities after organization changes',async()=>{
 state.grants=[{organization_id:'A',permission:'products.read_cost'}];state.org='A';expect((await (await access(request())).json()).canReadCost).toBe(true)
 state.org='B';expect((await (await access(request())).json()).canReadCost).toBe(false)
})

it('collection PUT preserves omitted base cost and permits zero for the active organization admin',async()=>{
 const id='11111111-1111-4111-8111-111111111111'
 let response=await update(request({id,name:'Renamed'}));expect(response.status).toBe(200)
 expect(state.writes.find(row=>row.table==='products').payload).not.toHaveProperty('purchase_price')
 expect((await response.json()).data).not.toHaveProperty('purchase_price')
 state.writes=[];state.membership='admin'
 response=await update(request({id,purchase_price:0}));expect(response.status).toBe(200)
 expect(state.writes.find(row=>row.table==='products').payload.purchase_price).toBe(0)
 expect((await response.json()).data.purchase_price).toBe(33)
})
it('POST uses server default for omitted costs and redacts its response for a seller',async()=>{
 const response=await create(request({name:'Remera',sku:'REM1',sale_price:100,stock_quantity:0,min_stock:0}))
 expect(response.status).toBe(201)
 expect(state.writes.find(row=>row.table==='products').payload.purchase_price).toBe(0)
 expect((await response.json()).data).not.toHaveProperty('purchase_price')
})

it('invalid JSON objects are rejected as 400 before writes',async()=>{
 for(const value of [null,[],"invalid"]){
  expect((await create(request(value))).status).toBe(400)
  expect((await update(request(value))).status).toBe(400)
  expect((await updateDetail(request(value),params())).status).toBe(400)
  expect((await updateVariant(request(value),params('variant'))).status).toBe(400)
  expect((await updateVariants(request(value))).status).toBe(400)
 }
 expect((await create({json:async()=>{throw new SyntaxError('invalid')}} as any)).status).toBe(400)
 expect(state.writes).toHaveLength(0)
})
it('collection GET applies the same organization cost redaction',async()=>{
 const response=await list(request());expect(response.status).toBe(200)
 const body=await response.json();expect(body.data.products[0]).not.toHaveProperty('purchase_price')
 expect(body.data.products[0]).not.toHaveProperty('foreign_purchase_price')
})

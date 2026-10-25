// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({org:'B',membership:'seller',globalRole:'admin',grants:[] as {organization_id:string;permission:string}[],writes:[] as any[],queries:[] as any[],rpcCalls:[] as any[],createdProduct:null as any,skuRace:false,branch:null as string|null,branchReadError:false}))
vi.mock('server-only',()=>({}))
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth:(_options:any,handler:any)=>(request:any,context?:any)=>handler(request,{user:{id:'user',role:state.globalRole},organization:{id:state.org,role:state.membership,slug:'shop'}},context)}))
function query(table:string){
 const filters:Record<string,any>={};let op='read';let payload:any
 const q:any={select:()=>q,order:()=>q,is:()=>q,limit:()=>q,range:()=>q,in:(k:string,v:any)=>{filters[k]=v;return q},neq:()=>q,eq:(k:string,v:any)=>{filters[k]=v;return q},update:(p:any)=>{op='update';payload=p;state.writes.push({table,payload,filters});return q},insert:(p:any)=>{op='insert';payload=p;state.writes.push({table,payload,filters});return q},upsert:(p:any,options:any)=>{op='upsert';payload=p;state.writes.push({table,payload,filters,options});return q},delete:()=>{state.writes.push({table,op:'delete'});return q}}
 const result=(single=false)=>{
 state.queries.push({table,filters:{...filters},op})
 if(table==='organization_members')return {data:{role:state.membership},error:null}
 if(table==='user_permissions')return {data:state.grants.filter(g=>g.organization_id===filters.organization_id),error:null}
 if(table==='products'){
  if(op==='update' && state.skuRace)return {data:null,error:{code:'23505',message:'SKU conflict'}}
  if(filters.id==='foreign')return {data:null,error:null}
  const created=state.createdProduct
  const requestedIds=Array.isArray(filters.id)?filters.id:[]
  if(created&&(filters.id===created.id||requestedIds.includes(created.id)))return {data:single?created:[created],error:null}
  const productId=typeof filters.id==='string'?filters.id:Array.isArray(filters.id)?filters.id[0]:'product';return {data:single?{id:productId,name:'Test',sale_price:100,purchase_price:33,foreign_purchase_price:2,variants:[{id:'variant',stock_quantity:8,purchase_price:22,purchasePrice:22}]}:[{id:productId,name:'Test',purchase_price:33,foreign_purchase_price:2,stock_quantity:0}],error:null}
 }
 if(table==='branch_variant_inventory'){const ids=Array.isArray(filters.variant_id)?filters.variant_id:['variant'];return {data:state.branchReadError?null:ids.map(variant_id=>({variant_id,stock_quantity:3})),error:state.branchReadError?{code:'42501'}:null}}
 if(table==='product_variants'){const id=Array.isArray(filters.id)?filters.id[0]:filters.id||'variant';const row={id,product_id:filters.product_id||'product',organization_id:filters.organization_id||state.org,sku:'SKU',purchase_price:22,sale_price:100,stock_quantity:2,product:{sale_price:100,purchase_price:33}};return {data:filters.id==='foreign'?null:single?row:[row],error:null}}
 return {data:[],error:null}
 }
 q.maybeSingle=async()=>result(true);q.single=async()=>result(true);q.then=(resolve:any)=>Promise.resolve(result()).then(resolve);return q
}
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:query,rpc:async(name:string,args:any)=>{
 state.rpcCalls.push({name,args})
 if(name==='create_simple_product_atomic'){
  if(state.skuRace)return {data:null,error:{code:'23505',message:'SKU conflict'}}
  const product=args.p_product
  state.createdProduct={id:'created-product',name:product.name,sale_price:product.sale_price,purchase_price:product.purchase_price??null,foreign_purchase_price:product.foreign_purchase_price??null,stock_quantity:product.stock_quantity??0}
  return {data:{product_id:state.createdProduct.id},error:null}
 }
 if(name==='set_variant_branch_stock_target')return {data:{idempotent:false,movement_id:'movement',stock_before:3,stock_after:args.p_target_quantity,applied_delta:args.p_target_quantity-3},error:null}
 return {data:null,error:null}
}})}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:query,rpc:async()=>({data:null,error:null})})}))
vi.mock('@/lib/branches/server',()=>({getRequestedBranchId:(r:Request)=>new URL(r.url).searchParams.get('branch_id'),resolveBranchScopeForUser:async(args:any)=>({branchId:args.requestedBranchId&&args.requestedBranchId!==state.branch?null:state.branch}),getDefaultBranch:async()=>null}))
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
beforeEach(()=>{state.org='B';state.membership='seller';state.globalRole='admin';state.grants=[];state.writes=[];state.queries=[];state.rpcCalls=[];state.createdProduct=null;state.skuRace=false;state.branch=null;state.branchReadError=false})

it('POST reports the authoritative SKU constraint race as 409',async()=>{
 state.skuRace=true
 const response=await create(request({name:'Synthetic race',sku:' abc ',sale_price:100,stock_quantity:0,min_stock:0}))
 expect(response.status).toBe(409)
 expect(state.rpcCalls.find(c=>c.name==='create_simple_product_atomic').args.p_product).toMatchObject({organization_id:'B',sku:'ABC'})
})
it('both update APIs persist normalized SKU and report DB conflicts as 409',async()=>{
 const id='11111111-1111-4111-8111-111111111111'
 expect((await update(request({id,sku:' abc '}))).status).toBe(200)
 expect(state.writes.find(w=>w.table==='products')?.payload.sku).toBe('ABC')
 state.writes=[]
 expect((await updateDetail(request({sku:' def '}),params(id))).status).toBe(200)
 expect(state.writes.find(w=>w.table==='products')?.payload.sku).toBe('DEF')
 state.skuRace=true
 expect((await update(request({id,sku:' abc '}))).status).toBe(409)
 expect((await updateDetail(request({sku:' abc '}),params(id))).status).toBe(409)
})
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
 expect(state.writes).toHaveLength(0);expect(state.rpcCalls).toHaveLength(0)
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
it('POST uses the atomic RPC; unknown cost stays NULL and is redacted for a seller',async()=>{
 const response=await create(request({name:'Remera',sku:'REM1',sale_price:100,stock_quantity:0,min_stock:0}))
 expect(response.status).toBe(201)
 const call=state.rpcCalls.find(row=>row.name==='create_simple_product_atomic')
 expect(call).toBeDefined()
 expect(call.args.p_product).not.toHaveProperty('purchase_price')
 expect(state.createdProduct.purchase_price).toBeNull()
 expect((await response.json()).data).not.toHaveProperty('purchase_price')
})

it('POST preserves NULL, explicit zero, and positive costs for an authorized organization admin',async()=>{
 state.membership='admin'
 const cases=[
  {label:'omitted cost',body:{},expected:null},
  {label:'explicit null cost',body:{purchase_price:null},expected:null},
  {label:'explicit zero cost',body:{purchase_price:0},expected:0},
  {label:'positive cost',body:{purchase_price:25},expected:25},
 ]
 for(const [index,testCase] of cases.entries()){
  const response=await create(request({name:`Producto ${index}`,sku:`SKU${index}`,sale_price:100,stock_quantity:0,min_stock:0,...testCase.body}))
  expect(response.status, testCase.label).toBe(201)
  expect(state.createdProduct.purchase_price, testCase.label).toBe(testCase.expected)
  expect((await response.json()).data.purchase_price, testCase.label).toBe(testCase.expected)
 }
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

it('opt-in edit read projects authorized branch stock; other consumers keep aggregates', async()=>{
 state.membership='admin';state.branch='branch'
 const plain=await detail(request(),params())
 expect((await plain.json()).data.variants[0].stock_quantity).toBe(8)
 const scoped=await detail({...request(),url:'https://app/api/products/product?variant_stock_scope=branch&branch_id=branch'},params())
 expect(scoped.status).toBe(200)
 expect((await scoped.json()).data.variants[0].stock_quantity).toBe(3)
 expect(state.queries).toContainEqual(expect.objectContaining({table:'branch_variant_inventory',filters:expect.objectContaining({organization_id:'B',branch_id:'branch',variant_id:['variant']})}))
})
it('rejects a requested branch outside the resolved scope before saving variants', async()=>{
 state.membership='admin';state.branch='33333333-3333-4333-8333-333333333333'
 const body={id:'11111111-1111-4111-8111-111111111111',name:'Test',has_variants:true,variant_attribute_config:[{key:'size',label:'Tamaño',control:'select',options:['M']}],variants:[{id:'22222222-2222-4222-8222-222222222222',clientKey:'variant-1',name:'Black M',attributes:{size:'M'},sku:'SKU',salePrice:100,minStock:0,stockQuantity:10,isActive:true}]}
 const response=await update({...request(body),url:'https://app/api/products?branch_id=44444444-4444-4444-8444-444444444444'})
 expect(response.status).toBe(400)
 expect(state.rpcCalls.some(row=>row.name==='save_product_with_variants'||row.name==='set_variant_branch_stock_target')).toBe(false)
})

it('sets branch stock by target through the atomic RPC and propagates request idempotency', async()=>{
 state.membership='admin';state.branch='33333333-3333-4333-8333-333333333333'
 const headers=new Headers({'Idempotency-Key':'request-123'})
 const body={id:'11111111-1111-4111-8111-111111111111',name:'Test',has_variants:true,variant_attribute_config:[{key:'size',label:'Tamaño',control:'select',options:['M']}],variants:[{id:'22222222-2222-4222-8222-222222222222',clientKey:'variant-1',name:'Black M',attributes:{size:'M'},sku:'SKU',salePrice:100,minStock:0,stockQuantity:10,isActive:true}]}
 const response=await update({...request(body),url:'https://app/api/products?branch_id=33333333-3333-4333-8333-333333333333',headers})
 expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
 const targetCall=state.rpcCalls.find(row=>row.name==='set_variant_branch_stock_target')
 expect(targetCall?.args).toMatchObject({p_organization_id:'B',p_branch_id:'33333333-3333-4333-8333-333333333333',p_variant_id:'22222222-2222-4222-8222-222222222222',p_target_quantity:10,p_actor_id:'user',p_idempotency_key:'variant-target:request-123:22222222-2222-4222-8222-222222222222'})
 expect(state.rpcCalls.some(row=>row.name==='adjust_variant_stock_atomic')).toBe(false)
 const saveCall=state.rpcCalls.find(row=>row.name==='save_product_with_variants')
 expect(saveCall?.args.p_variants[0].stock_quantity).toBe(0)
 expect(state.writes.some(row=>row.table==='branch_variant_inventory'&&row.op==='upsert')).toBe(false)
})
it('keeps a safe namespaced idempotency fallback for legacy update callers without a header',async()=>{
 state.membership='admin';state.branch='33333333-3333-4333-8333-333333333333'
 const body={id:'11111111-1111-4111-8111-111111111111',name:'Test',has_variants:true,variant_attribute_config:[{key:'size',label:'Tamaño',control:'select',options:['M']}],variants:[{id:'22222222-2222-4222-8222-222222222222',clientKey:'variant-1',name:'Black M',attributes:{size:'M'},sku:'SKU',salePrice:100,minStock:0,stockQuantity:10,isActive:true}]}
 const response=await update(request(body))
 expect(response.status,JSON.stringify(await response.clone().json())).toBe(200)
 const targetCall=state.rpcCalls.find(row=>row.name==='set_variant_branch_stock_target')
 expect(targetCall?.args.p_idempotency_key).toMatch(/^variant-target:[0-9a-f-]{36}:22222222-2222-4222-8222-222222222222$/i)
})
it('rejects unresolved branch edit reads and fails closed on branch inventory errors', async()=>{
 const unresolved=await detail({...request(),url:'https://app/api/products/product?variant_stock_scope=branch&branch_id=other'},params())
 expect(unresolved.status).toBe(400)
 state.branch='branch';state.branchReadError=true
 const failed=await detail({...request(),url:'https://app/api/products/product?variant_stock_scope=branch&branch_id=branch'},params())
 expect(failed.status).toBe(500)
 expect((await failed.json()).data).toBeUndefined()
})

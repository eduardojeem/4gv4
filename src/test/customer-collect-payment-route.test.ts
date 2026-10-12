// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const ORG='11111111-1111-4111-8111-111111111111', BRANCH='22222222-2222-4222-8222-222222222222'
const ACTOR='33333333-3333-4333-8333-333333333333', CUSTOMER='44444444-4444-4444-8444-444444444444'
const state=vi.hoisted(()=>({ found:true, branchError:false, error:null as {message:string;code?:string}|null, calls:[] as Array<{name:string;args:Record<string,unknown>}> }))
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth:(_o:unknown,h:(r:unknown,c:unknown,x:unknown)=>unknown)=>(r:unknown,x:unknown)=>h(r,{organization:{id:ORG,role:'owner'},user:{id:ACTOR,role:'admin'}},x)}))
vi.mock('@/lib/branches/server',()=>({getRequestedBranchId:()=>BRANCH,resolveBranchScopeForUser:async()=>{if(state.branchError)throw new Error('Sucursal no autorizada');return {branchId:BRANCH}}}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({
 from:(table:string)=>{const b={select:()=>b,eq:()=>b,maybeSingle:async()=>({data:state.found?(table==='credit_installments'?{id:'66666666-6666-4666-8666-666666666666',credit_id:'99999999-9999-4999-8999-999999999999',customer_credits:{customer_id:CUSTOMER,organization_id:ORG}}:{id:CUSTOMER,name:'Fixture',credit_limit:1000}):null,error:null}),insert:()=>{throw new Error('Non-atomic write forbidden')}};return b},
 rpc:async(name:string,args:Record<string,unknown>)=>{state.calls.push({name,args});return {error:state.error,data:state.error?null:{
  receiptId:'77777777-7777-4777-8777-777777777777',receiptNumber:'COL-FIXTURE',appliedAmount:100,excessToStoreCredit:0,recordedAt:'2026-10-11T12:00:00Z',
  allocations:[{debtId:'66666666-6666-4666-8666-666666666666',type:'installment',paymentId:'88888888-8888-4888-8888-888888888888',appliedAmount:100,remainingBalance:50}]
 }}}
})}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({
 from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
 rpc:async()=>{throw new Error('Legacy financial RPC forbidden')}
})}))
import {POST} from '@/app/api/customers/[id]/collect-payment/route'
import {POST as creditPOST} from '@/app/api/credits/route'
async function collect(extra:Record<string,unknown>={}){
 const response=await (POST as unknown as (r:NextRequest,c:unknown)=>Promise<Response>)(new NextRequest('http://localhost/api/customers/'+CUSTOMER+'/collect-payment',{
 method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:100,paymentMethod:'cash',idempotencyKey:'fixture-key-12345',...extra})
 }),{params:Promise.resolve({id:CUSTOMER})})
 return {status:response.status,body:await response.json()}
}
beforeEach(()=>Object.assign(state,{found:true,branchError:false,error:null,calls:[]}))
describe('transactional customer collection API',()=>{
 it('returns persisted applied amount with one actor-scoped transaction',async()=>{
  const {status,body}=await collect();expect(status).toBe(200);expect(body.totalApplied).toBe(100);expect(body.collection.allocations[0].remainingBalance).toBe(50)
  expect(state.calls).toHaveLength(1);expect(state.calls[0]).toMatchObject({name:'collect_customer_payment_atomic',args:{p_actor_id:ACTOR,p_organization_id:ORG}})
 })
 it('rejects another tenant customer',async()=>{state.found=false;expect((await collect()).status).toBe(404);expect(state.calls).toHaveLength(0)})
 it('rejects unauthorized branch',async()=>{state.branchError=true;expect((await collect()).status).toBe(403);expect(state.calls).toHaveLength(0)})
 it.each([0,-1,1.001,1_000_000_001])('rejects invalid money %s',async amount=>{expect((await collect({amount})).status).toBe(400);expect(state.calls).toHaveLength(0)})
 it('requires transfer reference',async()=>{expect((await collect({paymentMethod:'transfer'})).status).toBe(400)})
 it('rejects a caller actor',async()=>{expect((await collect({actorId:ACTOR})).status).toBe(400);expect(state.calls).toHaveLength(0)})
 it.each([['COLLECTION_BALANCE_CHANGED',409],['COLLECTION_CASH_CLOSED',409],['COLLECTION_EXCESS_CONFIRMATION',422],['COLLECTION_IDEMPOTENCY_CONFLICT',409]])('reports %s without partial success',async(message,status)=>{
  state.error={message};const result=await collect();expect(result.status).toBe(status);expect(result.body.success).toBe(false);expect(result.body.partial).toBeUndefined()
 })
 it('requires migration without fallback',async()=>{state.error={code:'PGRST202',message:'Missing function'};expect((await collect()).status).toBe(503);expect(state.calls).toHaveLength(1)})
 it('credit payment uses the same transaction and persisted amount',async()=>{
  const response=await creditPOST(new NextRequest('http://localhost/api/credits',{method:'POST',body:JSON.stringify({
    installmentId:'66666666-6666-4666-8666-666666666666',method:'cash',amount:100,idempotencyKey:'credit-single-fixture'
  })}));const body=await response.json()
  expect(response.status).toBe(200);expect(body.data.appliedAmount).toBe(100)
  expect(body.data.collection.receiptNumber).toBe('COL-FIXTURE')
  expect(state.calls[0].name).toBe('collect_customer_payment_atomic')
 })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const state=vi.hoisted(()=>({failPage:false,ranges:[] as number[][],filters:[] as unknown[][],rows:[] as Array<Record<string,unknown>>}))
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth:(_options:unknown,handler:(request:unknown,context:unknown)=>Promise<Response>)=>(request:unknown)=>handler(request,{organization:{id:'org',role:'owner',name:'Shop'},user:{id:'u',role:'admin'}})}))
vi.mock('@/lib/branches/server',()=>({getRequestedBranchId:()=>null,resolveBranchScopeForUser:async()=>({branchId:'branch',branch:{name:'Local'}})}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:(table:string)=>{
 let start=0,end=499
 const q={select:()=>q,eq:(...args:unknown[])=>{state.filters.push([table,...args]);return q},is:()=>q,order:()=>q,limit:()=>q,
 range:(from:number,to:number)=>{start=from;end=to;state.ranges.push([from,to]);return q},abortSignal:()=>q,maybeSingle:()=>q,
 then:(resolve:(r:unknown)=>unknown)=>Promise.resolve(table==='cash_movements'?{data:state.failPage&&start>0?null:state.rows.slice(start,end+1),count:state.rows.length,error:state.failPage&&start>0?{message:'offline'}:null}:table==='cash_closures'?{data:{id:'session',register_id:'register',opening_balance:100,status:'open',created_at:'2026-10-18'},error:null}:table==='cash_registers'?{data:[{id:'register',name:'Caja',is_active:true}],error:null}:{data:null,error:null}).then(resolve)};return q
}})}))
import { GET } from '@/app/api/mobile/pos/session/route'
beforeEach(()=>{state.failPage=false;state.ranges=[];state.filters=[];state.rows=[...Array.from({length:1001},(_,i)=>({id:`sale-${i}`,type:'sale',amount:10,payment_method:'cash',sale_id:`sale-${i}`,created_at:'2026-10-18'})),{id:'opening',type:'opening',amount:100,payment_method:'cash',created_at:'2026-10-18'}]})
describe('mobile cash session totals have exact coverage',()=>{
 it('counts all movements beyond 1000 while returning only the recent display rows',async()=>{
  const response=await GET(new NextRequest('http://test/api/mobile/pos/session'));const body=await response.json()
  expect(response.status).toBe(200);expect(body.data.summary).toMatchObject({expectedCash:10110,salesCount:1001,salesTotal:10010})
  expect(body.data.summary.movements).toHaveLength(30);expect(state.ranges).toEqual([[0,499],[500,999],[1000,1499]])
  expect(state.filters).toContainEqual(['cash_movements','organization_id','org']);expect(state.filters).toContainEqual(['cash_movements','session_id','session'])
 })
 it('rejects a failed later page instead of publishing incomplete cash totals',async()=>{
  state.failPage=true;const response=await GET(new NextRequest('http://test/api/mobile/pos/session'))
  expect(response.status).toBe(500);expect(await response.json()).not.toHaveProperty('data.summary')
 })
})

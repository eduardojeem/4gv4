// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks=vi.hoisted(()=>({rpc:vi.fn(),context:{organization:{id:'00000000-0000-4000-8000-000000000001',role:'admin'},user:{id:'00000000-0000-4000-8000-000000000002'}}}))
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth: (_options:unknown, handler:(request:NextRequest,context:typeof mocks.context)=>unknown)=>(request:NextRequest)=>handler(request,mocks.context)}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({rpc:mocks.rpc})}))
import { GET, PATCH } from './route'
const creditId='00000000-0000-4000-8000-000000000003'
const common={creditId,expectedVersion:'a'.repeat(32),reason:'Corregir condiciones acordadas'}
const request=(payload:unknown)=>new NextRequest('http://localhost/api/credits/amendments',{method:'PATCH',body:JSON.stringify(payload)})
beforeEach(()=>{mocks.context.organization.role='admin';mocks.rpc.mockReset();mocks.rpc.mockResolvedValue({data:{version:'b'.repeat(32)},error:null})})
describe('credit amendment tenant boundary',()=>{
  it.each(['seller','manager','technician','super_admin'])('blocks %s even if they can collect payments',async role=>{
    mocks.context.organization.role=role
    expect((await GET(new NextRequest(`http://localhost/api/credits/amendments?creditId=${creditId}`))).status).toBe(403)
    expect((await PATCH(request({...common,action:'adjust_balance',installmentId:creditId,amount:200}))).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('uses server tenant and actor, rejecting client overrides',async()=>{
    expect((await PATCH(request({...common,action:'adjust_balance',installmentId:creditId,amount:200,organizationId:creditId}))).status).toBe(400)
    await PATCH(request({...common,action:'adjust_balance',installmentId:creditId,amount:200}))
    expect(mocks.rpc).toHaveBeenCalledWith('amend_customer_credit_atomic',expect.objectContaining({p_organization_id:mocks.context.organization.id,p_actor_id:mocks.context.user.id,p_credit_id:creditId}))
  })
  it('builds the installment plan on the server instead of accepting client balances',async()=>{
    const response=await PATCH(request({...common,action:'edit_terms',principalAmount:1000,interestRate:10,installmentCount:2,frequency:'monthly',firstDueDate:'2026-11-30'}))
    expect(response.status).toBe(200)
    const payload=mocks.rpc.mock.calls.find(([name])=>name==='amend_customer_credit_atomic')![1].p_request
    expect(payload.plan).toEqual([
      {dueDate:'2026-11-30',amount:550,principalComponent:500,interestComponent:50},
      {dueDate:'2026-12-30',amount:550,principalComponent:500,interestComponent:50},
    ])
    expect(payload).not.toHaveProperty('amount_paid')
  })
  it.each([['AMEND_CONFLICT',409],['AMEND_CASH_CLOSED',409],['AMEND_PAYMENT_UNLINKED',409],['AMEND_FORBIDDEN',403],['AMEND_NOT_FOUND',404]])('maps %s without exposing database details',async(message,status)=>{
    mocks.rpc.mockResolvedValue({data:null,error:{message:message+' private database details'}})
    const response=await PATCH(request({...common,action:'adjust_balance',installmentId:creditId,amount:200}))
    expect(response.status).toBe(status)
    expect(JSON.stringify(await response.json())).not.toContain('private database details')
  })
  it('fails closed when the migration has not been applied',async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}})
    expect((await GET(new NextRequest(`http://localhost/api/credits/amendments?creditId=${creditId}`))).status).toBe(503)
  })
  it('uses the tenant currency decimals instead of a global server default',async()=>{
    mocks.rpc.mockResolvedValueOnce({data:{fractionDigits:2},error:null}).mockResolvedValueOnce({data:{},error:null})
    await PATCH(request({...common,action:'edit_terms',principalAmount:100.25,interestRate:0,installmentCount:1,frequency:'monthly',firstDueDate:'2026-11-30'}))
    expect(mocks.rpc.mock.calls[1][1].p_request.plan[0].amount).toBe(100.25)
  })
})

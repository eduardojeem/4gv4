import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const m=vi.hoisted(()=>({rpc:vi.fn(),enabled:vi.fn()}))
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth:(_o:unknown,h:(r:Request,c:unknown)=>Promise<Response>)=>(r:Request)=>h(r,{organization:{id:'org'},user:{id:'actor',role:'owner'}})}))
vi.mock('@/lib/branches/server',()=>({getRequestedBranchId:()=>null,resolveBranchScopeForUser:async()=>({branchId:'branch'})}))
vi.mock('@/lib/saas/organization-module-check',()=>({isOrganizationModuleEnabled:m.enabled}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({rpc:m.rpc,from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:null,error:null})};return q}})}))
import { POST } from '@/app/api/pos/process-sale/route'
import { offlineBlockReason } from '@/lib/pos-offline/sync'
const id='11111111-1111-4111-8111-111111111111'
const request=()=>new NextRequest('http://x/api/pos/process-sale',{method:'POST',headers:{'x-idempotency-key':'attempt'},body:JSON.stringify({p_appointment_id:id,p_session_id:id,p_items:[{product_id:id,quantity:1}],p_payments:[]})})
describe('appointment checkout transport',()=>{
  beforeEach(()=>{m.rpc.mockReset();m.enabled.mockResolvedValue(true)})
  it('uses the atomic snapshot RPC even when a service is free',async()=>{
    m.rpc.mockResolvedValue({data:{sale_id:id,total:0},error:null})
    const response=await POST(request())
    expect(response.status).toBe(200)
    expect(m.rpc).toHaveBeenCalledWith('process_agenda_pos_sale',expect.objectContaining({p_org:'org',p_actor:'actor',p_appointment:id,p_payments:[]}))
  })
  it('does not degrade to catalog-price checkout when the migration is missing',async()=>{
    m.rpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'process_agenda_pos_sale missing'}})
    expect((await POST(request())).status).toBe(503)
    expect(m.rpc).toHaveBeenCalledTimes(1)
  })
  it('enforces the services module as well as POS permissions',async()=>{
    m.enabled.mockResolvedValue(false)
    expect((await POST(request())).status).toBe(403)
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('never queues an appointment payment offline',()=>{
    expect(offlineBlockReason({appointment_id:id,payments:[]})).toContain('turnos')
  })
})

import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks=vi.hoisted(()=>({role:'admin',aal:'aal2',rpc:vi.fn(),generateLink:vi.fn(),sendEmail:vi.fn(),quota:vi.fn(),from:vi.fn()}))
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth:(_options:unknown,handler:Function)=>(request:Request)=>handler(request,{organization:{id:'org',role:mocks.role,name:'Local'},user:{id:'actor',aal:mocks.aal}})}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({rpc:mocks.rpc,from:mocks.from,auth:{admin:{generateLink:mocks.generateLink}}})}))
vi.mock('@/lib/supabase/server',()=>({createClient:vi.fn()}))
vi.mock('@/lib/email/resend',()=>({sendEmail:mocks.sendEmail,renderBrandedEmail:()=>'<mail/>'}))
vi.mock('@/lib/saas/subscription-service',()=>({canCreateResource:mocks.quota}))
vi.mock('@/lib/logger',()=>({logger:{error:vi.fn()}}))
import { POST as invite } from '@/app/api/agenda/professionals/invite/route'
import { POST as addProfessional } from '@/app/api/agenda/professionals/route'
import { POST as pay, PATCH as cancel, GET as history } from '@/app/api/agenda/settlements/route'
const prof='10000000-0000-4000-8000-000000000001'
const request=(body:unknown,method='POST')=>new NextRequest('http://localhost/api/agenda',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{vi.clearAllMocks();mocks.role='admin';mocks.aal='aal2';mocks.quota.mockResolvedValue({allowed:true});mocks.sendEmail.mockResolvedValue({ok:true})})
it.each(['seller','cashier','technician','manager','customer'])('%s cannot add employees, invite, pay, cancel or read settlements',async role=>{mocks.role=role;for(const handler of [invite,addProfessional,pay,cancel,history])expect((await handler(request({}))).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.generateLink).not.toHaveBeenCalled()})
it.each(['admin','owner'])('%s can resend existing team access without recovery links',async role=>{mocks.role=role;mocks.rpc.mockResolvedValueOnce({data:{user_id:'existing',is_member:true,name:'Ana'}}).mockResolvedValueOnce({error:null});const response=await invite(request({professionalId:prof,email:'ana@example.com'}));expect(response.status).toBe(200);const body=await response.json();expect(body.inviteLink).toContain('/login');expect(mocks.generateLink).not.toHaveBeenCalled();expect(mocks.rpc).toHaveBeenLastCalledWith('link_agenda_employee_checked',expect.objectContaining({p_user:'existing',p_new:false,p_actor:'actor'}))})
it('does not link a global existing account outside the team',async()=>{mocks.rpc.mockResolvedValueOnce({data:{user_id:'external',is_member:false,name:'Ana'}});expect((await invite(request({professionalId:prof,email:'ana@example.com'}))).status).toBe(409);expect(mocks.generateLink).not.toHaveBeenCalled();expect(mocks.rpc).toHaveBeenCalledTimes(1)})
it('new activation credentials only go to email and are never returned',async()=>{mocks.rpc.mockResolvedValueOnce({data:{user_id:null,name:'Ana'}}).mockResolvedValueOnce({error:null});mocks.generateLink.mockResolvedValue({data:{user:{id:'new'},properties:{action_link:'https://auth.example.com/secret-activation-token'}}});const response=await invite(request({professionalId:prof,email:'ana@example.com'}));expect(response.status).toBe(200);expect(JSON.stringify(await response.json())).not.toContain('secret-activation-token');expect(mocks.generateLink).toHaveBeenCalledWith(expect.objectContaining({type:'invite'}));expect(mocks.sendEmail).toHaveBeenCalled()})
it('reports failure when linking fails and never reports success',async()=>{mocks.rpc.mockResolvedValueOnce({data:{user_id:'existing',is_member:true,name:'Ana'}}).mockResolvedValueOnce({error:{message:'failed'}});expect((await invite(request({professionalId:prof,email:'ana@example.com'}))).status).toBe(409);expect(mocks.sendEmail).not.toHaveBeenCalled()})
it('awaits email delivery and reports the real delivery result',async()=>{mocks.rpc.mockResolvedValueOnce({data:{user_id:'existing',is_member:true,name:'Ana'}}).mockResolvedValueOnce({error:null});mocks.sendEmail.mockResolvedValue({ok:false});const body=await (await invite(request({professionalId:prof,email:'ana@example.com'}))).json();expect(body.emailSent).toBe(false)})
it('uses one checked payment transaction and strips client financial authority',async()=>{mocks.rpc.mockResolvedValue({data:{id:'saved',cash_movement_id:'movement'}});const response=await pay(request({professionalId:prof,receiptCode:'LIQ-test',periodFrom:'2026-11-13',periodTo:'2026-11-13',netAmount:50000,paymentMethod:'cash',commissionRate:100,totalBilled:99999}));expect(response.status).toBe(200);expect(mocks.rpc).toHaveBeenCalledTimes(1);const input=mocks.rpc.mock.calls[0][1].p_input;expect(input).not.toHaveProperty('commissionRate');expect(input).not.toHaveProperty('totalBilled');expect(mocks.from).not.toHaveBeenCalled()})
it('missing checked payment function fails closed without legacy cash or inserts',async()=>{mocks.rpc.mockResolvedValue({error:{code:'PGRST202'}});const response=await pay(request({professionalId:prof,receiptCode:'LIQ-test',periodFrom:'2026-11-13',periodTo:'2026-11-13',netAmount:50000,paymentMethod:'cash'}));expect(response.status).toBe(503);expect(mocks.from).not.toHaveBeenCalled()})
it('cancellation delegates the original cash reversal to the same transaction',async()=>{mocks.rpc.mockResolvedValue({data:{status:'cancelled'}});expect((await cancel(request({settlementId:prof,action:'cancel',reason:'Pago por error'},'PATCH'))).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledWith('cancel_agenda_settlement_checked',{p_org:'org',p_actor:'actor',p_id:prof,p_reason:'Pago por error'})})
it.each(['POST','PATCH'])('rejects cross-origin %s before a privileged financial write',async method=>{
 mocks.rpc.mockResolvedValue({data:{id:'saved'}})
 const req=new NextRequest('http://localhost/api/agenda/settlements',{method,headers:{origin:'https://outside.example','content-type':'application/json'},body:JSON.stringify(method==='POST'?{professionalId:prof,receiptCode:'LIQ-test',periodFrom:'2026-11-13',periodTo:'2026-11-13',netAmount:50000,paymentMethod:'cash'}:{settlementId:prof,action:'cancel',reason:'Pago registrado por error'})})
 expect((await (method==='POST'?pay:cancel)(req)).status).toBe(403)
 expect(mocks.rpc).not.toHaveBeenCalled()
})
it('requires a cancellation reason for the administrative audit trail',async()=>{
 mocks.rpc.mockResolvedValue({data:{status:'cancelled'}})
 expect((await cancel(request({settlementId:prof,action:'cancel'},'PATCH'))).status).toBe(400)
 expect(mocks.rpc).not.toHaveBeenCalled()
})
it('does not pay if the MFA policy lookup fails',async()=>{
 mocks.aal='aal1'
 const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:null,error:{message:'offline'}})};mocks.from.mockReturnValue(q)
 const response=await pay(request({professionalId:prof,receiptCode:'LIQ-test',periodFrom:'2026-11-13',periodTo:'2026-11-13',netAmount:50000,paymentMethod:'cash'}))
 expect(response.status).toBe(503);expect((await response.json()).code).toBe('MFA_POLICY_UNAVAILABLE');expect(mocks.rpc).not.toHaveBeenCalled()
})
it.each(['business','platform'])('requires MFA when the %s policy enables it',async policy=>{
 mocks.aal='aal1'
 const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:policy==='business'?{require_admin_mfa:true}:{require_two_factor:true},error:null})};mocks.from.mockReturnValue(q)
 expect((await pay(request({professionalId:prof,receiptCode:'LIQ-test',periodFrom:'2026-11-13',periodTo:'2026-11-13',netAmount:50000,paymentMethod:'cash'}))).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled()
})
it('rejects text/plain mutation requests',async()=>{
 const req=new NextRequest('http://localhost/api/agenda/settlements',{method:'POST',headers:{'content-type':'text/plain'},body:'{}'})
 expect((await pay(req)).status).toBe(415);expect(mocks.rpc).not.toHaveBeenCalled()
})
it('allows an admin without MFA only after both policies are successfully checked',async()=>{
 mocks.aal='aal1'
 const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{require_admin_mfa:false,require_two_factor:false},error:null})};mocks.from.mockReturnValue(q);mocks.rpc.mockResolvedValue({data:{id:'saved'}})
 expect((await pay(request({professionalId:prof,receiptCode:'LIQ-test',periodFrom:'2026-11-13',periodTo:'2026-11-13',netAmount:50000,paymentMethod:'cash'}))).status).toBe(200)
 expect(mocks.rpc).toHaveBeenCalledWith('save_agenda_settlement_checked',expect.objectContaining({p_actor:'actor',p_org:'org'}))
})

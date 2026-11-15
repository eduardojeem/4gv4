import {beforeEach,describe,it,expect,vi} from 'vitest'
import {NextRequest} from 'next/server'
const state=vi.hoisted(()=>({report:vi.fn(),append:vi.fn(),branch:vi.fn(),resolve:vi.fn()}))
vi.mock('@/lib/api/withAdminAuth',()=>({withAdminAuth:(handler:unknown)=>handler}))
vi.mock('@/lib/finance/control-server',()=>({getFinanceControlReport:state.report,appendFinanceControl:state.append}))
vi.mock('@/lib/finance/server',async original=>({...await original<typeof import('@/lib/finance/server')>(),resolveFinanceOrganizationId:state.resolve,assertFinanceBranchAccess:state.branch}))
import {GET,POST} from '@/app/api/admin/finances/control/route'
const org='11111111-1111-4111-8111-111111111111',branch='22222222-2222-4222-8222-222222222222',category='33333333-3333-4333-8333-333333333333'
const context={user:{id:'admin',role:'admin'},organizationId:org}
const base=()=>({sourceVersion:'source-v1',organizationId:org,filters:{startDate:'2026-10-01',endDate:'2026-10-31',branchId:branch},today:'2026-11-11',currency:'PYG',configVersion:2,persistenceAvailable:true,categories:[{id:category,name:'Alquiler'}],snapshot:{complete:true,accrued:{revenue:100,directCosts:0,grossProfit:100,operatingExpenses:0,payrollCost:0,netProfit:100},cash:{collected:0,paid:0,netCashFlow:0}},lines:Array.from({length:30},(_,i)=>({metric:'revenue',id:String(i),amount:1}))})
function request(body?:unknown,extra=''){return new NextRequest('http://localhost/api/admin/finances/control?organizationId='+org+'&branchId='+branch+'&startDate=2026-10-01&endDate=2026-10-31'+extra,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-idempotency-key':'control-test-123'},...(body?{body:JSON.stringify(body)}:{})})}
const handleGet=GET as unknown as (request:NextRequest,context:typeof context)=>ReturnType<typeof GET>
const handlePost=POST as unknown as (request:NextRequest,context:typeof context)=>ReturnType<typeof POST>
const post=(body:unknown)=>handlePost(request(body),context)
beforeEach(()=>{vi.clearAllMocks();state.resolve.mockResolvedValue(org);state.branch.mockResolvedValue({id:branch});state.report.mockResolvedValue(base());state.append.mockResolvedValue({id:'saved'})})
describe('finance control API tenant, mutation and history boundary',()=>{
 it('paginates details and keeps the full sum',async()=>{const response=await handleGet(request(undefined,'&page=2'),context);const data=await response.json();expect(response.status).toBe(200);expect(data.lines).toHaveLength(5);expect(data.detail.sum).toBe(30);expect(response.headers.get('Cache-Control')).toContain('no-store');expect(state.branch).toHaveBeenCalledWith(expect.objectContaining({organizationId:org,branchId:branch}))})
 it('stops before reading data if branch access is denied',async()=>{state.branch.mockRejectedValue(new Error('denied'));await handleGet(request(),context);expect(state.report).not.toHaveBeenCalled()})
 it('rejects conflicting organization identifiers',async()=>{const req=request();req.headers.set('x-organization-id','44444444-4444-4444-8444-444444444444');expect((await handleGet(req,context)).status).toBe(422);expect(state.report).not.toHaveBeenCalled()})
 it('captures the server snapshot and actor, never client money values',async()=>{expect((await post({kind:'closure',currency:'PYG',reason:'Cierre revisado'})).status).toBe(200);expect(state.append).toHaveBeenCalledWith(expect.objectContaining({organizationId:org,branchId:branch,actorId:'admin',periodStart:'2026-10-01',payload:{reason:'Cierre revisado',snapshot:base().snapshot,sourceVersion:'source-v1'}}))})
 it('rejects a client-provided snapshot',async()=>{expect((await post({kind:'closure',currency:'PYG',reason:'Cierre revisado',snapshot:{netProfit:999}})).status).toBe(422);expect(state.append).not.toHaveBeenCalled()})
 it('rejects incomplete data and a month that has not ended',async()=>{state.report.mockResolvedValue({...base(),snapshot:{...base().snapshot,complete:false}});expect((await post({kind:'closure',currency:'PYG',reason:'Cierre revisado'})).status).toBe(422);state.report.mockResolvedValue({...base(),today:'2026-10-15'});expect((await post({kind:'closure',currency:'PYG',reason:'Cierre revisado'})).status).toBe(422);expect(state.append).not.toHaveBeenCalled()})
 it('does not pretend persistence is enabled without the migration',async()=>{state.report.mockResolvedValue({...base(),persistenceAvailable:false});expect((await post({kind:'closure',currency:'PYG',reason:'Cierre revisado'})).status).toBe(503);expect(state.append).not.toHaveBeenCalled()})
 it('rejects a changed currency and foreign category',async()=>{expect((await post({kind:'closure',currency:'USD',reason:'Cierre revisado'})).status).toBe(409);expect((await post({kind:'config',currency:'PYG',expectedVersion:2,config:{budgets:[{categoryId:branch,limit:100}],alerts:{due:true,budget:true,reconciliation:true,days:7}}})).status).toBe(422);expect(state.append).not.toHaveBeenCalled()})
})

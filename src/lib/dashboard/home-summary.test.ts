import { describe, expect, it, vi } from 'vitest'
const cache = vi.hoisted(() => ({ calls: [] as Array<{key:string;force?:boolean}> }))
vi.mock('./summary-cache', () => ({ getCachedDashboardSummary: async (key:string, load:()=>Promise<unknown>, options:{force?:boolean}) => { cache.calls.push({key,force:options.force}); return load() } }))
import { fetchDashboardHomeSummary, type HomeSummaryRpcClient } from './home-summary'
const fixture = {version:1,timeZone:'America/Asuncion',today:'2026-10-16',generatedAt:'2026-10-16T12:00:00Z',sales:{todayAmount:12500,todayCount:1250,daily:[0,0,0,0,0,0,12500]},customers:{newCount:0,daily:[0,0,0,0,0,0,0]},catalog:{physicalCount:1,servicesCount:2,lowStockCount:1},orders:{activeCount:0},repairs:{activeCount:0,todayCount:0,todayAmount:0,deliveredCount:0,deliveredAmount:0,readyCount:0,readyAmount:0}}
const scope={userId:'user',organizationId:'org',branchId:'branch',role:'admin',modules:['inventory','repairs']}
function client(data:unknown,error:unknown=null) {
 const rpc=vi.fn(()=>{const result=Promise.resolve({data,error});return Object.assign(result,{abortSignal:()=>result})})
 return {rpc} as unknown as HomeSummaryRpcClient
}
describe('compact home summary',()=>{
 it('calls one typed RPC and passes the active scope and module selection',async()=>{
  const db=client(fixture);const result=await fetchDashboardHomeSummary(db,scope,{force:true})
  expect(result.sales.todayAmount).toBe(12500)
  expect(db.rpc).toHaveBeenCalledWith('dashboard_home_summary',{p_organization_id:'org',p_branch_id:'branch',p_modules:['inventory','repairs']})
  expect(cache.calls.at(-1)?.force).toBe(true)
 })
 it('maps the all-branches UI selection to the authorized aggregate RPC scope',async()=>{
  const db=client(fixture)
  await fetchDashboardHomeSummary(db,{...scope,branchId:'all'})
  expect(db.rpc).toHaveBeenCalledWith('dashboard_home_summary',{p_organization_id:'org',p_branch_id:null,p_modules:['inventory','repairs']})
 })
 it('separates browser cache keys by user, role, modules and branch',async()=>{
  const db=client(fixture)
  for(const patch of [{},{userId:'other'},{role:'cashier'},{modules:['repairs']},{branchId:'other'}])await fetchDashboardHomeSummary(db,{...scope,...patch})
  expect(new Set(cache.calls.slice(-5).map(c=>c.key)).size).toBe(5)
 })
 it('rejects incomplete payloads and missing migrations without a raw-table fallback',async()=>{
  await expect(fetchDashboardHomeSummary(client({...fixture,sales:{...fixture.sales,daily:[1]}}),scope)).rejects.toThrow()
  await expect(fetchDashboardHomeSummary(client(null,{code:'PGRST202'}),scope)).rejects.toThrow(/dashboard_home_summary/)
 })
})

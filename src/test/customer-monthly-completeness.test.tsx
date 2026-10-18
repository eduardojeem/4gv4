import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDashboardSummaryCache } from '@/lib/dashboard/summary-cache'
const control = vi.hoisted(() => ({ rows: [] as unknown[], fail: false, calls: [] as Array<{name:string;args:Record<string,unknown>;signal?:AbortSignal}>, tenant: { scope: 'user:org', organizationId: 'org', currentScope: { current: 'user:org' } } }))
vi.mock('@/contexts/auth-context',()=>({useAuth:()=>({user:{id:'user',role:'admin',permissions:['crm.customers.read']}})}))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useOptionalActiveOrganization: () => ({ organization: { id: control.tenant.organizationId } }) }))
vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: () => control.tenant }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc: (name:string,args:Record<string,unknown>) => ({
 abortSignal: (signal:AbortSignal) => { control.calls.push({name,args,signal}); return Promise.resolve(control.fail ? {data:null,error:{message:'RPC unavailable'}} : {data:control.rows,error:null}) },
}) }) }))
import { useCustomerMetrics } from '@/hooks/use-customer-metrics'
beforeEach(() => {
 const now=new Date(); control.rows=[{year:now.getFullYear(),month_index:now.getMonth(),revenue:12500,sale_count:1250}]
 control.fail=false;control.calls=[];control.tenant.scope='user:org';control.tenant.organizationId='org';control.tenant.currentScope.current='user:org';clearDashboardSummaryCache()
})
describe('complete customer monthly sales via database aggregate', () => {
 it('uses aggregate revenue/count beyond 1000 sales in one RPC, with explicit organization/range/browser zone', async () => {
  const {result}=renderHook(()=>useCustomerMetrics([]))
  await waitFor(()=>expect(result.current.monthlyLoading).toBe(false))
  expect(result.current.monthlyData.reduce((sum,m)=>sum+m.totalRevenue,0)).toBe(12500)
  expect(result.current.monthlyData.at(-1)?.avgOrderValue).toBe(10)
  expect(control.calls).toHaveLength(1)
  expect(control.calls[0]).toMatchObject({name:'dashboard_customer_monthly_summary',args:{p_organization_id:'org',p_time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone}})
  expect(new Date(String(control.calls[0].args.p_start)).getDate()).toBe(1)
 })
 it('keeps valid empty aggregates as zero months',async()=>{
  control.rows=[];const {result}=renderHook(()=>useCustomerMetrics([]))
  await waitFor(()=>expect(result.current.monthlyLoading).toBe(false))
  expect(result.current.monthlyError).toBeNull();expect(result.current.monthlyData).toHaveLength(6)
  expect(result.current.monthlyData.every(month=>month.totalRevenue===0)).toBe(true)
 })
 it('does not turn an RPC/schema error into a zero or partial series',async()=>{
  control.fail=true;const {result}=renderHook(()=>useCustomerMetrics([]))
  await waitFor(()=>expect(result.current.monthlyLoading).toBe(false))
  expect(result.current.monthlyError).toBeTruthy();expect(result.current.monthlyData).toEqual([])
 })
 it.each(['missing','badnumber','duplicate','invalid-month','invalid-count'])('rejects malformed %s RPC rows with an unavailable series',async(kind)=>{
  const now=new Date();const valid={year:now.getFullYear(),month_index:now.getMonth(),revenue:100,sale_count:2}
  control.rows=kind==='missing' ? [{year:valid.year,month_index:valid.month_index,sale_count:2}]
   :kind==='badnumber' ? [{...valid,revenue:'not-a-number'}]
   :kind==='duplicate' ? [valid,{...valid}]
   :kind==='invalid-month' ? [{...valid,month_index:12}]
   :[{...valid,sale_count:1.5}]
  const {result,unmount}=renderHook(()=>useCustomerMetrics([]))
  await waitFor(()=>expect(result.current.monthlyLoading).toBe(false))
  expect(result.current.monthlyError).toBeTruthy();expect(result.current.monthlyData).toEqual([])
  unmount();control.rows=[valid]
  const retried=renderHook(()=>useCustomerMetrics([]))
  await waitFor(()=>expect(retried.result.current.monthlyLoading).toBe(false))
  expect(retried.result.current.monthlyError).toBeNull()
  expect(retried.result.current.monthlyData.at(-1)?.totalRevenue).toBe(100)
  expect(control.calls).toHaveLength(2)
 })
 it('aborts on unmount and hides the old organization series on scope changes',async()=>{
  const {result,rerender,unmount}=renderHook(()=>useCustomerMetrics([]))
  await waitFor(()=>expect(result.current.monthlyLoading).toBe(false))
  control.tenant.scope='user:other';control.tenant.organizationId='other';control.tenant.currentScope.current='user:other'
  control.fail=true;rerender()
  expect(result.current.monthlyData).toEqual([])
  await waitFor(()=>expect(control.calls).toHaveLength(2))
  await act(async()=>unmount())
  expect(control.calls.every(call=>call.signal?.aborted)).toBe(true)
 })
})

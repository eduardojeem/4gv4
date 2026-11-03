import { beforeEach, expect, it, vi } from 'vitest'
const fixture=vi.hoisted(()=>({role:'owner',queries:[] as {table:string,org?:string}[]}))
vi.mock('@/lib/auth/request-auth',()=>({resolveRequestAuthUser:async()=>({authenticated:true,user:{id:'user',role:'user',email:'owner@example.test'}})}))
vi.mock('@/lib/saas/context',()=>({getCurrentOrganizationContext:async()=>({id:'org-current',role:fixture.role,name:'Shop',slug:'shop'})}))
vi.mock('@/lib/saas/subscription-service',()=>({getOrganizationPlanInfo:async()=>({name:'Pro',effectiveModules:[],businessVertical:'technology'})}))
vi.mock('@/lib/products/cost-access',()=>({resolveOrganizationProductCostAccess:async()=>({canReadCost:false,canWriteCost:false})}))
vi.mock('@/config/dashboard-navigation',()=>({filterDashboardNavGroups:()=>[],getBusinessFocusSection:()=>null,getMobileDashboardItems:()=>[]}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:(table:string)=>{
 const query={table,org:undefined as string|undefined};fixture.queries.push(query)
 const chain={select:()=>chain,eq:(key:string,value:string)=>{if(key==='organization_id')query.org=value;return chain},maybeSingle:async()=>({error:null,data:table==='subscriptions'?{plan:'PRO',status:'active',current_period_ends_at:new Date(Date.now()+86400000).toISOString()}:null})};return chain
}})}))
import { GET } from '../app/api/mobile/dashboard/route'
beforeEach(()=>{fixture.queries=[]})
it('returns a notice sourced only from the active organization for the owner',async()=>{fixture.role='owner';const response=await GET();const body=await response.json();expect(response.status).toBe(200);expect(body.subscriptionNotice.title).toContain('Tu plan');expect(fixture.queries.find(query=>query.table==='subscriptions')?.org).toBe('org-current')})
it('does not query or return subscription dates for a cashier',async()=>{fixture.role='cashier';const response=await GET();const body=await response.json();expect(body.subscriptionNotice).toBeNull();expect(fixture.queries.some(query=>query.table==='subscriptions')).toBe(false)})

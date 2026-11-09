// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({write:vi.fn(),rpc:vi.fn(),entitled:['pos','inventory'] as string[]}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})}})}))
vi.mock('@/lib/saas/context',()=>({getCurrentOrganizationContext:async()=>({id:'org1',role:'owner',plan:'PRO'})}))
vi.mock('@/lib/saas/subscription-service',()=>({getOrganizationPlanInfo:async()=>({entitledModules:mocks.entitled,moduleTrials:[]})}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({rpc:mocks.rpc,from:(table:string)=>{const query={select:()=>query,eq:()=>query,limit:()=>query,update:mocks.write,upsert:mocks.write,maybeSingle:async()=>({data:table==='profiles'?{role:'owner',status:'active'}:table==='organization_settings'?{currency:'PYG',modules:{onboarding:{status:'completed'}}}:{storefront_public:false,marketplace_public:false},error:null})};return query}})}))
import { POST } from '@/app/api/onboarding/complete/route'
beforeEach(()=>{vi.clearAllMocks();mocks.entitled=['pos','inventory']})
const send=(enabledModules:string[])=>POST(new Request('http://local/api/onboarding/complete',{method:'POST',body:JSON.stringify({displayName:'Demo',currency:'PYG',timezone:'America/Asuncion',language:'es',phone:'+595 981123456',address:'Calle 123',city:'Luque',businessVertical:'general',operatingModel:'retail',brandColor:'blue',storefrontPublic:false,enabledModules})}))
it('rechaza herramientas fuera del plan antes de escribir',async()=>{
 const response=await send(['credits']);expect(response.status).toBe(403);expect(mocks.write).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled()
})
it('rechaza herramientas sin dependencias antes de escribir',async()=>{
 mocks.entitled=['inventory_admin','inventory'];const response=await send(['inventory_admin']);expect(response.status).toBe(400);expect(mocks.write).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled()
})

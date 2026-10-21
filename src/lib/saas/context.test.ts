import { beforeEach, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({org:'A',rows:[{role:'admin',organizations:{id:'A',name:'A',slug:'a',plan:'free',logo_url:null}},{role:'seller',organizations:{id:'B',name:'B',slug:'b',plan:'free',logo_url:null}}]}))
vi.mock('next/headers',()=>({headers:async()=>new Headers({'x-organization-id':state.org})}))
const client=()=>({from:()=>({select:()=>({eq:()=>({eq:()=>({neq:async()=>({data:state.rows,error:null})})})})})})
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>client()}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>client()}))
import { getCurrentOrganizationContext } from './context'
beforeEach(()=>{state.org='A'})
it('selects memberships and organization roles through A to B to A',async()=>{for(const id of ['A','B','A']){state.org=id;const context=await getCurrentOrganizationContext('user');expect(context?.id).toBe(id);expect(context?.role).toBe(id==='A'?'admin':'seller')}})
it('does not replace an unauthorized explicit organization with admin membership elsewhere',async()=>{state.org='C';expect(await getCurrentOrganizationContext('user')).toBeNull()})

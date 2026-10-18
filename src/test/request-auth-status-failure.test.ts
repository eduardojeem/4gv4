import { beforeEach, describe, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({profileError:null as unknown,roleError:null as unknown,profile:null as {role:string;status?:string}|null,role:null as {role:string;is_active?:boolean}|null}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'u'}},error:null})}})}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:(table:string)=>{let columns='';const q={select:(value:string)=>{columns=value;return q},eq:()=>q,maybeSingle:async()=>columns==='role'?{data:{role:'admin'},error:null}:({data:table==='profiles'?state.profile:state.role,error:table==='profiles'?state.profileError:state.roleError})};return q}})}))
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
beforeEach(()=>{state.profileError=null;state.roleError=null;state.profile=null;state.role=null})
describe('authentication distinguishes unavailable status from an absent profile',()=>{
 it.each(['profileError','roleError'] as const)('rejects a status lookup failure %s',async key=>{state[key]={message:'database offline'};await expect(resolveRequestAuthUser()).rejects.toThrow()})
 it('preserves a genuinely absent role/profile without inventing staff access',async()=>{const result=await resolveRequestAuthUser();expect(result).toMatchObject({authenticated:true,user:{role:'cliente'}})})
 it('denies explicitly suspended profiles',async()=>{state.profile={role:'admin',status:'suspended'};expect(await resolveRequestAuthUser()).toEqual({authenticated:false,reason:'inactive'})})
 it.each([
  ['profileError',{code:'42703',message:'column profiles.status does not exist'}],
  ['roleError',{code:'42703',message:'column user_roles.is_active does not exist'}],
  ['profileError',{code:'XX000',message:'failed to read status'}],
  ['roleError',{code:'XX000',message:'failed to read is_active'}],
 ] as const)('rejects unavailable status even when error %s mentions its column',async(key,error)=>{
  state[key]=error
  await expect(resolveRequestAuthUser()).rejects.toThrow('No se pudo verificar')
 })

})

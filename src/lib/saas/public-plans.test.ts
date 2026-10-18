import { beforeEach, describe, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({failed:false,cache:vi.fn((load:()=>Promise<unknown>)=>load)}))
vi.mock('next/cache',()=>({unstable_cache:state.cache}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:(table:string)=>{
 const query:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(state.failed?{data:null,error:{message:'offline'}}:{data:table==='subscription_plans'?[{id:'p',tier:'basic',is_active:true,price:120000,trial_days:0}]:[{code:'BASIC',is_active:true,limits:{products:70},modules:['inventory']}],error:null}).then(resolve)}
 for(const method of ['select','eq','order'])query[method]=()=>query
 return query
}})}))
import { getPublicSubscriptionPlans, getPublicSubscriptionPlansStrict } from './public-plans'
beforeEach(()=>{state.failed=false})
describe('shared cached public catalog result modes',()=>{
 it('uses one configured 300-second tagged cache for all callers',async()=>{
  expect(state.cache).toHaveBeenCalledTimes(1)
  expect(state.cache.mock.calls[0]).toEqual([expect.any(Function),['public-subscription-plans-operational-v2'],{revalidate:300,tags:['subscription-plans:public']}])
  expect(await getPublicSubscriptionPlansStrict()).toEqual(await getPublicSubscriptionPlans())
 })
 it('preserves read failure for HTTP status mapping, while existing web callers retain empty-state behavior',async()=>{
  state.failed=true
  await expect(getPublicSubscriptionPlansStrict()).rejects.toThrow('catálogo operativo')
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
  expect(await getPublicSubscriptionPlans()).toEqual([])
  warn.mockRestore()
 })
})

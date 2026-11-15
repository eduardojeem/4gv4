import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({technical:null as Record<string,unknown>|null,commercial:null as Record<string,unknown>|null,filters:[] as unknown[][]}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:(table:string)=>{const q={select:()=>q,eq:(...args:unknown[])=>{state.filters.push([table,...args]);return q;},maybeSingle:async()=>({data:table==='plans'?state.technical:state.commercial,error:null})};return q;}})}));
import {getPlanLimits,planRequiresPayment} from '@/lib/saas/subscription-service';
beforeEach(()=>{state.filters=[];state.technical={code:'BASIC',name:'Pro',is_active:true,limits:{users:5,products:500,branches:2,cashRegisters:3,repairs:300},modules:['pos']};state.commercial={tier:'basic',name:'Pro',is_active:true,price:120000,limits:{users:'5',products:'500'}};});
describe('single verified plan catalog',()=>{
 it('rejects a missing technical row instead of borrowing Free limits',async()=>{state.technical=null;await expect(getPlanLimits('BASIC')).rejects.toThrow(/verificar|configur/i);});
 it('rejects a missing commercial price instead of assuming zero',async()=>{state.commercial=null;await expect(getPlanLimits('BASIC')).rejects.toThrow(/verificar|configur/i);});
 it('keeps the configured limits without filling missing ones with stale defaults',async()=>{const p=await getPlanLimits('BASIC');expect(p.limits.users).toBe(5);expect(p.limits.products).toBe(500);expect(p.limits.services).toBeUndefined();expect(p.price_monthly).toBe(120000);});
 it('normalizes aliases before querying the canonical code',async()=>{await getPlanLimits('starter');expect(state.filters).toContainEqual(['plans','code','BASIC']);});
 it('loads a retired but existing plan for its current customers',async()=>{state.technical!.is_active=false;state.commercial!.is_active=false;const p=await getPlanLimits('BASIC');expect(p.name).toBe('Pro');expect(p.price_monthly).toBe(120000);expect(p.is_active).toBe(false);});
 it('does not treat an unverified price as a free activation',()=>{expect(()=>planRequiresPayment({price_monthly:NaN})).toThrow();});
});

it('refuses incomplete operational limits rather than treating missing product quota as unlimited',async()=>{delete (state.technical!.limits as Record<string,unknown>).products;await expect(getPlanLimits('BASIC')).rejects.toThrow(/verificar|configur/i);});

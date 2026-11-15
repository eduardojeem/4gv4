import {act,renderHook} from '@testing-library/react'
import {beforeEach,it,expect,vi} from 'vitest'
const state=vi.hoisted(()=>({organizationId:'A' as string|null,scope:'u:A',currentScope:{current:'u:A'},modules:['inventory','services','crm','repairs'],calls:[] as Array<[string,string,unknown]>,orFilters:[] as string[],late:null as null|Promise<{data:unknown[]}>}))
vi.mock('@/hooks/use-tenant-scope',()=>({useTenantScope:()=>state}))
vi.mock('@/hooks/use-permissions',()=>({usePermissions:()=>({hasPermission:()=>true})}))
vi.mock('@/contexts/SubscriptionStatusContext',()=>({useSubscriptionStatus:()=>({effectiveModules:state.modules})}))
vi.mock('@/lib/supabase/client',()=>({createSupabaseClient:()=>({from:(table:string)=>{
 const q={select:()=>q,eq:(key:string,value:unknown)=>{state.calls.push([table,key,value]);return q},neq:()=>q,or:(value:string)=>{state.orFilters.push(value);return q},ilike:()=>q,order:()=>q,limit:async()=>state.late??{data:[]}};return q
}})}))
import {useDashboardSearch} from '@/hooks/use-dashboard-search'
beforeEach(()=>{state.organizationId='A';state.scope='u:A';state.currentScope.current='u:A';state.modules=['inventory','services','crm','repairs'];state.calls=[];state.orFilters=[];state.late=null})
it('scopes every searched dataset to the active company',async()=>{const {result}=renderHook(useDashboardSearch);await act(async()=>{await result.current.search({query:'Juan',filters:{type:'todos'}})});for(const table of ['products','customers','repairs','appointments'])expect(state.calls).toContainEqual([table,'organization_id','A'])})
it('never issues an unscoped search while the company is unresolved',async()=>{state.organizationId=null;const {result}=renderHook(useDashboardSearch);expect(await result.current.search({query:'Juan',filters:{}})).toEqual([]);expect(state.calls).toEqual([])})
it('discards results from an organization that was switched during the request',async()=>{let resolve!:(value:{data:unknown[]})=>void;state.modules=['crm'];state.late=new Promise(r=>{resolve=r});const {result}=renderHook(useDashboardSearch);const promise=result.current.search({query:'Juan',filters:{type:'clientes'}});state.currentScope.current='u:B';resolve({data:[{id:'1',name:'Cliente A'}]});expect(await promise).toEqual([])})
it('offers services and appointments without requiring inventory',()=>{state.modules=['services'];const {result}=renderHook(useDashboardSearch);expect(result.current.availableTypes).toContain('servicios');expect(result.current.availableTypes).toContain('turnos');expect(result.current.availableTypes).not.toContain('productos');expect(result.current.availableTypes).not.toContain('clientes')})
it('keeps email punctuation searchable while still scoping the query',async()=>{state.modules=['crm'];const {result}=renderHook(useDashboardSearch);await result.current.search({query:'cliente@example.com',filters:{type:'clientes'}});expect(state.orFilters[0]).toContain('email.ilike.%cliente@example.com%');expect(state.calls).toContainEqual(['customers','organization_id','A'])});

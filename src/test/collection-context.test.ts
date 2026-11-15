import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({from:vi.fn(),branch:vi.fn(),options:null as unknown}));
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth:(options:unknown,handler:unknown)=>{state.options=options;return handler;}}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:state.from})}));
vi.mock('@/lib/branches/server',()=>({getRequestedBranchId:()=>null,resolveBranchScopeForUser:state.branch}));
import {GET} from '@/app/api/customers/[id]/collection-context/route';
const customer='00000000-0000-4000-8000-000000000001';
const invoke=()=> (GET as unknown as (req:Request,auth:unknown,ctx:unknown)=>Promise<Response>)(new Request('http://localhost'),{organization:{id:'org'},user:{id:'actor',role:'seller'}},{params:Promise.resolve({id:customer})});
let filters:unknown[][];
beforeEach(()=>{filters=[];state.from.mockReset();state.branch.mockResolvedValue({branchId:'branch'});});
function query(result:unknown){const q={select:vi.fn(),eq:vi.fn(),is:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn()};q.select.mockReturnValue(q);q.eq.mockImplementation((...args:unknown[])=>{filters.push(args);return q;});q.is.mockImplementation((...args:unknown[])=>{filters.push(args);return q;});q.limit.mockResolvedValue(result);q.maybeSingle.mockResolvedValue(result);return q;}
describe('collection cash preflight',()=>{
 it('uses collection permissions instead of requiring POS sales',()=>{expect(state.options).toEqual({permission:'crm.customers.manage',module:'crm'});});
 it.each([true,false])('reports actual open cash %s with tenant and branch filters',async(open)=>{state.from.mockReturnValueOnce(query({data:{id:customer},error:null})).mockReturnValueOnce(query({data:open?[{id:'cash'}]:[],error:null}));const response=await invoke();expect(await response.json()).toEqual({branchId:'branch',cashOpen:open});expect(filters).toContainEqual(['organization_id','org']);expect(filters).toContainEqual(['branch_id','branch']);expect(filters).toContainEqual(['date',null]);expect(response.headers.get('cache-control')).toBe('no-store');});
 it('does not expose cash state for a foreign customer',async()=>{state.from.mockReturnValue(query({data:null,error:null}));expect((await invoke()).status).toBe(404);expect(state.branch).not.toHaveBeenCalled();});
 it('returns an error instead of inventing closed cash when the database fails',async()=>{state.from.mockReturnValue(query({data:null,error:new Error('offline')}));expect((await invoke()).status).toBe(500);});
});

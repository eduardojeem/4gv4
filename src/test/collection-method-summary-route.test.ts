import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({from:vi.fn(),branch:vi.fn()}));
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth:(_:unknown,handler:unknown)=>handler}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:state.from})}));
vi.mock('@/lib/branches/server',()=>({getRequestedBranchId:()=> 'branch',resolveBranchScopeForUser:state.branch}));
import {GET} from '@/app/api/mobile/cash-register/credit-collections/route';
const invoke=()=> (GET as unknown as (req:Request,auth:unknown)=>Promise<Response>)(new Request('http://localhost'),{organization:{id:'org'},user:{id:'actor',role:'seller'}});
let filters:unknown[][];
function query(result:unknown){const q:Record<string,ReturnType<typeof vi.fn>>={};for(const method of ['select','eq','gte','lte','not','order'])q[method]=vi.fn((...args:unknown[])=>{filters.push([method,...args]);return q;});q.limit=vi.fn().mockResolvedValue(result);q.maybeSingle=vi.fn().mockResolvedValue(result);return q;}
beforeEach(()=>{filters=[];state.from.mockReset();state.branch.mockResolvedValue({branchId:'branch'});});
const receipt={request:{paymentMethod:'cash'},result:{allocations:[{type:'installment',appliedAmount:15.5}]}};
function setup(rows:unknown[]){state.from.mockReturnValueOnce(query({data:rows,error:null})).mockReturnValueOnce(query({data:{currency:'PYG'},error:null}));}
describe('scoped installment collection summary',()=>{
 it('scopes both queries and distinguishes collections from sales',async()=>{setup([receipt]);const response=await invoke();const body=await response.json();expect(body.totals).toEqual({cash:15.5,card:0,transfer:0,count:1});expect(body.branchId).toBe('branch');expect(filters).toContainEqual(['eq','branch_id','branch']);expect(filters.filter(row=>row[0]==='eq'&&row[1]==='organization_id')).toHaveLength(2);expect(new Date(body.end).getTime()-new Date(body.start).getTime()).toBe(86400000);expect(response.headers.get('cache-control')).toBe('no-store');});
 it('refuses partial totals beyond the supported window size',async()=>{setup(Array.from({length:1001},()=>receipt));const response=await invoke();expect(response.status).toBe(422);expect(await response.json()).not.toHaveProperty('totals');});
 it('does not turn malformed financial records into zero totals',async()=>{setup([{request:{paymentMethod:'cash'},result:{}}]);const response=await invoke();expect(response.status).toBe(500);expect(await response.json()).not.toHaveProperty('totals');});
 it('requires a branch before querying private data',async()=>{state.branch.mockResolvedValue({branchId:null});expect((await invoke()).status).toBe(409);expect(state.from).not.toHaveBeenCalled();});
});

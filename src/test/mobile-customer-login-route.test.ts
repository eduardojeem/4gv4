import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const fixture=vi.hoisted(()=>({
  profile:{status:'active',role:'cliente'} as {status:string;role:string}|null,
  role:{is_active:true,role:'cliente'} as {is_active:boolean;role:string}|null,
  staff:0, fail:false, fetch:vi.fn(),
}))
vi.mock('@/lib/rate-limiter',()=>({rateLimiter:{check:async()=>true},getClientIp:()=> '127.0.0.1'}))
vi.mock('@/lib/logger',()=>({logger:{error:vi.fn(),warn:vi.fn()}}))
vi.mock('@/lib/auth/mfa',()=>({hasVerifiedFactor:()=>true,MFA_ENROLLMENT_REQUIRED_CODE:'mfa_enrollment_required'}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:(table:string)=>{
  const query={select:()=>query,eq:()=>query,neq:()=>query,
    maybeSingle:async()=>({data:table==='profiles'?fixture.profile:fixture.role,error:fixture.fail?{message:'offline'}:null}),
    then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve({data:[],count:fixture.staff,error:fixture.fail?{message:'offline'}:null})),
  };return query;
}})}))
import { POST } from '@/app/api/mobile/auth/login/route'
const request=()=>new NextRequest('http://localhost/api/mobile/auth/login',{method:'POST',body:JSON.stringify({email:'ana@example.com',password:'BuenaClave123'})})
beforeEach(()=>{
  fixture.profile={status:'active',role:'cliente'};fixture.role={is_active:true,role:'cliente'};fixture.staff=0;fixture.fail=false;
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://127.0.0.1:55321');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-only-not-a-key');
  fixture.fetch.mockReset().mockImplementation(async(url:string)=>new Response(JSON.stringify(url.includes('/token?')?{access_token:'test-access',refresh_token:'test-refresh',user:{id:'customer-1'}}:{}),{status:200}));
  vi.stubGlobal('fetch',fixture.fetch);
})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
describe('mobile login customer session',()=>{
  it('returns a customer session without requiring or creating staff membership',async()=>{
    const response=await POST(request());expect(response.status).toBe(200);
    expect(await response.json()).toEqual({access_token:'test-access',refresh_token:'test-refresh'});
    expect(fixture.fetch).toHaveBeenCalledTimes(1);
  })
  it('revokes the issued session for an inactive customer',async()=>{
    fixture.role={is_active:false,role:'cliente'};
    expect((await POST(request())).status).toBe(403);
    expect(fixture.fetch.mock.calls[1][0]).toContain('/auth/v1/logout');
  })
  it('denies a former staff account with no membership',async()=>{
    fixture.profile={status:'active',role:'admin'};fixture.role={is_active:true,role:'admin'};
    expect((await POST(request())).status).toBe(403);
  })
  it('fails closed when trusted account checks fail',async()=>{
    fixture.fail=true;expect((await POST(request())).status).toBe(503);
    expect(fixture.fetch.mock.calls[1][0]).toContain('/auth/v1/logout');
  })
})
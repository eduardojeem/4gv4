import {it,expect,vi,afterEach} from 'vitest';
const {admin}=vi.hoisted(()=>({admin:vi.fn()}));vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:admin}));
import {runApprovedOrganizationErasures} from '@/lib/saas/organization-erasure';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('does not activate deletion with the retention flag alone',async()=>{vi.stubEnv('SUBSCRIPTION_RETENTION_ENABLED','true');vi.stubEnv('SUBSCRIPTION_ERASURE_ENABLED','false');expect(await runApprovedOrganizationErasures()).toMatchObject({enabled:false,erased:0});expect(admin).not.toHaveBeenCalled();});
function query(result:unknown){const q={select:()=>q,is:()=>q,not:()=>q,lte:()=>q,order:()=>q,eq:()=>q,limit:()=>Promise.resolve(result),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(result).then(resolve)};return q;}
function fixture(path:string,removeError:unknown=null){
 const removed=vi.fn().mockResolvedValue({error:removeError}),updated=vi.fn(()=>query({error:null}));
 admin.mockReturnValue({from:(table:string)=>table==='organization_nonrenewal_cycles'?query({data:[]}):{...query({data:[{organization_id:'org',bucket_id:'images',object_path:path,ready_at:'2026-01-01'}]}),update:updated},storage:{from:()=>({remove:removed})}});
 vi.stubEnv('SUBSCRIPTION_ERASURE_ENABLED','true');return {removed,updated};
}
it('removes only a committed tenant path and marks its successful cleanup',async()=>{const mocks=fixture('website/org/photo.jpg');expect(await runApprovedOrganizationErasures()).toMatchObject({filesRemoved:1,failed:0});expect(mocks.removed).toHaveBeenCalledWith(['website/org/photo.jpg']);expect(mocks.updated).toHaveBeenCalledOnce();});
it('keeps failed Storage removals pending for retry',async()=>{const mocks=fixture('website/org/photo.jpg',{message:'unavailable'});expect(await runApprovedOrganizationErasures()).toMatchObject({filesRemoved:0,failed:1});expect(mocks.updated).not.toHaveBeenCalled();});
it('rejects a path outside the reviewed organization',async()=>{const mocks=fixture('website/another/photo.jpg');expect(await runApprovedOrganizationErasures()).toMatchObject({filesRemoved:0,failed:1});expect(mocks.removed).not.toHaveBeenCalled();});
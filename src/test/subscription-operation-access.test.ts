import {describe,it,expect,vi} from 'vitest';
vi.mock('@/lib/saas/subscription-service',()=>({getSubscriptionStatus:vi.fn()}));
import {getSubscriptionStatus} from '@/lib/saas/subscription-service';
import {subscriptionOperationResponse} from '@/lib/saas/subscription-operation-access';
describe('subscription operation suspension',()=>{
 it('keeps account consultation and renewal available without querying suspension',async()=>{vi.mocked(getSubscriptionStatus).mockClear();for(const [method,path]of[['GET','/api/products'],['POST','/api/admin/subscriptions/payments/stripe'],['PATCH','/api/admin/subscriptions/billing']])expect(await subscriptionOperationResponse({method,url:'http://localhost'+path},'org')).toBeNull();expect(getSubscriptionStatus).not.toHaveBeenCalled();});
 it('rejects an operational write for a suspended organization',async()=>{vi.mocked(getSubscriptionStatus).mockResolvedValue({isBlocked:true,isExpired:true} as Awaited<ReturnType<typeof getSubscriptionStatus>>);const response=await subscriptionOperationResponse({method:'POST',url:'http://localhost/api/pos/process-sale'},'org');expect(response?.status).toBe(402);expect((await response!.json()).code).toBe('SUBSCRIPTION_OPERATIONS_SUSPENDED');});
 it('allows operations during a verified active paid period',async()=>{vi.mocked(getSubscriptionStatus).mockResolvedValue({isBlocked:false,isExpired:false} as Awaited<ReturnType<typeof getSubscriptionStatus>>);expect(await subscriptionOperationResponse({method:'PATCH',url:'http://localhost/api/repairs/id'},'org')).toBeNull();});
 it('does not allow a similar-looking route to bypass suspension',async()=>{vi.mocked(getSubscriptionStatus).mockResolvedValue({isBlocked:true} as Awaited<ReturnType<typeof getSubscriptionStatus>>);expect((await subscriptionOperationResponse({method:'POST',url:'http://localhost/api/admin/subscriptions-malicious'},'org'))?.status).toBe(402);});
});

import { afterEach, describe, expect, it, vi } from 'vitest'
const shared=vi.hoisted(()=>({limit:vi.fn()}))
vi.mock('@upstash/redis',()=>({Redis:class{}}))
vi.mock('@upstash/ratelimit',()=>({Ratelimit:class{static slidingWindow(){return 'window'};limit(identifier:string){return shared.limit(identifier)}}}))
import { rateLimiter } from '@/lib/rate-limiter'
afterEach(()=>vi.unstubAllEnvs())
describe('captcha-bypassing mobile password login requires a shared production limit',()=>{
 it('fails closed without production shared configuration',async()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('UPSTASH_REDIS_REST_URL','');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','');await expect(rateLimiter.check('login-prod',8,900000,{requireShared:true})).rejects.toThrow('unavailable')})
 it('fails closed when the configured shared service is unavailable',async()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('UPSTASH_REDIS_REST_URL','https://redis.invalid');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','test-only');shared.limit.mockRejectedValue(new Error('offline'));await expect(rateLimiter.check('login-outage',8,900000,{requireShared:true})).rejects.toThrow('unavailable')})
 it('keeps development login functional without Redis',async()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('UPSTASH_REDIS_REST_URL','');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','');expect(await rateLimiter.check('login-local',8,900000,{requireShared:true})).toBe(true)})
 it('honors denial from the shared backend',async()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('UPSTASH_REDIS_REST_URL','https://redis.invalid');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','test-only');shared.limit.mockResolvedValue({success:false});expect(await rateLimiter.check('login-denied',8,900000,{requireShared:true})).toBe(false)})
})

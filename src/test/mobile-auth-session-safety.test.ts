import { beforeEach, describe, expect, it, vi } from 'vitest'
const auth=vi.hoisted(()=>({token:'A',signOut:vi.fn(),getSession:vi.fn()}))
vi.mock('../../mobile/src/lib/supabase',()=>({supabase:{auth:{getSession:auth.getSession,signOut:auth.signOut}}}))
import { apiFetch } from '../../mobile/src/lib/api'
import { clearLegacyBiometricCredentials } from '../../mobile/src/lib/legacy-biometric'
beforeEach(()=>{auth.token='A';auth.signOut.mockReset();auth.getSession.mockImplementation(async()=>({data:{session:{access_token:auth.token}}}))})
describe('mobile auth session boundary',()=>{
 it('does not sign out B when a delayed request sent with A receives 401',async()=>{
  let finish!:(response:Response)=>void
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve})))
  const request=apiFetch('/test');await vi.waitFor(()=>expect(fetch).toHaveBeenCalled())
  auth.token='B';finish(new Response(JSON.stringify({error:'expired'}),{status:401}))
  await expect(request).rejects.toThrow('expired');expect(auth.signOut).not.toHaveBeenCalled()
 })
 it('locally closes the same expired session',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:401})))
  await expect(apiFetch('/test')).rejects.toThrow();expect(auth.signOut).toHaveBeenCalledWith({scope:'local'})
 })
 it('removes legacy saved passwords without reading any secret',async()=>{
  const deleteItemAsync=vi.fn().mockResolvedValue(undefined)
  await clearLegacyBiometricCredentials({deleteItemAsync})
  expect(deleteItemAsync.mock.calls.map(call=>call[0])).toEqual(['mt_bio_pass','mt_bio_email','mt_bio_enabled'])
 })
})

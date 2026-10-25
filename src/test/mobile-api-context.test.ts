import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const auth=vi.hoisted(()=>({id:'A',token:'tokenA',signOut:vi.fn(),getSession:vi.fn()}))
vi.mock('../../mobile/src/lib/supabase',()=>({supabase:{auth:{getSession:auth.getSession,signOut:auth.signOut}}}))
import { apiFetch } from '../../mobile/src/lib/api'
import { getPrivateCacheContext, setPrivateCacheUser, setPrivateCacheOrganization, setPrivateCacheBranch, isPrivateCacheContextCurrent } from '../../mobile/src/lib/private-cache-context'
beforeEach(()=>{setPrivateCacheUser(null);setPrivateCacheUser('A');setPrivateCacheOrganization('orgA');auth.id='A';auth.token='tokenA';auth.signOut.mockReset();auth.getSession.mockImplementation(async()=>({data:{session:{access_token:auth.token,user:{id:auth.id}}}}))})
afterEach(()=>vi.unstubAllGlobals())
for(const status of [200,401,403]) it(`rejects delayed ${status} from A and preserves B context`,async()=>{
 let finish!:(value:Response)=>void
 vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve})))
 const request=apiFetch('/private');const rejected=expect(request).rejects.toThrow()
 await vi.waitFor(()=>expect(finish).toBeDefined())
 auth.id='B';auth.token='tokenB';setPrivateCacheUser('B');setPrivateCacheOrganization('orgB');const b=getPrivateCacheContext()
 finish(new Response(JSON.stringify(status===200?{private:'A'}:{error:'denied'}),{status}))
 await rejected;expect(isPrivateCacheContextCurrent(b)).toBe(true);expect(auth.signOut).not.toHaveBeenCalled()
})
// R1: un 403 de un permiso puntual es normal (un vendedor intenta algo de un encargado)
// y no puede vaciar el panel ni las cachés.
it('keeps the context on a regular 403 for a missing permission',async()=>{
 const before=getPrivateCacheContext();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"error":"Forbidden","message":"Insufficient permissions for this organization."}',{status:403})))
 await expect(apiFetch('/private')).rejects.toThrow('Forbidden')
 expect(isPrivateCacheContextCurrent(before)).toBe(true);expect(auth.signOut).not.toHaveBeenCalled()
})
for(const body of ['{"error":"Organization required","code":"ORGANIZATION_REQUIRED"}','{"error":"Forbidden","code":"ACCOUNT_INACTIVE"}','{"error":"Organization required"}'])
it(`invalidates only the current scope when membership is lost (${body}) without logging out`,async()=>{
 const before=getPrivateCacheContext();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(body,{status:403})))
 await expect(apiFetch('/private')).rejects.toThrow()
 expect(isPrivateCacheContextCurrent(before)).toBe(false);expect(getPrivateCacheContext().access).toBe(before.access+1)
 expect(getPrivateCacheContext().organizationId).toBe('orgA');expect(auth.signOut).not.toHaveBeenCalled()
})
it('revokes access and signs out on 401',async()=>{
 const before=getPrivateCacheContext();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"error":"Unauthorized"}',{status:401})))
 await expect(apiFetch('/private')).rejects.toThrow('Unauthorized')
 expect(getPrivateCacheContext().access).toBe(before.access+1);expect(auth.signOut).toHaveBeenCalledWith({scope:'local'})
})
it('does not let a late membership-lost 403 from user A revoke user B',async()=>{
 let finish!:(value:Response)=>void
 vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve})))
 const request=apiFetch('/private');const rejected=expect(request).rejects.toThrow()
 await vi.waitFor(()=>expect(finish).toBeDefined())
 auth.id='B';auth.token='tokenB';setPrivateCacheUser('B');setPrivateCacheOrganization('orgB');const b=getPrivateCacheContext()
 finish(new Response('{"error":"Organization required","code":"ORGANIZATION_REQUIRED"}',{status:403}))
 await rejected;expect(isPrivateCacheContextCurrent(b)).toBe(true)
})
// M1: al abrir la app el comercio y la sucursal se resuelven mientras otras pantallas
// ya pidieron datos. Esas respuestas son de la misma identidad y se aceptan.
it('accepts a response that arrives after the organization is resolved at startup',async()=>{
 setPrivateCacheUser(null);setPrivateCacheUser('A');let finish!:(value:Response)=>void
 vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve})))
 const request=apiFetch<{ok:boolean}>('/private');await vi.waitFor(()=>expect(finish).toBeDefined())
 setPrivateCacheOrganization('orgA','owner')
 finish(new Response('{"ok":true}'));await expect(request).resolves.toEqual({ok:true})
})
it('accepts a response that arrives after the branch is resolved for the first time',async()=>{
 let finish!:(value:Response)=>void
 vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve})))
 const request=apiFetch<{ok:boolean}>('/private');await vi.waitFor(()=>expect(finish).toBeDefined())
 setPrivateCacheBranch('branch1')
 finish(new Response('{"ok":true}'));await expect(request).resolves.toEqual({ok:true})
})
it('does not abort a request when the user is resolved while the session is read (slow network)',async()=>{
 setPrivateCacheUser(null);let release!:()=>void
 auth.getSession.mockImplementationOnce(()=>new Promise(resolve=>{release=()=>resolve({data:{session:{access_token:'tokenA',user:{id:'A'}}}})}))
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"ok":true}')))
 const request=apiFetch<{ok:boolean}>('/private');await vi.waitFor(()=>expect(release).toBeDefined())
 setPrivateCacheUser('A');release()
 await expect(request).resolves.toEqual({ok:true})
})
it('still rejects a response when known permissions change before it arrives',async()=>{
 setPrivateCacheOrganization('orgA','owner');let finish!:(value:Response)=>void
 vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve})))
 const request=apiFetch('/private');const rejected=expect(request).rejects.toThrow();await vi.waitFor(()=>expect(finish).toBeDefined())
 setPrivateCacheOrganization('orgA','cashier')
 finish(new Response('{"private":"owner-only"}'));await rejected
})
it('clears private data on 401 when the stored credentials are already missing',async()=>{
 const before=getPrivateCacheContext()
 auth.getSession.mockResolvedValue({data:{session:null}})
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"error":"expired"}',{status:401})))
 await expect(apiFetch('/private')).rejects.toThrow('expired')
 expect(isPrivateCacheContextCurrent(before)).toBe(false)
 expect(auth.signOut).not.toHaveBeenCalled()
})
it('sends the explicitly resolved branch and rejects a response from the previous branch',async()=>{
 setPrivateCacheBranch('branch1');let finish!:(value:Response)=>void
 vi.stubGlobal('fetch',vi.fn((_url,init)=>{expect(init.headers['x-branch-id']).toBe('branch1');return new Promise(resolve=>{finish=resolve})}))
 const request=apiFetch('/products');const rejected=expect(request).rejects.toThrow()
 await vi.waitFor(()=>expect(finish).toBeDefined());setPrivateCacheBranch('branch2')
 finish(new Response('{"product":"branch1"}'));await rejected
})
it('does not invalidate the new context after a network failure',async()=>{
 let fail!:(error:Error)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise((_resolve,reject)=>{fail=reject})))
 const request=apiFetch('/private');const rejected=expect(request).rejects.toThrow()
 await vi.waitFor(()=>expect(fail).toBeDefined());setPrivateCacheUser('B');setPrivateCacheOrganization('orgB');const b=getPrivateCacheContext()
 fail(new Error('offline'));await rejected;expect(isPrivateCacheContextCurrent(b)).toBe(true)
})

it('sends the selected organization through A to B to A', async()=>{
 const send=vi.fn().mockImplementation(()=>Promise.resolve(new Response('{"ok":true}')));vi.stubGlobal('fetch',send)
 for(const org of ['orgA','orgB','orgA']) {setPrivateCacheOrganization(org);await apiFetch('/private');expect(new Headers(send.mock.calls.at(-1)?.[1].headers).get('x-organization-id')).toBe(org)}
})

import { beforeEach, expect, it, vi } from 'vitest'
import { getPrivateCacheContext, setPrivateCacheUser, setPrivateCacheOrganization, setPrivateCacheBranch, isPrivateCacheContextCurrent, invalidatePrivateCacheContext } from '../../mobile/src/lib/private-cache-context'
beforeEach(() => { setPrivateCacheUser(null) })
it('invalidates old snapshots across logout, user, organization, branch and permissions', () => {
 setPrivateCacheUser('A');setPrivateCacheOrganization('orgA','owner');setPrivateCacheBranch('b1')
 const a=getPrivateCacheContext()
 expect(isPrivateCacheContextCurrent(a)).toBe(true)
 setPrivateCacheUser(null);setPrivateCacheUser('B');setPrivateCacheOrganization('orgB','owner')
 expect(isPrivateCacheContextCurrent(a)).toBe(false)
 const b=getPrivateCacheContext();invalidatePrivateCacheContext(a)
 expect(isPrivateCacheContextCurrent(b)).toBe(true)
 setPrivateCacheBranch('b2');expect(isPrivateCacheContextCurrent(b)).toBe(false)
 const branch=getPrivateCacheContext();setPrivateCacheOrganization('orgB','cashier')
 expect(isPrivateCacheContextCurrent(branch)).toBe(false)
})
const storage=vi.hoisted(()=>({getItem:vi.fn(),setItem:vi.fn().mockResolvedValue(undefined),removeItem:vi.fn().mockResolvedValue(undefined)}))
vi.mock('../../mobile/src/lib/secure-storage',()=>({secureStorage:storage}))
vi.mock('../../mobile/src/lib/api',()=>({apiFetch:vi.fn(),ApiError:class extends Error {}}))
vi.mock('../../mobile/src/lib/supabase',()=>({supabase:{}}))
import { cachedProduct, rememberProducts, type Product } from '../../mobile/src/lib/products'
import { frequentProducts, recordSold } from '../../mobile/src/lib/pos-frequent'
const product={id:'p1',name:'Private A',sku:'A',sale_price:100,stock_quantity:5,is_active:true} as Product
it('does not expose or repopulate product caches after a context transition',()=>{
 setPrivateCacheUser('A');setPrivateCacheOrganization('orgA');setPrivateCacheBranch('b1');const a=getPrivateCacheContext()
 rememberProducts([product],a);expect(cachedProduct('p1')).toEqual(product)
 setPrivateCacheUser('B');setPrivateCacheOrganization('orgB')
 expect(cachedProduct('p1')).toBeUndefined();rememberProducts([product],a)
 expect(cachedProduct('p1')).toBeUndefined()
})
it('namespaces frequent products and drops a late storage read after logout',async()=>{
 storage.getItem.mockResolvedValue(null)
 setPrivateCacheUser('A');setPrivateCacheOrganization('orgA');setPrivateCacheBranch('b1')
 await recordSold([{product,quantity:1}])
 expect(storage.setItem.mock.calls.at(-1)?.[0]).toMatch(/^mt_pos_frequent\.[0-9a-f]+\.[0-9a-f]+\.[0-9a-f]+$/)
 expect(storage.removeItem).toHaveBeenCalledWith('mt_pos_frequent')
 let finish!:(value:string)=>void
 storage.getItem.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 const reading=frequentProducts();await vi.waitFor(()=>expect(finish).toBeDefined())
 setPrivateCacheUser(null);setPrivateCacheUser('B');setPrivateCacheOrganization('orgB')
 finish(JSON.stringify({p1:{count:1,last:1,product}}))
 expect(await reading).toEqual([])
})

it('does not reuse a private product while the server branch is unresolved',()=>{
 setPrivateCacheUser('A');setPrivateCacheOrganization('orgA');rememberProducts([product])
 expect(cachedProduct('p1')).toBeUndefined()
 setPrivateCacheBranch('b1');rememberProducts([product]);expect(cachedProduct('p1')).toEqual(product)
 setPrivateCacheBranch('b2');expect(cachedProduct('p1')).toBeUndefined()
})

it('restores existing frequent products after a cold entry resolves its branch',async()=>{
 setPrivateCacheUser('A');setPrivateCacheOrganization('orgA')
 storage.getItem.mockResolvedValue(JSON.stringify({p1:{count:2,last:1,product}}))
 expect(await frequentProducts()).toEqual([])
 setPrivateCacheBranch('b1')
 expect(await frequentProducts()).toEqual([product])
})

// R1 / R2 / M1: qué transiciones son de identidad (descartan lo privado en pantalla)
// y cuáles solo terminan de resolver el mismo contexto.
import { isPrivateCacheSnapshotCompatible, isPrivateIdentityTransition, isSameOrganizationIdentity, subscribePrivateCacheContext } from '../../mobile/src/lib/private-cache-context'
it('treats resolving the organization or the branch as the same identity',()=>{
 setPrivateCacheUser('A');const userOnly=getPrivateCacheContext()
 setPrivateCacheOrganization('orgA','owner');const withOrg=getPrivateCacheContext()
 expect(isPrivateCacheSnapshotCompatible(userOnly)).toBe(true)
 expect(isPrivateIdentityTransition(withOrg,userOnly)).toBe(false)
 setPrivateCacheBranch('b1');expect(isPrivateCacheSnapshotCompatible(withOrg)).toBe(true)
 const withBranch=getPrivateCacheContext();setPrivateCacheBranch('b2')
 expect(isPrivateCacheSnapshotCompatible(withBranch)).toBe(false)
 // El producto es del comercio: otra sucursal no lo invalida.
 expect(isSameOrganizationIdentity(withBranch)).toBe(true)
})
it('treats another user, another organization or a revocation as a new identity',()=>{
 setPrivateCacheUser('A');setPrivateCacheOrganization('orgA','owner');const a=getPrivateCacheContext()
 invalidatePrivateCacheContext(a);const revoked=getPrivateCacheContext()
 expect(revoked.access).toBe(a.access+1);expect(isSameOrganizationIdentity(a)).toBe(false);expect(isPrivateIdentityTransition(revoked,a)).toBe(true)
 setPrivateCacheOrganization('orgB','owner');expect(isSameOrganizationIdentity(revoked)).toBe(false)
 setPrivateCacheUser('B');expect(isPrivateCacheSnapshotCompatible(revoked)).toBe(false)
})
it('only lets the current identity revoke itself',()=>{
 setPrivateCacheUser('A');setPrivateCacheOrganization('orgA');const a=getPrivateCacheContext()
 setPrivateCacheUser('B');setPrivateCacheOrganization('orgB');const b=getPrivateCacheContext()
 invalidatePrivateCacheContext(a);expect(getPrivateCacheContext()).toBe(b)
})
// R2: la regla que usa el formulario de producto para conservar o vaciar el borrador.
it('keeps a partially filled product form for the same user and organization, and drops it for another account',()=>{
 setPrivateCacheUser('A');let draft='Mouse inalámbrico, Gs. 120.000'
 const stop=subscribePrivateCacheContext((next,previous)=>{ if(!isSameOrganizationIdentity(previous,next)) draft='' })
 setPrivateCacheOrganization('orgA','owner');setPrivateCacheBranch('b1');setPrivateCacheOrganization('orgA','manager')
 expect(draft).toBe('Mouse inalámbrico, Gs. 120.000')
 setPrivateCacheUser(null);setPrivateCacheUser('B');setPrivateCacheOrganization('orgB')
 expect(draft).toBe('');stop()
})

// R1: el panel no se vacía con un 403 de permisos ni al resolver comercio o sucursal.
import { panelTransitionAction } from '../../mobile/src/lib/private-cache-context'
it('keeps the panel on startup resolution and branch changes, reloads on revocation, resets on another identity',()=>{
 const actions:string[]=[];const stop=subscribePrivateCacheContext((next,previous)=>actions.push(panelTransitionAction(next,previous)))
 setPrivateCacheUser('A');setPrivateCacheOrganization('orgA','owner');setPrivateCacheBranch('b1');setPrivateCacheBranch('b2');setPrivateCacheOrganization('orgA','manager')
 invalidatePrivateCacheContext();setPrivateCacheOrganization('orgB','owner');setPrivateCacheUser('B')
 stop()
 // usuario resuelto (reset desde «nadie»), comercio, 2 sucursales y un permiso: keep; revocación: reload; otro comercio y otro usuario: reset
 expect(actions).toEqual(['reset','keep','keep','keep','keep','reload','reset','reset'])
})

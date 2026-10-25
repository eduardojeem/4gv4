import { expect, it, vi } from 'vitest'
import { loadPosPrivateCatalog } from '../../mobile/src/lib/pos-private-catalog'
import { setPrivateCacheUser, setPrivateCacheOrganization, setPrivateCacheBranch } from '../../mobile/src/lib/private-cache-context'
const setup=()=>{setPrivateCacheUser(null);setPrivateCacheUser('A');setPrivateCacheOrganization('orgA')}
it('waits for the server branch and then loads persisted frequent products on entry',async()=>{
 setup();const loadFrequent=vi.fn().mockResolvedValue([{id:'stored'}]);const loadCategories=vi.fn().mockResolvedValue([]);const onFrequent=vi.fn();const onCategories=vi.fn()
 const options={loadFrequent,loadCategories,onFrequent,onCategories}
 loadPosPrivateCatalog(undefined,options);expect(loadFrequent).not.toHaveBeenCalled()
 setPrivateCacheBranch('branch1');loadPosPrivateCatalog('branch1',options)
 await vi.waitFor(()=>expect(onFrequent).toHaveBeenCalledWith([{id:'stored'}]))
 expect(loadCategories).toHaveBeenCalledOnce()
})
it('does not repopulate categories or clear new data from an old success or failure',async()=>{
 setup();setPrivateCacheBranch('branch1');let resolve!:(rows:unknown[])=>void;let reject!:(error:Error)=>void
 const onFrequent=vi.fn();const onCategories=vi.fn()
 loadPosPrivateCatalog('branch1',{loadFrequent:()=>new Promise((_resolve,no)=>{reject=no}),loadCategories:()=>new Promise(yes=>{resolve=yes}),onFrequent,onCategories})
 setPrivateCacheBranch('branch2')
 loadPosPrivateCatalog('branch2',{loadFrequent:async()=>[{id:'new'}],loadCategories:async()=>[{id:'newCategory'}],onFrequent,onCategories})
 await vi.waitFor(()=>expect(onCategories).toHaveBeenCalledWith([{id:'newCategory'}]))
 resolve([{id:'oldCategory'}]);reject(new Error('old offline'));await Promise.resolve();await Promise.resolve()
 expect(onCategories).toHaveBeenCalledTimes(1);expect(onFrequent).toHaveBeenCalledTimes(1)
 expect(onFrequent).toHaveBeenCalledWith([{id:'new'}])
})
it('ignores completion after the screen unmounts',async()=>{
 setup();setPrivateCacheBranch('branch1');let resolve!:(rows:unknown[])=>void;const onFrequent=vi.fn();const onCategories=vi.fn()
 const cancel=loadPosPrivateCatalog('branch1',{loadFrequent:()=>new Promise(yes=>{resolve=yes}),loadCategories:async()=>[],onFrequent,onCategories})
 cancel();resolve([{id:'private'}]);await Promise.resolve();await Promise.resolve()
 expect(onFrequent).not.toHaveBeenCalled();expect(onCategories).not.toHaveBeenCalled()
})

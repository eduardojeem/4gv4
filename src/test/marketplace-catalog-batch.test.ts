import { expect,it,vi } from 'vitest'
const state=vi.hoisted(()=>({calls:[] as unknown[][]}))
vi.mock('server-only',()=>({}))
vi.mock('next/cache',()=>({unstable_cache:(_fn:unknown,key:string[])=>async(...args:unknown[])=>{if(key[0]==='marketplace-products')state.calls.push(args);return {products:[],total:435}}}))
import { getMarketplaceCatalogBatch } from '../lib/public/marketplace'
it('passes each offset into its own bounded cache key rather than repeating the first 100 products',async()=>{state.calls=[];await getMarketplaceCatalogBatch(100);expect(state.calls).toEqual([[100],[100,{offset:100}]])})
it('does not create cache entries for unbounded or nonexistent pages',async()=>{state.calls=[];await getMarketplaceCatalogBatch(999999);expect(state.calls).toEqual([[100]])})

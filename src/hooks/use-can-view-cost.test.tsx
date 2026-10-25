import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
const tenant=vi.hoisted(()=>({scope:'u1:o1',organizationId:'o1',userId:'u1',currentScope:{current:'u1:o1'}}))
vi.mock('@/hooks/use-tenant-scope',()=>({useTenantScope:()=>tenant}))
import { useCanViewCost, useCanUpdateCost } from './use-can-view-cost'
afterEach(()=>{cleanup();vi.unstubAllGlobals();tenant.scope='u1:o1';tenant.currentScope.current=tenant.scope;tenant.organizationId='o1'})
describe('organization product cost capabilities',()=>{
 it('fails closed then separates read from write and deduplicates subscribers',async()=>{
  const fetcher=vi.fn(async()=>({ok:true,json:async()=>({organizationId:'o1',canReadCost:true,canUpdateCost:false})}))
  vi.stubGlobal('fetch',fetcher)
  const hook=renderHook(()=>({read:useCanViewCost(),write:useCanUpdateCost()}))
  expect(hook.result.current).toEqual({read:false,write:false})
  await waitFor(()=>expect(hook.result.current).toEqual({read:true,write:false}))
  expect(fetcher).toHaveBeenCalledTimes(1)
 })
 it('clears on tenant switch and ignores a late response from the previous scope',async()=>{
  let resolveOld:(value:unknown)=>void=()=>{}
  vi.stubGlobal('fetch',vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve})).mockResolvedValue({ok:true,json:async()=>({organizationId:'o1',canReadCost:false,canUpdateCost:false})}))
  const hook=renderHook(()=>useCanViewCost())
  tenant.scope='u1:o2';tenant.organizationId='o2';tenant.currentScope.current=tenant.scope;hook.rerender()
  await act(async()=>{resolveOld({ok:true,json:async()=>({organizationId:'o1',canReadCost:true,canUpdateCost:true})});await Promise.resolve()})
  expect(hook.result.current).toBe(false)
 })
 it('keeps write-only grants from editing hidden normalized costs in visual forms',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({organizationId:'o1',canReadCost:false,canUpdateCost:true})})))
  let renders=0
  const hook=renderHook(()=>{renders++;return useCanUpdateCost()})
  await waitFor(()=>expect(renders).toBeGreaterThan(1))
  expect(hook.result.current).toBe(false)
 })
 it('clears a previous allowed scope immediately and remains denied after a 403',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({organizationId:'o1',canReadCost:true,canUpdateCost:true})}).mockResolvedValueOnce({ok:false,status:403})
  vi.stubGlobal('fetch',fetcher)
  let renders=0
  const hook=renderHook(()=>{renders++;return {read:useCanViewCost(),write:useCanUpdateCost()}})
  await waitFor(()=>expect(hook.result.current).toEqual({read:true,write:true}))
  tenant.scope='u1:o2';tenant.organizationId='o2';tenant.currentScope.current=tenant.scope;hook.rerender()
  expect(hook.result.current).toEqual({read:false,write:false})
  const before=renders
  await waitFor(()=>expect(renders).toBeGreaterThan(before))
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(hook.result.current).toEqual({read:false,write:false})
 })
 it('rejects old-cookie organization capabilities returned during an organization switch',async()=>{
  tenant.scope='u1:o2';tenant.organizationId='o2';tenant.currentScope.current=tenant.scope
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({organizationId:'o1',canReadCost:true,canUpdateCost:true})})))
  let renders=0
  const hook=renderHook(()=>{renders++;return {read:useCanViewCost(),write:useCanUpdateCost()}})
  await waitFor(()=>expect(renders).toBeGreaterThan(1))
  expect(hook.result.current).toEqual({read:false,write:false})
 })
 it('does not grant access on a failed or malformed response',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({organizationId:'o1',canReadCost:'true',canUpdateCost:1})})))
  let renders=0
  const hook=renderHook(()=>{renders++;return {read:useCanViewCost(),write:useCanUpdateCost()}})
  await waitFor(()=>expect(renders).toBeGreaterThan(1))
  expect(hook.result.current).toEqual({read:false,write:false})
 })
})

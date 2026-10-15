// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { runCollectionAttempt, retryCollectionAttempt, pendingCollectionAttempt } from './collection-attempt'
const scope='fixture-org:fixture-user:fixture-customer'
const receipt={receiptId:'77777777-7777-4777-8777-777777777777',receiptNumber:'COL-1',appliedAmount:100,excessToStoreCredit:0,
 recordedAt:'2026-10-11T12:00:00Z',allocations:[{debtId:'66666666-6666-4666-8666-666666666666',type:'installment',
 paymentId:'88888888-8888-4888-8888-888888888888',appliedAmount:100,remainingBalance:0}]}
const memory=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}}}
describe('recoverable collection attempt',()=>{
 it('retains an uncertain attempt when recovery is denied after access changes',async()=>{
  const storage=memory()
  const fetcher=vi.fn().mockRejectedValueOnce(new Error('Disconnected'))
   .mockResolvedValueOnce(new Response(JSON.stringify({success:false,error:'Access denied'}),{status:403}))
  await expect(runCollectionAttempt(scope,'/api/credits',{amount:100},storage,fetcher)).rejects.toMatchObject({uncertain:true})
  const saved=pendingCollectionAttempt(scope,storage)
  await expect(retryCollectionAttempt(scope,storage,fetcher)).rejects.toMatchObject({uncertain:true})
  expect(pendingCollectionAttempt(scope,storage)).toEqual(saved)
 })
 it('reuses the frozen payload after a lost response and component remount',async()=>{
  const storage=memory();const fetcher=vi.fn().mockRejectedValueOnce(new Error('Disconnected')).mockResolvedValueOnce(new Response(JSON.stringify({success:true,collection:receipt})))
  await expect(runCollectionAttempt(scope,'/api/credits',{amount:100},storage,fetcher)).rejects.toMatchObject({uncertain:true})
  expect(pendingCollectionAttempt(scope,storage)).not.toBeNull()
  const result=await retryCollectionAttempt(scope,storage,fetcher)
  expect(result.collection.appliedAmount).toBe(100)
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body)
  expect(pendingCollectionAttempt(scope,storage)).toBeNull()
 })
 it('blocks a different request until the uncertain attempt is resolved',async()=>{
  const storage=memory();const fetcher=vi.fn().mockRejectedValue(new Error('Disconnected'))
  await expect(runCollectionAttempt(scope,'/api/credits',{amount:100},storage,fetcher)).rejects.toMatchObject({uncertain:true})
  await expect(runCollectionAttempt(scope,'/api/credits',{amount:200},storage,fetcher)).rejects.toMatchObject({uncertain:true})
  expect(fetcher).toHaveBeenCalledTimes(1)
 })
 it('does not share a pending attempt with another organization or user',async()=>{
  const storage=memory()
  await expect(runCollectionAttempt(scope,'/api/credits',{amount:100},storage,vi.fn().mockRejectedValue(new Error('Disconnected')))).rejects.toThrow()
  expect(pendingCollectionAttempt('another-org:another-user:fixture-customer',storage)).toBeNull()
 })
 it('never sends a request if its retry key cannot be safely retained',async()=>{
  const storage={...memory(),setItem:()=>{throw new Error('Quota exceeded')}}
  const fetcher=vi.fn()
  await expect(runCollectionAttempt(scope,'/api/credits',{amount:100},storage,fetcher)).rejects.toThrow()
  expect(fetcher).not.toHaveBeenCalled()
 })
 it('allows a corrected request after a definite validation rejection',async()=>{
  const storage=memory();const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:false,error:'Invalid amount'}),{status:400}))
  await expect(runCollectionAttempt(scope,'/api/credits',{amount:100},storage,fetcher)).rejects.toMatchObject({uncertain:false})
  expect(pendingCollectionAttempt(scope,storage)).toBeNull()
 })
})

import { describe, expect, it, vi } from 'vitest'
import { submitFinanceAttempt, readPendingFinanceAttempt } from '../../mobile/src/lib/finance-attempt'
const context={userId:'u',organizationId:'o'}
function storage(){const data=new Map<string,string>();return{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)},removeItem:(key:string)=>{data.delete(key)}}}
const attempt={kind:'payment' as const,targetId:'expense',payload:{branchId:'branch',amount:100,paymentMethod:'bank_transfer',paymentDate:'2026-11-11'}}
describe('durable finance mutations',()=>{
 it('persists before sending and reuses the same idempotency key after timeout',async()=>{
  const store=storage();const keys:string[]=[];const send=vi.fn(async(_input:unknown,key:string)=>{keys.push(key);if(keys.length===1)throw new Error('timeout');return{success:true}})
  await expect(submitFinanceAttempt(context,attempt,store,send)).rejects.toThrow()
  expect(await readPendingFinanceAttempt(context,store)).not.toBeNull()
  await submitFinanceAttempt(context,attempt,store,send)
  expect(keys[0]).toBe(keys[1]);expect(await readPendingFinanceAttempt(context,store)).toBeNull()
 })
 it('blocks a changed amount while the result is uncertain',async()=>{
  const store=storage();const send=vi.fn(async()=>{throw new Error('timeout')})
  await expect(submitFinanceAttempt(context,attempt,store,send)).rejects.toThrow()
  await expect(submitFinanceAttempt(context,{...attempt,payload:{...attempt.payload,amount:200}},store,send)).rejects.toThrow(/pendiente/)
  expect(send).toHaveBeenCalledTimes(1)
 })
 it('does not mix pending payments between users or organizations',async()=>{
  const store=storage();await expect(submitFinanceAttempt(context,attempt,store,async()=>{throw new Error('timeout')})).rejects.toThrow()
  expect(await readPendingFinanceAttempt({...context,organizationId:'other'},store)).toBeNull()
  expect(await readPendingFinanceAttempt({...context,userId:'other'},store)).toBeNull()
 })
 it('never sends when persistence fails',async()=>{
  const store=storage();store.setItem=()=>{throw new Error('disk full')};const send=vi.fn()
  await expect(submitFinanceAttempt(context,attempt,store,send)).rejects.toThrow();expect(send).not.toHaveBeenCalled()
 })
})
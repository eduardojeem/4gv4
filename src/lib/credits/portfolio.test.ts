// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readAllCreditRows, summarizeCreditPortfolio } from './portfolio'
describe('complete credit portfolio',()=>{
 it('does not accept the legacy late flag as mora during the organization due day',()=>{
  const summary=summarizeCreditPortfolio([{id:'a',customer_id:'one',status:'active'}],
   [{credit_id:'a',status:'late',amount:100,amount_paid:25,due_date:'2026-10-11'}],
   'America/Asuncion',new Date('2026-10-11T12:00:00Z'))
  expect(summary.overdue).toBe(0)
 })
 it('keeps completed credits out of active debt even with stale installment status',()=>{
  const result=summarizeCreditPortfolio([{id:'done',customer_id:'one',status:'completed'}],
   [{credit_id:'done',status:'pending',amount:100,amount_paid:75,due_date:'2026-10-10'}])
  expect(result.outstanding).toBe(0)
  expect(result.overdue).toBe(0)
  expect(result.paid).toBe(75)
 })
 it('does not stop at the first server page',async()=>{
  const rows=Array.from({length:1201},(_,id)=>({id}))
  const loaded=await readAllCreditRows((from,to)=>Promise.resolve({data:rows.slice(from,to+1),error:null}))
  expect(loaded).toHaveLength(1201);expect(loaded[1200].id).toBe(1200)
 })
 it('never turns a failed page into a complete-looking total',async()=>{
  await expect(readAllCreditRows((from,to)=>Promise.resolve({data:from===0?Array.from({length:to+1},()=>({id:1})):null,error:from===0?null:{message:'failed'}}))).rejects.toThrow()
 })
 it('counts homonyms by ID and excludes cancelled debt',()=>{
  const credits=[{id:'a',customer_id:'one',status:'active'},{id:'b',customer_id:'two',status:'active'},{id:'c',customer_id:'three',status:'cancelled'}]
  const installments=credits.map(c=>({id:c.id,credit_id:c.id,status:'pending',amount:100,amount_paid:25,due_date:'2026-10-10'}))
  const summary=summarizeCreditPortfolio(credits,installments,'America/Asuncion',new Date('2026-10-11T12:00:00Z'))
  expect(summary.outstanding).toBe(150);expect(summary.paid).toBe(50);expect(summary.overdue).toBe(150);expect(summary.distinctCustomers).toBe(2)
 })
})

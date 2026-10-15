import { cleanup, renderHook, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/contexts/ActiveOrganizationContext',()=>({useOptionalActiveOrganization:()=>({organization:{id:'fixture-org'}})}))
import { useCustomerCredits } from '@/hooks/use-customer-credits'
import { CustomerCreditInfo } from '@/components/dashboard/customers/CustomerCreditInfo'
import { mapRawToCustomer } from '@/hooks/use-customer-state'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
describe('verified customer debt data',()=>{
 it('never exposes cupo or risk after a failed debt read',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url)=>new Response(JSON.stringify(String(url).includes('collect-payment')?{success:false}:{credits:[],installments:[],payments:[]}),{status:String(url).includes('collect-payment')?500:200})))
  const {result}=renderHook(()=>useCustomerCredits('fixture-customer'))
  await waitFor(()=>expect(result.current.error).not.toBeNull())
  expect(result.current.creditSummary).toBeNull()
 })
 it('shows insufficient history and keeps an absent due date absent',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url)=>new Response(JSON.stringify(String(url).includes('collect-payment')?
    {success:true,totalDebt:100,overdueDebt:0,creditLimit:200,storeBalance:0,debts:[{id:'repair',type:'repair',title:'Reparación',pendingAmount:100,totalAmount:100,paidAmount:0,isOverdue:false,status:'pending'}]}:
    {credits:[],installments:[],payments:[]}))))
  const {result}=renderHook(()=>useCustomerCredits('fixture-customer'))
  await waitFor(()=>expect(result.current.loading).toBe(false))
  expect(result.current.creditSummary?.payment_history.payment_score).toBeNull()
  expect(result.current.creditSummary?.next_payment?.due_date).toBeNull()
  expect(result.current.creditSummary?.available_credit).toBe(100)
 })
 it('presents debt, overdue, cupo and store balance as separate concepts',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url)=>new Response(JSON.stringify(String(url).includes('collect-payment')?
    {success:true,totalDebt:100,overdueDebt:25,creditLimit:200,storeBalance:50,debts:[]}:
    {credits:[],installments:[],payments:[]}))))
  render(<CustomerCreditInfo customer={mapRawToCustomer({id:'fixture-customer',name:'Ana',customer_code:'CLI-1',ruc:'123456'})}/>)
  expect(await screen.findByText('Deuda vencida')).toBeVisible()
  expect(screen.getByText('Deuda total')).toBeVisible()
  expect(screen.getByText('Cupo disponible')).toBeVisible()
  expect(screen.getByText('Saldo a favor')).toBeVisible()
  expect(screen.getByText(/no se descuenta automáticamente/i)).toBeVisible()
 })
})

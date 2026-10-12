import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/config', () => ({ config: { supabase: { isConfigured: true } } }))
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: 'branch' }) }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useOptionalActiveOrganization: () => ({ organization: { id: 'org' } }) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'actor' } }) }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: { id: 'actor' } }) }))
import { useCreditSystem } from '@/hooks/use-credit-system'
import { CustomerCreditHistory } from '@/components/pos/CustomerCreditHistory'
import { mapRawToCustomer } from '@/hooks/use-customer-state'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear() })
it('records multiple POS installments through one recoverable collection and returns the persisted receipt', async () => {
  const customer='44444444-4444-4444-8444-444444444444'
  const installments=['66666666-6666-4666-8666-666666666666','66666666-6666-4666-8666-666666666667']
  const receipt={receiptId:'77777777-7777-4777-8777-777777777777',receiptNumber:'COL-POS',appliedAmount:100,
    excessToStoreCredit:0,recordedAt:'2026-10-12T12:00:00Z',paymentMethod:'cash',reference:null,notes:null,
    allocations:installments.map((id,index)=>({debtId:id,type:'installment',paymentId:index===0?'88888888-8888-4888-8888-888888888888':'88888888-8888-4888-8888-888888888889',appliedAmount:50,remainingBalance:0}))}
  const fetcher=vi.fn(async (url:string,_options?:RequestInit)=>new Response(JSON.stringify(url.includes('/batch')?
    {credits:[{id:'credit',customer_id:customer,status:'active'}],installments:installments.map(id=>({id,credit_id:'credit',amount:50,amount_paid:0,status:'pending',due_date:'2026-01-01'})),payments:[]}:
    {success:true,collection:receipt})))
  vi.stubGlobal('fetch',fetcher)
  const {result}=renderHook(()=>useCreditSystem())
  await act(async()=>{await result.current.loadCreditData(customer)})
  let outcome:unknown
  await act(async()=>{outcome=await result.current.recordPayment(customer,100,'cash')})
  expect(outcome).toMatchObject({receiptNumber:'COL-POS',appliedAmount:100})
  const writes=fetcher.mock.calls.filter(([,options])=>options?.method==='POST' && !String(options?.body).includes('customerIds'))
  expect(writes).toHaveLength(1)
  expect(writes[0][0]).toBe('/api/customers/'+customer+'/collect-payment')
})

it('prints the confirmed receipt in the real legacy POS component instead of a projected balance', async () => {
  const customer='44444444-4444-4444-8444-444444444444'
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('/batch')?
    {credits:[{id:'credit',customer_id:customer,status:'active',principal:100}],installments:[{
      id:'66666666-6666-4666-8666-666666666666',credit_id:'credit',amount:100,amount_paid:0,status:'pending',due_date:'2026-01-01',installment_number:1}],payments:[]}:
    {success:true,collection:{receiptId:'77777777-7777-4777-8777-777777777777',receiptNumber:'COL-POS-UI',
      appliedAmount:60,excessToStoreCredit:0,recordedAt:'2026-10-12T12:00:00Z',paymentMethod:'cash',reference:null,notes:null,
      creditBalances:{credit:{remainingBalance:40,paidInstallments:0,pendingInstallments:1,nextDueDate:null,nextDueAmount:null}},
      allocations:[{debtId:'66666666-6666-4666-8666-666666666666',type:'installment',paymentId:'88888888-8888-4888-8888-888888888888',appliedAmount:60,remainingBalance:40}]}}))))
  render(<CustomerCreditHistory customer={mapRawToCustomer({id:customer,name:'Ana',credit_limit:1000})}/>)
  const open=await screen.findByRole('button',{name:'Registrar Pago'})
  await waitFor(()=>expect(open).toBeEnabled())
  fireEvent.click(open)
  const dialog=screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Monto a Pagar'),{target:{value:'100'}})
  fireEvent.click(within(dialog).getByRole('button',{name:'Registrar Pago'}))
  expect(await screen.findByText('COL-POS-UI')).toBeVisible()
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatCurrency } from '@/lib/currency'
vi.mock('@/hooks/use-credit-printing',()=>({useCreditPrinting:()=>({format:'80mm',changeFormat:vi.fn(),issuer:{}})}))
import { CreditPaymentDialog } from '@/components/dashboard/credits/CreditPaymentDialog'
afterEach(cleanup)
describe('credit collection confirmation',()=>{
 it('shows the amount actually recorded rather than the requested amount',async()=>{
  const confirm=vi.fn().mockResolvedValue({success:true,appliedAmount:60,collection:{
    receiptId:'77777777-7777-4777-8777-777777777777',receiptNumber:'COL-FIXTURE',appliedAmount:60,excessToStoreCredit:0,
    paymentMethod:'transfer',reference:'TRX-RECUPERADA',notes:'Pago original',
    recordedAt:'2026-10-11T12:00:00Z',allocations:[],creditBalances:{fixture:{remainingBalance:40,paidInstallments:0,pendingInstallments:1,nextDueDate:null,nextDueAmount:null}}
  }})
  render(<CreditPaymentDialog open onOpenChange={()=>{}} onConfirm={confirm} initialAmount={100}
    creditInfo={{id:'fixture',customerId:'fixture-customer',customerName:'Cliente',principal:100,interestRate:0,termMonths:1,remainingBalance:100}}/>)
  fireEvent.click(screen.getByRole('button',{name:'Confirmar Pago'}))
  expect(await screen.findByText(text => text.replace(/\s/g,'') === formatCurrency(60).replace(/\s/g,''))).toBeVisible()
  expect(screen.getByText('COL-FIXTURE')).toBeVisible()
  expect(screen.getByText(/TRX-RECUPERADA/)).toBeVisible()
  expect(screen.getByText('Pago original')).toBeVisible()
 })
})

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { awardCreditInstallmentLoyaltyPoints } from './credit-points'
describe('persisted credit payment loyalty',()=>{
 it('keeps a payment key stable if another payment changes the installment balance',async()=>{
  let amountPaid=100
  const rpc=vi.fn().mockResolvedValue({data:{points:1},error:null})
  const client={rpc,from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{amount_paid:amountPaid,customer_credits:{customer_id:'fixture-customer',organization_id:'fixture-org'}},error:null})})})})}
  const input={organizationId:'fixture-org',installmentId:'fixture-installment',paidAmount:100,paymentId:'fixture-payment'}
  await awardCreditInstallmentLoyaltyPoints(client,input)
  amountPaid=200
  await awardCreditInstallmentLoyaltyPoints(client,input)
  expect(rpc.mock.calls.map(call=>call[1].p_idempotency_key)).toEqual(['credit-payment:fixture-payment','credit-payment:fixture-payment'])
 })
})

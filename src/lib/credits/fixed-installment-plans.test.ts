import { CreditPlanFormSchema } from './plan-definition'
import { productSchema as apiProductSchema } from '@/lib/validation/schemas'
import { creditPlanOptions, creditPosPolicyViolation, DEFAULT_CREDIT_POS_POLICY } from './pos-credit-policy'
import { describe, expect, it } from 'vitest'
import { CreditPlanDefinitionSchema, resolveConfiguredCreditPlan, fixedProductPlanErrors } from './plan-definition'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { ProductCreditDefaultsSchema } from '@/lib/validation/website-settings'
import { toProductInstallmentPlans } from './product-credit-defaults'

const fixed = { count: 6, rate: 0, mode: 'amount' as const, installmentAmount: 200000 }
describe('configured fixed installment amounts', () => {
  it('preserves a fixed amount in settings and when copied to a product', () => {
    const defaults = { ...getWebsiteSettingsDefaults().product_credit_defaults!, plans: [fixed] }
    const saved = ProductCreditDefaultsSchema.parse(defaults)
    expect(saved.plans[0]).toEqual(fixed)
    expect(toProductInstallmentPlans(saved)[0]).toEqual(fixed)
  })
  it('keeps six payments of 200000 when the financed price changes', () => {
    for (const principal of [1000000, 1100000]) {
      const resolved = resolveConfiguredCreditPlan(principal, fixed)
      expect(resolved.error).toBeNull()
      expect(resolved.plan?.installments.map(row => row.amount)).toEqual(Array(6).fill(200000))
      expect(resolved.plan?.financedTotal).toBe(1200000)
    }
  })
  it('rejects a fixed plan that does not cover the product or exceeds the hard interest limit', () => {
    expect(resolveConfiguredCreditPlan(1300000, fixed).error).toMatch(/no cubren/i)
    expect(resolveConfiguredCreditPlan(500000, fixed).error).toMatch(/supera/i)
    expect(fixedProductPlanErrors({ sale_price: 1300000, installments_enabled: true, installments_plans: [fixed] })).toHaveLength(1)
  })
  it('does not silently round a fixed guarani amount or allow missing or invalid amounts', () => {
    expect(resolveConfiguredCreditPlan(1000000, { ...fixed, installmentAmount: 200000.5 }).error).toBeTruthy()
    expect(CreditPlanDefinitionSchema.safeParse({ ...fixed, installmentAmount: undefined }).success).toBe(false)
    expect(CreditPlanDefinitionSchema.safeParse({ ...fixed, installmentAmount: Number.NaN }).success).toBe(false)
  })
  it('keeps legacy percentage plans compatible', () => {
    expect(CreditPlanDefinitionSchema.parse({ count: 6, rate: 20 })).toEqual({ count: 6, rate: 20 })
    expect(resolveConfiguredCreditPlan(1000000, { count: 6, rate: 20 }).plan?.financedTotal).toBe(1200000)
  })
})

 it('requires the exact configured fixed schedule under fixed-only policy', () => {
 const plans = creditPlanOptions({products:[],defaults:{plans:[{count:6,rate:0,mode:'amount',installmentAmount:200000}]}})
 const policy={...DEFAULT_CREDIT_POS_POLICY,allowCustomTerms:false}
 const terms={installmentCount:6,interestRate:20,frequency:'monthly' as const,mode:'installment_amount' as const,downPaymentPercent:0,installmentAmounts:Array(6).fill(200000)}
 expect(creditPosPolicyViolation(policy,terms,plans)).toBeNull()
 expect(creditPosPolicyViolation(policy,{...terms,installmentAmounts:Array(6).fill(210000)},plans)).toBeTruthy()
 expect(creditPosPolicyViolation(policy,{...terms,mode:'percent',interestRate:0},plans)).toBeTruthy()
 expect(creditPosPolicyViolation({...policy,allowInstallmentAmounts:false},terms,plans)).toBeTruthy()
 })

it('preserves grouped amounts in the product form and rejects underfunded API products', () => {
 expect(CreditPlanFormSchema.parse({...fixed,installmentAmount:'200.000'}).installmentAmount).toBe(200000)
 const base={name:'Moto prueba',sku:'MOTO-TEST',category_id:'00000000-0000-4000-8000-000000000001',sale_price:1000000,purchase_price:500000,stock_quantity:1,min_stock:0,installments_enabled:true,installments_plans:[fixed]}
 expect(apiProductSchema.parse(base).installments_plans).toEqual([fixed])
 expect(apiProductSchema.safeParse({...base,sale_price:1300000}).success).toBe(false)
})

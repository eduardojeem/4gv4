import { describe, expect, it, vi } from 'vitest'
vi.mock('../../mobile/src/lib/api',()=>({apiFetch:vi.fn()}))
import { assertExpensePage, parseFinanceAmount } from '../../mobile/src/lib/finance-admin'
import { financeSummaryCsv } from '../../mobile/src/lib/finance-csv'
import type { FinanceSummaryData } from '../../mobile/src/lib/admin'
import type { FinanceScope } from '../../mobile/src/lib/finance-admin'
const page=()=>({obligations:[{id:'expense',branch_id:'branch',concept:'Alquiler',amount:100,paid_amount:30,outstanding_amount:70,accounting_date:'2026-11-11',due_date:null,status:'partially_paid',currency:'USD'}],pagination:{page:1,totalItems:1,totalPages:1}})
describe('native finance data boundaries',()=>{
 it('accepts partial payments and rejects inconsistent or missing amounts',()=>{
  expect(()=>assertExpensePage(page())).not.toThrow()
  const bad=page();bad.obligations[0].outstanding_amount=80;expect(()=>assertExpensePage(bad)).toThrow()
  const missing=page();missing.obligations[0].paid_amount=null as never;expect(()=>assertExpensePage(missing)).toThrow()
 })
 it('requires a currency and unambiguous entered amounts',()=>{
  const bad=page();bad.obligations[0].currency='';expect(()=>assertExpensePage(bad)).toThrow()
  expect(parseFinanceAmount('1500,50')).toBe(1500.5)
  // Con separador de miles, como se escribe en guaraníes.
  expect(parseFinanceAmount('1.500.000')).toBe(1500000)
  expect(parseFinanceAmount('150.000')).toBe(150000)
  expect(parseFinanceAmount('1.500.000,50')).toBe(1500000.5)
  expect(parseFinanceAmount('1,500,000.50')).toBe(1500000.5)
  expect(parseFinanceAmount('1500.5')).toBe(1500.5)
  expect(parseFinanceAmount(' 25 000 ')).toBe(25000)
  for(const value of ['-1','0','NaN','1e4','1.50.0','15.0000','1.500,500','1,5.0','','1234567890123'])expect(()=>parseFinanceAmount(value)).toThrow()
 })
 it('exports actual values, preserves decimals and marks unavailable balances',()=>{
  const data={accrued:{revenue:100.25,directCosts:0,grossProfit:null,operatingExpenses:0,payrollCost:0,netProfit:null},cash:{collected:50.25,paid:0,netCashFlow:50.25},overdue:[],upcomingDue:[]} as unknown as FinanceSummaryData
  const scope={organizationId:'=FORMULA',branchId:null,startDate:'2026-11-01',endDate:'2026-11-11',currency:'USD'} as FinanceScope
  const csv=financeSummaryCsv(data,scope)
  expect(csv).toContain('100.25');expect(csv).toContain('No disponible: faltan datos');expect(csv).toContain('No disponible');expect(csv).toContain("'=FORMULA")
 })
})

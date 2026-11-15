import { describe, expect, it } from 'vitest'
import { assertFinanceReportPage } from '@/lib/finance/server'
import { isEmptyFinanceSummary, financePeriodDates } from '../../mobile/src/lib/finance-model'
import { assertFinanceSummaryIntegrity, validateFinanceDates } from '@/lib/finance/summary-integrity'
const empty=()=>({complete:true,coverageWarnings:[],accrued:{revenue:0,directCosts:0,grossProfit:0,operatingExpenses:0,payrollCost:0,netProfit:0},cash:{collected:0,paid:0,netCashFlow:0},overdue:[],upcomingDue:[]})
describe('finance integrity across web and mobile',()=>{
 it('rejects a silently truncated source instead of reporting a partial total',()=>{
  expect(()=>assertFinanceReportPage({returnedRows:1000,totalRows:1500,source:'cuotas'})).toThrow()
  expect(()=>assertFinanceReportPage({returnedRows:1500,totalRows:1500,source:'cuotas'})).not.toThrow()
 })
 it('keeps existing receivables visible in a period without movements',()=>{
  expect(isEmptyFinanceSummary({...empty(),receivables:{total:500000,overdue:100000,credits:500000,repairs:0,customers:2}})).toBe(false)
 })
 it('does not present unavailable receivables as an empty business',()=>{
  expect(isEmptyFinanceSummary({...empty(),receivablesStatus:'unavailable'} as never)).toBe(false)
 })
 it('accepts a verified zero and rejects NaN or inconsistent cash totals',()=>{
  expect(()=>assertFinanceSummaryIntegrity(empty())).not.toThrow()
  const bad=empty();bad.cash.collected=NaN;expect(()=>assertFinanceSummaryIntegrity(bad)).toThrow()
  const mismatch=empty();mismatch.cash.collected=100;expect(()=>assertFinanceSummaryIntegrity(mismatch)).toThrow()
 })
 it('rejects an exact profit that does not match its components',()=>{
  const bad=empty();bad.accrued.netProfit=200;expect(()=>assertFinanceSummaryIntegrity(bad)).toThrow()
 })
 it('allows missing costs with an unknown profit, without inventing an exact result',()=>{
  const value={...empty(),complete:false,accrued:{revenue:100,directCosts:0,grossProfit:null,operatingExpenses:0,payrollCost:0,netProfit:null}}
  expect(()=>assertFinanceSummaryIntegrity(value)).not.toThrow()
 })
 it('rejects impossible dates and reversed periods',()=>{
  expect(()=>validateFinanceDates({startDate:'2026-02-30',endDate:'2026-03-01'})).toThrow()
  expect(()=>validateFinanceDates({startDate:'2026-11-11',endDate:'2026-11-10'})).toThrow()
 })
 it('supports the previous month and a business week starting Monday',()=>{
  const now=new Date('2026-11-11T15:00:00Z')
  expect(financePeriodDates('previousMonth','America/Asuncion',now)).toEqual({startDate:'2026-10-01',endDate:'2026-10-31'})
  expect(financePeriodDates('week','America/Asuncion',now)).toEqual({startDate:'2026-11-09',endDate:'2026-11-11'})
 })
})
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const source = readFileSync('src/app/dashboard/page.tsx', 'utf8')
describe('home dashboard cash and unavailable data contract', () => {
 it('uses the shared physical cash calculation', () => {
  expect(source).toContain('calculateExpectedCashBalance(currentSession.movements)')
  expect(source).toContain('isPhysicalCashSale')
  expect(source).not.toContain(' Gs.')
 })
 it('rejects database failures and shows an explicit retry instead of KPI zeroes', () => {
  expect(source).toContain('fetchDashboardHomeSummary')
  expect(source).not.toContain(".from('sales')")
  expect(source).toContain('role="alert"')
  expect(source).toContain('Reintentar')
  expect(source).not.toContain('En vivo')
 })
})

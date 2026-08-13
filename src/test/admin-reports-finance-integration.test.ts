import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const analyticsHook = readFileSync(
  resolve(process.cwd(), 'src/hooks/use-admin-analytics.ts'),
  'utf8',
)
const reportsDashboard = readFileSync(
  resolve(process.cwd(), 'src/components/admin/reports/analytics-dashboard.tsx'),
  'utf8',
)
const financeMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260811190000_create_finance_foundation.sql'),
  'utf8',
).toLowerCase()

describe('admin reports financial integration', () => {
  it('gets report financial cards from the canonical finance summary', () => {
    expect(analyticsHook).toContain('/api/admin/finances/summary')
    expect(analyticsHook).toContain('fetchFinanceSummary')
    expect(analyticsHook).not.toContain('currentGrossRevenue - visibleExpenses')
    expect(analyticsHook).not.toContain('withdrawals\n      const visibleExpenses')
  })

  it('keeps incomplete coverage visible in reports', () => {
    expect(reportsDashboard).toContain('Resultado financiero incompleto')
    expect(reportsDashboard).toContain('coverageWarnings')
  })

  it('schedules only the idempotent global recurrence generator once per day', () => {
    expect(financeMigration).toContain("cron.unschedule('finance-recurring-obligations-daily')")
    expect(financeMigration).toContain("cron.schedule(\n      'finance-recurring-obligations-daily',\n      '0 2 * * *',\n      'select public.generate_all_recurring_finance_obligations(current_date)'\n    )")
    expect(financeMigration).not.toContain('cron.schedule(\n      \'finance-recurring-obligations-daily\',\n      \'0 2 * * *\',\n      \'select public.generate_recurring_finance_obligations')
  })
})

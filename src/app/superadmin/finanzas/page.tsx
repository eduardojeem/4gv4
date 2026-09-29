import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { listPlatformExpenses, loadPlatformRevenue } from '@/lib/superadmin/platform-expenses'
import { summarizePlatformFinance, todayInParaguay } from '@/lib/superadmin/platform-finance'
import { PlatformFinanceCenter } from '@/components/superadmin/finance/PlatformFinanceCenter'

export const metadata: Metadata = {
  title: 'Gastos y rentabilidad | Superadmin',
}

export const dynamic = 'force-dynamic'

export default async function PlatformFinancePage() {
  await requireSuperAdmin()

  const [expensesResult, revenue] = await Promise.all([listPlatformExpenses(), loadPlatformRevenue()])
  const expenses = 'expenses' in expensesResult ? expensesResult.expenses : []
  const today = todayInParaguay()

  return (
    <PlatformFinanceCenter
      expenses={expenses}
      summary={summarizePlatformFinance(expenses, revenue, today)}
      activeOrgs={revenue.activeOrgs}
      today={today}
      unavailableReason={'reason' in expensesResult ? expensesResult.reason : null}
    />
  )
}

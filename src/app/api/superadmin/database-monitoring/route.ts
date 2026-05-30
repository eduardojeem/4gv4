import { NextResponse } from 'next/server'
import { withSuperAdminAuth } from '@/lib/api/withAdminAuth'
import { collectDatabaseMonitoringSnapshot } from '@/lib/superadmin/database-monitoring/collector'

export const dynamic = 'force-dynamic'

export const GET = withSuperAdminAuth(async () => {
  const snapshot = await collectDatabaseMonitoringSnapshot()

  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
})

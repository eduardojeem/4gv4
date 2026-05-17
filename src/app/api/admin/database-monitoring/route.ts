import { NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { collectDatabaseMonitoringSnapshot } from '@/lib/admin/database-monitoring/collector'

export const dynamic = 'force-dynamic'

export const GET = withAdminAuth(async () => {
  const snapshot = await collectDatabaseMonitoringSnapshot()

  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
})

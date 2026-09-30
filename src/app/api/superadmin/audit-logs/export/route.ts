import { NextResponse, type NextRequest } from 'next/server'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { AUDIT_EXPORT_LIMIT, getAuditExport, parseAuditFilters, toCsv } from '@/lib/superadmin/audit-feed'

/** CSV con los mismos filtros de /superadmin/audit-logs (todas las páginas, hasta 5000 filas). */
export async function GET(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const filters = parseAuditFilters(Object.fromEntries(request.nextUrl.searchParams))
  try {
    const { entries, truncated } = await getAuditExport({ ...filters, page: 0 })
    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'data_export',
      resource: 'audit_log',
      newValues: { source: filters.source, period: filters.period, rows: entries.length, truncated },
      request,
    })
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(`﻿${toCsv(entries)}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="auditoria-${filters.source}-${date}.csv"`,
        'X-Export-Truncated': truncated ? `limit-${AUDIT_EXPORT_LIMIT}` : 'no',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo exportar' }, { status: 500 })
  }
}

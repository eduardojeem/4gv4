import { NextResponse } from 'next/server'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { getSuperAdminAnalytics } from '@/lib/superadmin/analytics'

export async function GET() {
  const user = await getSuperAdminUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const analytics = await getSuperAdminAnalytics()
    return NextResponse.json(analytics)
  } catch {
    return NextResponse.json({ error: 'Error al cargar analytics' }, { status: 500 })
  }
}

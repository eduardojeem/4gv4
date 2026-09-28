import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { SEVERITY_RULES } from '@/lib/health/core'
import { readHistory } from '@/lib/health/history'
import { SystemHealthDashboard } from '@/components/superadmin/system-health/SystemHealthDashboard'

export const metadata: Metadata = {
  title: 'Salud del sistema | Superadmin',
  description: 'Centro de diagnóstico de seguridad, configuración y rendimiento de la plataforma.',
}

export const dynamic = 'force-dynamic'

export default async function SystemHealthPage() {
  // El layout ya lo valida; se repite aquí para que la página nunca dependa
  // solo del layout (y del menú) para su protección.
  await requireSuperAdmin()

  const initialHistory = await readHistory(createAdminSupabase(), { limit: 200 })

  return <SystemHealthDashboard initialHistory={initialHistory} severityRules={SEVERITY_RULES} />
}

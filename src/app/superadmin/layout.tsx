import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SuperAdminShell } from '@/components/superadmin/superadmin-shell'
import { SupportSessionBanner } from '@/components/superadmin/SupportSessionBanner'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { getActiveSupportSession } from '@/lib/superadmin/support-session'

export const metadata: Metadata = {
  title: 'Super Admin | Plataforma SaaS',
  description: 'Panel global de administracion SaaS multiempresa.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin()

  if (!user) {
    redirect('/dashboard')
  }

  const supportSession = await getActiveSupportSession()

  return (
    <>
      {supportSession && <SupportSessionBanner session={supportSession} />}
      <SuperAdminShell userEmail={user.email}>
        {children}
      </SuperAdminShell>
    </>
  )
}

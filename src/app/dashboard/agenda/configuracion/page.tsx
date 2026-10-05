import type { Metadata } from 'next'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'
import { AgendaSettingsPanel } from '@/components/dashboard/agenda/AgendaSettingsPanel'

export const metadata: Metadata = { title: 'Configurar agenda | Dashboard' }

export default function AgendaSettingsPage() {
  return (
    <OrganizationModuleGate module="services" title="Agenda no incluida" description="Turnos por profesional, reservas online y recordatorios por WhatsApp.">
      <AgendaSettingsPanel />
    </OrganizationModuleGate>
  )
}

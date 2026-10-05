import type { Metadata } from 'next'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'
import { AgendaBoard } from '@/components/dashboard/agenda/AgendaBoard'

export const metadata: Metadata = { title: 'Agenda | Dashboard' }

export default function AgendaPage() {
  return (
    <OrganizationModuleGate module="services" title="Agenda no incluida" description="Turnos por profesional, reservas online y recordatorios por WhatsApp.">
      <AgendaBoard />
    </OrganizationModuleGate>
  )
}

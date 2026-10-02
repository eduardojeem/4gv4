import type { Metadata } from 'next'
import { PlanGate } from '@/components/admin/PlanGate'
import { AgendaSettingsPanel } from '@/components/dashboard/agenda/AgendaSettingsPanel'

export const metadata: Metadata = { title: 'Configurar agenda | Dashboard' }

export default function AgendaSettingsPage() {
  return (
    <PlanGate module="services" title="Agenda no incluida" description="Turnos por profesional, reservas online y recordatorios por WhatsApp.">
      <AgendaSettingsPanel />
    </PlanGate>
  )
}

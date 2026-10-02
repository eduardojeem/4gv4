import type { Metadata } from 'next'
import { PlanGate } from '@/components/admin/PlanGate'
import { AgendaBoard } from '@/components/dashboard/agenda/AgendaBoard'

export const metadata: Metadata = { title: 'Agenda | Dashboard' }

export default function AgendaPage() {
  return (
    <PlanGate module="services" title="Agenda no incluida" description="Turnos por profesional, reservas online y recordatorios por WhatsApp.">
      <AgendaBoard />
    </PlanGate>
  )
}

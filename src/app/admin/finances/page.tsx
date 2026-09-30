import { FinancesSystem } from '@/components/admin/finances/FinancesSystem'
import { PlanGate } from '@/components/admin/PlanGate'

export default function FinancesPage() {
  return (
    <PlanGate
      module="finances"
      title="Finanzas"
      description="Gastos, nómina y rentabilidad: lo que entró, lo que salió y lo que queda."
    >
      <FinancesSystem />
    </PlanGate>
  )
}

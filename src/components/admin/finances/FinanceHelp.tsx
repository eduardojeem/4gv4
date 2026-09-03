'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const topics = [
  { title: 'Resultado del negocio y dinero cobrado', text: 'Una venta a crédito de Gs. 1.000.000 con un cobro inicial de Gs. 200.000 aporta Gs. 1.000.000 de ingresos de venta y Gs. 200.000 de cobros. El costo del producto se descuenta al calcular la ganancia, no al calcular el cobro.', note: 'El flujo es el dinero cobrado menos el pagado en el período. No es el saldo disponible de una caja o cuenta bancaria.' },
  { title: 'Gastos y pagos parciales', text: 'Registrar un gasto no significa pagarlo. Si registrás un alquiler de Gs. 500.000 y pagás Gs. 200.000, quedan Gs. 300.000 pendientes.', note: 'La fecha contable determina cuándo el gasto afecta al resultado; la fecha de pago determina cuándo afecta al flujo. Los vencimientos muestran saldos actuales, incluso de meses anteriores.' },
  { title: 'Sueldos y comisiones', text: 'Primero configurá el sueldo y las reglas del personal. Prepará la nómina, revisá los importes, aprobala y registrá los pagos. Aprobar no significa pagar.', note: 'Ejemplo: sueldo de Gs. 2.000.000 más Gs. 150.000 de comisiones da Gs. 2.150.000 antes de otros ajustes. Un pago de Gs. 1.000.000 deja Gs. 1.150.000 pendientes.' },
  { title: 'Cómo se calcula la ganancia', text: 'Ingresos de Gs. 1.000.000 − costos directos de Gs. 600.000 = ganancia bruta de Gs. 400.000. Si gastos y nómina suman Gs. 250.000, el resultado neto es Gs. 150.000.', note: 'Se consideran los registros incluidos por el sistema. Si faltan costos, el resultado no es definitivo. Esta vista de gestión no reemplaza una liquidación tributaria.' },
  { title: 'Sucursal, período y actualización', text: 'Elegí una sucursal para operar sobre ella, o la vista consolidada para consultar la organización. Seleccioná el período y usá Actualizar para consultar nuevamente los datos.', note: 'Los indicadores corresponden al período seleccionado. La lista de obligaciones pendientes usa el saldo actual; registrar pagos requiere los permisos y la caja abierta que correspondan.' },
]

export function FinanceHelp() {
  const [open, setOpen] = useState(false)
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2"><HelpCircle className="h-4 w-4" />Cómo funciona</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle>Cómo funciona Finanzas</DialogTitle>
          <DialogDescription>Ejemplos ilustrativos en guaraníes. No modifican tus registros.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
          {topics.map((topic) => <section key={topic.title} className="rounded-lg border p-4">
            <h3 className="mb-2 text-sm font-semibold">{topic.title}</h3>
            <p className="text-sm">{topic.text}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{topic.note}</p>
          </section>)}
        </div>
        <div className="shrink-0 border-t pt-3"><Button onClick={() => setOpen(false)} className="w-full sm:w-auto">Entendido</Button></div>
      </DialogContent>
    </Dialog>
  </>
}

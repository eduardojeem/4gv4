import { ChevronDown, Lightbulb } from 'lucide-react'

const guides = {
  Resumen: {
    purpose: 'Conocé el resultado del negocio y los compromisos que requieren atención.',
    steps: ['Elegí sucursal y período para consultar los indicadores.', 'Compará el resultado devengado con los cobros y pagos registrados.', 'Abrí los vencimientos o revisá los costos faltantes desde sus accesos.'],
    example: 'Vendés a crédito por Gs. 1.000.000 y cobrás Gs. 200.000: el ingreso de venta es Gs. 1.000.000, pero el cobro es Gs. 200.000. Para calcular la ganancia también se descuentan costos, gastos y nómina.',
    note: 'El flujo no es el saldo disponible de caja o banco. Los vencimientos muestran saldos actuales, incluso de períodos anteriores.',
  },
  Gastos: {
    purpose: 'Registrá lo que el negocio debe pagar y controlá sus abonos y vencimientos.',
    steps: ['Seleccioná una sucursal y usá Nuevo gasto: completá concepto, importe, categoría y fechas.', 'Buscá por concepto o proveedor; usá los filtros para encontrar la obligación.', 'Elegí Pagar para registrar un abono o el total. En efectivo, seleccioná una caja abierta.'],
    example: 'Registrás un alquiler de Gs. 500.000 y abonás Gs. 200.000. El importe original sigue siendo Gs. 500.000 y el pendiente baja a Gs. 300.000.',
    note: 'Registrar no significa pagar. La fecha contable afecta al resultado; la fecha del pago afecta al flujo. Repetir este gasto permite configurar obligaciones recurrentes.',
  },
  Nómina: {
    purpose: 'Prepará y pagá sueldos y comisiones del personal, con revisión previa.',
    steps: ['Configurá sueldos y reglas en Configuración.', 'Usá Preparar nómina y revisá la vista previa del período y su alcance.', 'Aprobá los importes revisados, registrá los pagos y verificá los saldos restantes.'],
    example: 'Un sueldo de Gs. 2.000.000 más comisiones de Gs. 150.000 suma Gs. 2.150.000 antes de otros ajustes. Si pagás Gs. 1.000.000, quedan Gs. 1.150.000 pendientes.',
    note: 'Aprobar no significa pagar. El importe real depende del período, las reglas vigentes y los ajustes. Verificar saldos no crea un cierre contable.',
  },
  Rentabilidad: {
    purpose: 'Identificá qué operaciones generan margen y cuáles necesitan revisión de costos.',
    steps: ['Elegí el período y cómo agrupar la información.', 'Buscá una operación o filtrá por cobertura de costos.', 'Abrí su detalle para revisar ingresos y costos; exportá la consulta si necesitás analizarla fuera del sistema.'],
    example: 'Una venta de Gs. 250.000 con un costo directo de Gs. 150.000 deja Gs. 100.000 de ganancia bruta: un margen del 40% sobre la venta.',
    note: 'La ganancia bruta todavía no descuenta gastos generales ni nómina. Las filas sin costo no permiten calcular un margen definitivo; revisá las advertencias de cobertura.',
  },
  Configuración: {
    purpose: 'Definí la remuneración base del personal y las reglas para calcular comisiones.',
    steps: ['En Personal y Sueldos Base, asigná o modificá el sueldo y su vigencia.', 'En Reglas de Comisión, elegí alcance, origen, tipo de cálculo, valor y fechas.', 'Revisá y aprobá la regla para utilizarla; retirala cuando deje de corresponder, conservando su historial.'],
    example: 'Si una regla establece una comisión del 5% y la base aplicable de una operación es Gs. 1.000.000, la comisión es Gs. 50.000. El sueldo base se configura por separado.',
    note: 'Crear una regla no paga al empleado. Verificá la base de cálculo, vigencia y alcance antes de aprobarla; no asumas que modifica liquidaciones históricas ya aprobadas.',
  },
} as const

export function FinanceSectionHelp({ section }: { section: keyof typeof guides }) {
  const guide = guides[section]
  return (
    <details className="group rounded-lg border border-primary/20 bg-primary/5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <Lightbulb className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="flex-1">Cómo funciona esta sección: {section}</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-3 border-t border-primary/10 p-4 text-sm">
        <p>{guide.purpose}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <ol className="list-decimal space-y-2 pl-5">{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          <div className="rounded-lg border bg-background p-3">
            <h3 className="mb-2 font-semibold">Ejemplo en guaraníes</h3>
            <p className="leading-relaxed">{guide.example}</p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{guide.note} Ejemplo ilustrativo: no modifica tus registros.</p>
      </div>
    </details>
  )
}

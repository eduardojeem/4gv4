export function FinanceWorkflowHelp() {
  return <details className="rounded-xl border bg-card p-4 text-sm">
    <summary className="min-h-11 cursor-pointer font-medium focus-visible:ring-2 focus-visible:ring-ring">Cómo usar Finanzas en tu negocio</summary>
    <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
      <p><strong className="text-foreground">Resultado y dinero disponible no son lo mismo.</strong> El resultado económico mide ingresos y costos registrados. Cobrado menos pagado muestra movimientos del período, no el saldo disponible de caja o banco. Los vencimientos muestran deudas actuales, incluso de períodos anteriores.</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Elegí período y sucursal; revisá vencimientos y costos incompletos en Resumen.</li>
        <li>Registrá alquiler, insumos, proveedores y otros compromisos en Gastos.</li>
        <li>En Nómina: prepará, revisá, aprobá y después registrá los pagos realizados.</li>
        <li>Compará ingresos y costos en Rentabilidad. Un costo desconocido no equivale a cero.</li>
      </ol>
      <p className="rounded-lg bg-muted p-3"><strong className="text-foreground">Comercios, barberías, servicios, reservas y talleres:</strong> el flujo de gastos y pagos del equipo es común. La cobertura de ingresos y comisiones depende de las operaciones integradas: una reserva o un turno no constituye por sí solo un cobro ni genera automáticamente una comisión en Nómina.</p>
      <p>Registrar una transferencia no envía dinero al banco. Verificá el pago realizado y su comprobante. Para efectivo, elegí la caja abierta correspondiente.</p>
    </div>
  </details>
}

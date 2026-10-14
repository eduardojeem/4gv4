const explanations = {
  economic: {
    title: 'Qué es el resultado económico',
    description: 'Es la ganancia o pérdida de las operaciones registradas: ingresos menos costos directos, gastos y nómina. No indica cuánto dinero tenés disponible.',
    example: 'Ejemplo ilustrativo: ingresos de Gs. 100.000, costos de Gs. 40.000 y gastos y nómina de Gs. 20.000 dejan un resultado de Gs. 40.000, aunque parte de los ingresos todavía no se haya cobrado.',
  },
  cash: {
    title: 'Qué significa cobrado menos pagado',
    description: 'Es lo que entró menos los pagos netos registrados en el período. Puede incluir cobros o pagos de operaciones de meses anteriores. No incluye por sí solo el saldo inicial de caja o banco.',
    example: 'Ejemplo ilustrativo: cobraste Gs. 100.000 y pagaste Gs. 70.000: el flujo es Gs. 30.000. Eso no significa que tu banco tenga Gs. 30.000. Las anulaciones reducen los pagos netos y pueden volverlos negativos.',
  },
  accrued: {
    title: 'Qué significa devengado',
    description: 'Corresponde a operaciones reconocidas en el período, aunque su cobro o pago ocurra después. Esta vista mide el resultado de la actividad; la pestaña Caja muestra los movimientos de dinero registrados.',
    example: 'Ejemplo ilustrativo: una venta reconocida a crédito de Gs. 100.000 aparece como ingreso devengado. Si todavía no se cobró, no es Gs. 100.000 de dinero disponible.',
  },
} as const

export function FinanceMetricExplanation({ kind }: { kind: keyof typeof explanations }) {
  const explanation = explanations[kind]
  return <details className="group mt-3 overflow-hidden rounded-lg border-2 border-primary/30 bg-primary/5 text-sm open:border-primary/60">
    <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-3 font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-background text-xs">?</span>
        {explanation.title}
      </span>
      <span className="flex items-center gap-2 text-xs">
        <span className="group-open:hidden">Ver explicación</span>
        <span className="hidden group-open:inline">Ocultar explicación</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </span>
    </summary>
    <div className="space-y-2 border-t border-primary/20 bg-card p-3 leading-relaxed text-muted-foreground">
      <p>{explanation.description}</p>
      <p className="rounded-md bg-muted p-2">{explanation.example}</p>
      <p className="text-xs">Se aplica al período y sucursal seleccionados. Revisá los avisos de datos faltantes antes de interpretar los importes como definitivos.</p>
    </div>
  </details>
}

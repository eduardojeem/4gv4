/** Shared, read-only guidance for technician terms and their payroll consumer. */
export function TechnicianPaymentHelp() {
  return (
    <details className="rounded-xl border bg-card p-4 text-sm">
      <summary className="min-h-11 cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Cómo funciona la remuneración y los pagos de técnicos
      </summary>
      <div className="mt-3 space-y-4 leading-relaxed text-muted-foreground">
        <section>
          <h3 className="font-medium text-foreground">1. Configurá las condiciones en el perfil del técnico</h3>
          <p>En Compensación → Editar podés combinar sueldo mensual, porcentaje de comisión y un monto fijo por reparación. Elegí si el porcentaje se calcula sobre mano de obra o total, y si se genera al quedar Listo o Entregado.</p>
          <p className="mt-2">La fecha de vigencia indica desde cuándo aplican las condiciones; no reescribe versiones anteriores. La fecha de inicio del sueldo permite prorratear el primer mes. Una nueva versión necesita una fecha posterior a la anterior; las reglas usadas en una nómina aprobada requieren fecha futura.</p>
        </section>
        <section>
          <h3 className="font-medium text-foreground">2. Consultá el período en Pagos</h3>
          <p>Generado estimado es un cálculo orientativo, no una liquidación aprobada. Liquidado en Nómina corresponde a importes aprobados. Pagado cuenta desembolsos registrados; un pago pendiente no cuenta como pagado.</p>
          <p className="mt-2">El pendiente estimado no equivale a una deuda liquidada. Revisá las advertencias cuando haya pagos históricos sin sucursal o información incompleta.</p>
        </section>
        <section>
          <h3 className="font-medium text-foreground">3. Liquidá y registrá el pago</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Si tu organización tiene Finanzas, entrá a Finanzas → Nómina y seleccioná el período y la sucursal o toda la organización.</li>
            <li>Prepará la nómina, revisá salarios y comisiones y aprobá los importes correctos.</li>
            <li>Registrá el pago desde esa liquidación. Preparar o aprobar no mueve dinero por sí solo.</li>
          </ol>
          <p className="mt-2">Sin Finanzas, el perfil conserva el registro de pago básico para usuarios autorizados. Los pagos en efectivo necesitan una caja abierta de la sucursal.</p>
        </section>
        <section className="rounded-lg bg-muted p-3">
          <h3 className="font-medium text-foreground">Si aparece un conflicto o un pago anterior</h3>
          <p>Revisá el historial básico y la liquidación antes de volver a pagar. Un período con pagos anteriores sin reconciliar se bloquea para evitar duplicaciones. No borres el historial ni registres otro pago para saltar el aviso; pedí revisión al administrador.</p>
          <p className="mt-2">Si una solicitud pierde conexión, usá Reintentar misma solicitud cuando esté disponible: conserva su clave para evitar duplicar el pago.</p>
        </section>
      </div>
    </details>
  )
}

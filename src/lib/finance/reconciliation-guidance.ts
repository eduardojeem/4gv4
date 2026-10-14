/** Read-only instructions; never proposes creating money movements to hide a discrepancy. */
export function reconciliationGuidance(code: string): string {
  switch (code) {
    case 'MISSING_DIRECT_COST':
      return 'Revisá el registro de origen y su costo histórico en Rentabilidad. No reemplaces el costo de una operación pasada por el precio actual.'
    case 'MISSING_CASH_TIMING':
      return 'Compará el pedido, venta o reparación con sus comprobantes y cobros fechados. No registres otro cobro si el dinero ya fue recibido; primero verificá el vínculo y la fecha.'
    case 'MISSING_BRANCH':
      return 'Verificá a qué sucursal pertenece el movimiento original. No lo asignes por suposición ni lo cuentes en todas las sucursales.'
    case 'MISSING_EMPLOYEE':
      return 'Revisá el colaborador y la liquidación de origen en Nómina. Conservá el historial y evitá generar un segundo pago.'
    default:
      return 'Compará el registro de origen con sus comprobantes y pedí una revisión al administrador antes de cambiar importes.'
  }
}

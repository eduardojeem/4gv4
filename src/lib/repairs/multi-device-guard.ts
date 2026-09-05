/**
 * Qué datos impiden cargar un segundo equipo en la misma orden.
 *
 * Repuestos, notas, mano de obra, costo final y adelanto pertenecen a *una*
 * orden. Con varios equipos no habría forma de repartirlos, así que el
 * formulario pide sacarlos antes de agregar otro equipo.
 *
 * La condición estaba escrita dos veces —al agregar el equipo y al guardar— y
 * las dos comprobaban `finalCost !== null`. El problema es que el modo de precio
 * automático, que es el que viene por defecto, escribe `finalCost = 0` apenas se
 * abre el formulario: con la orden todavía en blanco, `0 !== null` ya daba
 * verdadero y el botón «Agregar» quedaba bloqueado desde el primer segundo, sin
 * que nadie hubiera cargado nada.
 *
 * El resto de las condiciones ya miraban `> 0`. Esta es la que faltaba alinear.
 */

export type RepairCostSnapshot = {
  parts?: unknown[] | null
  notes?: unknown[] | null
  laborCost?: number | null
  finalCost?: number | null
  depositAmount?: number | null
}

export function hasSingleDeviceOnlyData(values: RepairCostSnapshot): boolean {
  return (
    (values.parts?.length ?? 0) > 0 ||
    (values.notes?.length ?? 0) > 0 ||
    (values.laborCost ?? 0) > 0 ||
    (values.finalCost ?? 0) > 0 ||
    (values.depositAmount ?? 0) > 0
  )
}

/** Lo que hay cargado, para poder nombrarlo en el aviso. */
export function describeSingleDeviceOnlyData(values: RepairCostSnapshot): string {
  const partes: string[] = []
  if ((values.parts?.length ?? 0) > 0) partes.push('repuestos o servicios')
  if ((values.notes?.length ?? 0) > 0) partes.push('notas')
  if ((values.laborCost ?? 0) > 0) partes.push('mano de obra')
  if ((values.finalCost ?? 0) > 0) partes.push('un costo final')
  if ((values.depositAmount ?? 0) > 0) partes.push('un adelanto')

  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0]
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

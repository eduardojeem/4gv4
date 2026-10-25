/** CSV blank cost is omission; even zero is an explicit write requiring cost permission. */
export function importCostPayload(cost: number | undefined, canUpdateCost: boolean): { purchase_price?: number } {
  if (cost === undefined) return {}
  if (!canUpdateCost) throw new Error('No tenés permiso para importar costos. Quitá el costo de esta fila o solicitá acceso.')
  return { purchase_price: cost }
}

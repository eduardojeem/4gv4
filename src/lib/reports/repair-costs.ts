export interface RepairCostRow {
  final_cost?: number | string | null
  labor_cost?: number | string | null
  parts_cost?: number | string | null
}

export interface RepairCostAverages {
  avgFinal: number
  avgLabor: number
  avgParts: number
  /** Cuantas reparaciones tienen cargado cada monto. */
  finalCount: number
  laborCount: number
  partsCount: number
}

const amount = (value: number | string | null | undefined): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/**
 * Promedios de precio final, mano de obra y repuestos.
 *
 * Cada uno divide por cuantas reparaciones tienen ESE monto cargado, y no por
 * un contador compartido.
 *
 * Antes habia un solo `costedCount` que subia si la reparacion tenia cualquiera
 * de los tres. Una con repuestos cargados pero todavia sin precio final sumaba 0
 * al numerador del promedio de precio y 1 a su denominador: los tres promedios
 * salian por debajo de lo real, y cuanto mas disparejo estaba cargado el taller,
 * peor. Dividir por el total de reparaciones es todavia peor, porque las que
 * estan en diagnostico sin cotizar hunden el promedio.
 */
export function calculateRepairCostAverages(rows: RepairCostRow[]): RepairCostAverages {
  let totalFinal = 0
  let totalLabor = 0
  let totalParts = 0
  let finalCount = 0
  let laborCount = 0
  let partsCount = 0

  for (const row of rows) {
    const final = amount(row.final_cost)
    const labor = amount(row.labor_cost)
    const parts = amount(row.parts_cost)

    if (final > 0) {
      totalFinal += final
      finalCount += 1
    }
    if (labor > 0) {
      totalLabor += labor
      laborCount += 1
    }
    if (parts > 0) {
      totalParts += parts
      partsCount += 1
    }
  }

  return {
    avgFinal: finalCount > 0 ? totalFinal / finalCount : 0,
    avgLabor: laborCount > 0 ? totalLabor / laborCount : 0,
    avgParts: partsCount > 0 ? totalParts / partsCount : 0,
    finalCount,
    laborCount,
    partsCount,
  }
}

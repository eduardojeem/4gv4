/**
 * Arma la lista de marcas y modelos de celular para sugerir.
 *
 * Todo pasa por las mismas normalizaciones que el guardado, así «Sansung A05»
 * en una reparación y «samsung a05» en un producto terminan siendo una sola
 * sugerencia: Samsung · A05. Las marcas van por uso y los modelos en orden de
 * modelo, que es como se los busca.
 */

import {
  deviceModelSortKey,
  normalizeDeviceBrand,
  normalizeDeviceModel,
} from '@/lib/products/device-compatibility'

export type DeviceOptions = {
  /** Marcas, las más usadas primero. */
  brands: string[]
  /** Modelos de cada marca, en orden de modelo: 11, 12, 12 Pro, 12 Pro Max, 13. */
  modelsByBrand: Record<string, string[]>
}

type FilaProducto = { device_brand: string | null; device_models: string[] | null }
type FilaReparacion = { device_brand: string | null; device_model: string | null }

/** Las marcas: primero la que más se trabaja, que es la que se toca siempre. */
function ordenadas(cuentas: Map<string, number>): string[] {
  return [...cuentas.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es', { numeric: true }))
    .map(([valor]) => valor)
}

/**
 * Los modelos, en cambio, van en orden de modelo y no por uso: una lista de
 * treinta iPhone mezclados por cuántos repuestos tiene cada uno no se puede
 * recorrer. Ordenados, el cliente cae directo en el suyo.
 */
function porModelo(cuentas: Map<string, number>): string[] {
  return [...cuentas.keys()].sort(
    (a, b) => deviceModelSortKey(a).localeCompare(deviceModelSortKey(b), 'es') || a.localeCompare(b, 'es')
  )
}

export function buildDeviceOptions({
  productos,
  reparaciones,
}: {
  productos: FilaProducto[]
  reparaciones: FilaReparacion[]
}): DeviceOptions {
  const porMarca = new Map<string, number>()
  const modelosPorMarca = new Map<string, Map<string, number>>()

  const anotar = (marcaCruda: string | null, modeloCrudo: string | null) => {
    const marca = normalizeDeviceBrand(marcaCruda)
    if (!marca) return
    porMarca.set(marca, (porMarca.get(marca) ?? 0) + 1)

    const modelo = normalizeDeviceModel(modeloCrudo)
    if (!modelo) return
    const modelos = modelosPorMarca.get(marca) ?? new Map<string, number>()
    modelos.set(modelo, (modelos.get(modelo) ?? 0) + 1)
    modelosPorMarca.set(marca, modelos)
  }

  for (const fila of productos) {
    const modelos = fila.device_models?.length ? fila.device_models : [null]
    for (const modelo of modelos) anotar(fila.device_brand, modelo)
  }

  for (const fila of reparaciones) anotar(fila.device_brand, fila.device_model)

  const modelsByBrand: Record<string, string[]> = {}
  for (const [marca, modelos] of modelosPorMarca) modelsByBrand[marca] = porModelo(modelos)

  return { brands: ordenadas(porMarca), modelsByBrand }
}

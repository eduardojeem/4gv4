import type { BusinessVertical } from '@/lib/organization/business-profile'
import type { ProductDetails } from './catalog-contract'
export type CatalogField = { key: keyof ProductDetails; label: string; example: string; multiline?: boolean }
const fields: Record<string, CatalogField> = {
  tone: { key: 'tone', label: 'Tono', example: 'Rojo vino, beige claro…' },
  skin_type: { key: 'skin_type', label: 'Tipo de piel', example: 'Mixta, seca, grasa…' },
  volume: { key: 'volume', label: 'Contenido o volumen', example: '50 ml' },
  net_content: { key: 'net_content', label: 'Contenido neto', example: '500 g' },
  presentation: { key: 'presentation', label: 'Presentación', example: 'Frasco, pomo, caja…' },
  line: { key: 'line', label: 'Línea', example: 'Profesional' },
  ingredients: { key: 'ingredients', label: 'Ingredientes o composición', example: 'Transcribí lo indicado en el envase.', multiline: true },
  usage: { key: 'usage', label: 'Modo de uso', example: 'Indicaciones del fabricante.', multiline: true },
  storage: { key: 'storage', label: 'Conservación', example: 'Guardar en un lugar fresco y seco.', multiline: true },
  material: { key: 'material', label: 'Material', example: 'Algodón, acero, PVC…' },
  measure: { key: 'measure', label: 'Medida', example: '6 mm' },
  model: { key: 'model', label: 'Modelo', example: 'Modelo del fabricante' },
  compatibility: { key: 'compatibility', label: 'Compatibilidad', example: 'Dispositivos o modelos compatibles' },
  hair_type: { key: 'hair_type', label: 'Tipo de cabello', example: 'Normal, seco, rizado…' },
  hold: { key: 'hold', label: 'Fijación', example: 'Suave, media, fuerte' },
}
const byVertical: Partial<Record<BusinessVertical, string[]>> = {
  cosmetics: ['line', 'tone', 'skin_type', 'volume', 'presentation', 'ingredients', 'usage', 'storage'],
  food: ['net_content', 'presentation', 'ingredients', 'storage'],
  clothing: ['material', 'usage'], hardware: ['material', 'measure', 'usage'],
  electronics: ['model', 'compatibility', 'usage'],
  barbershop: ['hair_type', 'hold', 'volume', 'usage', 'storage'],
  beauty_services: ['skin_type', 'volume', 'usage', 'storage'],
}
export function catalogFieldsFor(vertical: BusinessVertical): CatalogField[] { return (byVertical[vertical] ?? ['presentation', 'material', 'usage']).map(key => fields[key]) }
export function variantGuideFor(vertical: BusinessVertical) {
  const example: Partial<Record<BusinessVertical, string>> = {
    cosmetics: '2 tonos × 2 presentaciones = 4 variantes.', clothing: '3 talles × 2 colores = 6 variantes.',
    food: '2 contenidos × 2 presentaciones = 4 variantes.', hardware: '3 medidas × 2 materiales = 6 variantes.',
    electronics: '2 capacidades × 2 colores = 4 variantes.', barbershop: '2 fijaciones × 2 contenidos = 4 variantes.',
  }
  return `${example[vertical] ?? '2 tamaños × 2 presentaciones = 4 variantes.'} Usá variantes solo para opciones que vendés por separado. Cada una tiene SKU, precio y stock propios. Las características comunes van en la información básica.`
}
export function catalogDetailRows(details: ProductDetails) {
  return Object.entries(details).flatMap(([key, value]) => {
    if (value === '' || value === undefined) return []
    if (key === 'pao_months') return [{ label: 'Uso después de abrir (PAO)', value: `${value} meses desde la apertura` }]
    if (key === 'expiry_policy') return value === 'not_applicable' ? [{ label: 'Vencimiento', value: 'No corresponde, según lo registrado por el comercio' }] : []
    return [{ label: fields[key]?.label ?? key, value: String(value) }]
  })
}

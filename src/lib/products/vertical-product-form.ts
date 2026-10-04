/**
 * Cómo se arma el formulario de producto según el rubro de la empresa.
 *
 * Antes el formulario era el de una tienda de celulares para todos: «Ej:
 * iPhone 14 Pro» como nombre, garantía «oficial» con plantilla de
 * electrónica, unidades sin «servicio» ni «par», SKU «PROD-…». Una barbería,
 * una ferretería o un almacén veían ejemplos que no eran suyos y campos que no
 * les servían. Acá está todo lo que cambia por rubro, en un solo lugar.
 *
 * Lo que vale para varios formularios (variantes) sigue en vertical-attributes.
 */

import type { BusinessVertical, OperatingModel } from '@/lib/organization/business-profile'

export const VERTICAL_LABELS: Record<BusinessVertical, string> = {
  general: 'Comercio general',
  clothing: 'Ropa y moda',
  barbershop: 'Barbería y peluquería',
  cosmetics: 'Cosmética y belleza',
  electronics: 'Electrónica y tecnología',
  food: 'Alimentos',
  hardware: 'Ferretería',
  other: 'Otro rubro',
}

export type UnitOption = { value: string; label: string }

export const UNIT_OPTIONS: UnitOption[] = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'servicio', label: 'Servicio (no lleva stock)' },
  { value: 'par', label: 'Par' },
  { value: 'docena', label: 'Docena' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'g', label: 'Gramo' },
  { value: 'l', label: 'Litro' },
  { value: 'ml', label: 'Mililitro' },
  { value: 'm', label: 'Metro' },
  { value: 'cm', label: 'Centímetro' },
  { value: 'm2', label: 'Metro cuadrado' },
  { value: 'caja', label: 'Caja' },
  { value: 'paquete', label: 'Paquete' },
  { value: 'bolsa', label: 'Bolsa' },
  { value: 'rollo', label: 'Rollo' },
]

/** Las unidades con las que vende cada rubro, en el orden en que más se usan. */
const UNITS_BY_VERTICAL: Record<BusinessVertical, string[]> = {
  general: ['unidad', 'caja', 'paquete', 'docena', 'kg', 'g', 'l', 'ml', 'm', 'servicio'],
  clothing: ['unidad', 'par', 'docena', 'paquete', 'caja'],
  cosmetics: ['unidad', 'ml', 'g', 'caja', 'paquete', 'servicio'],
  electronics: ['unidad', 'caja', 'paquete', 'm', 'servicio'],
  food: ['unidad', 'kg', 'g', 'l', 'ml', 'docena', 'caja', 'paquete', 'bolsa'],
  hardware: ['unidad', 'm', 'cm', 'm2', 'kg', 'g', 'l', 'caja', 'paquete', 'bolsa', 'rollo'],
  barbershop: ['servicio', 'unidad', 'ml', 'g'],
  other: UNIT_OPTIONS.map((unit) => unit.value),
}

export type PolicyTemplate = { label: string; text: string }

export interface ProductFormProfile {
  vertical: BusinessVertical
  label: string
  namePlaceholder: string
  descriptionPlaceholder: string
  skuPrefix: string
  units: UnitOption[]
  warranty: {
    /** Alimentos no llevan garantía: se ocultan los meses y se explica por qué. */
    enabled: boolean
    title: string
    monthOptions: number[]
    templates: PolicyTemplate[]
    placeholder: string
    disabledNote?: string
  }
  returnPlaceholder: string
  exchangePlaceholder: string
  returnTemplates: PolicyTemplate[]
  variantsTip: string
  /** Trabaja con fechas de vencimiento: el formulario pide lote y vencimiento. */
  tracksExpiry: boolean
}

const ELECTRONICS_WARRANTY: PolicyTemplate = {
  label: 'Electrónica',
  text: 'Garantía oficial por fallas o defectos de fabricación durante el período establecido. No cubre roturas por golpes, caídas, humedad, sobretensión eléctrica o manipulación indebida.',
}
const CLOTHING_WARRANTY: PolicyTemplate = {
  label: 'Ropa/Calzado',
  text: 'Garantía por defectos de confección o costura. El producto debe presentarse con etiqueta original y no presentar signos de uso ni lavado.',
}
const GENERAL_WARRANTY: PolicyTemplate = {
  label: 'General',
  text: 'Cubre defectos o vicios de fabricación presentando el comprobante o factura de compra correspondiente y empaque original.',
}

type ProfileOverrides = Omit<ProductFormProfile, 'vertical' | 'label' | 'units'>

const BASE: ProfileOverrides = {
  namePlaceholder: 'Ej: Termo 1 litro acero inoxidable',
  descriptionPlaceholder: 'Qué es, para qué sirve y qué incluye.',
  skuPrefix: 'PROD',
  warranty: {
    enabled: true,
    title: 'Garantía y cobertura',
    monthOptions: [0, 1, 3, 6, 12, 24],
    templates: [GENERAL_WARRANTY, ELECTRONICS_WARRANTY, CLOTHING_WARRANTY],
    placeholder: 'Ej: Cubre fallas de fábrica presentando el comprobante.',
  },
  returnPlaceholder: 'Ej: Producto sin uso, en su empaque y con el comprobante, dentro del plazo.',
  exchangePlaceholder: 'Ej: Cambio por el mismo producto o uno equivalente, sujeto a stock.',
  returnTemplates: [],
  variantsTip: 'Usá variantes cuando el mismo producto viene en distintas versiones (tamaño, color, modelo). Cada una tiene su propio stock, precio y SKU.',
  tracksExpiry: false,
}

const PROFILES: Record<BusinessVertical, Partial<ProfileOverrides>> = {
  general: {},
  other: {},
  electronics: {
    namePlaceholder: 'Ej: Cargador rápido USB-C 20W',
    descriptionPlaceholder: 'Especificaciones, compatibilidad y qué viene en la caja.',
    skuPrefix: 'TEC',
    warranty: { ...BASE.warranty, templates: [ELECTRONICS_WARRANTY, GENERAL_WARRANTY], placeholder: 'Ej: Cubre fallas de fábrica. No cubre golpes, humedad ni manipulación.' },
    returnPlaceholder: 'Ej: Producto sin uso, con caja, accesorios y factura, dentro del plazo.',
    variantsTip: 'Usá variantes para capacidad, color o modelo. Cada una tiene su propio stock, precio y SKU. Los IMEI o números de serie no son variantes.',
  },
  clothing: {
    namePlaceholder: 'Ej: Remera algodón cuello redondo',
    descriptionPlaceholder: 'Tela, calce, cuidados de lavado y guía de talles.',
    skuPrefix: 'ROP',
    warranty: {
      ...BASE.warranty,
      title: 'Garantía por fallas',
      monthOptions: [0, 1, 3],
      templates: [CLOTHING_WARRANTY],
      placeholder: 'Ej: Por fallas de confección. Con etiqueta y sin uso.',
    },
    returnPlaceholder: 'Ej: Sin uso, con etiqueta, dentro del plazo.',
    exchangePlaceholder: 'Ej: Cambio de talle o color sujeto a stock, con etiqueta.',
    returnTemplates: [{ label: 'Cambio de talle', text: 'Aceptamos cambios de talle o color dentro del plazo, con la prenda sin uso, sin lavar y con su etiqueta.' }],
    variantsTip: 'Usá variantes para talles y colores: cada combinación tiene su propio stock y SKU, y en la tienda el cliente elige la suya.',
  },
  cosmetics: {
    namePlaceholder: 'Ej: Crema hidratante facial 50 ml',
    descriptionPlaceholder: 'Para qué tipo de piel es, cómo se usa y sus componentes principales.',
    skuPrefix: 'COS',
    warranty: {
      ...BASE.warranty,
      title: 'Garantía',
      monthOptions: [0, 1, 3],
      templates: [{ label: 'Cosmética', text: 'Cubre productos con defectos de fabricación o envase dañado al momento de la compra, presentando el comprobante.' }],
      placeholder: 'Ej: Por envase dañado o producto en mal estado al comprarlo.',
    },
    returnPlaceholder: 'Ej: Solo productos cerrados y con el precinto intacto.',
    exchangePlaceholder: 'Ej: Por higiene, no se cambian productos abiertos o probados.',
    returnTemplates: [{ label: 'Higiene', text: 'Por razones de higiene no aceptamos devoluciones ni cambios de productos abiertos, probados o sin precinto.' }],
    variantsTip: 'Usá variantes para tonos y presentaciones (30 ml, 50 ml…). Cada una tiene su propio stock, precio y SKU.',
    tracksExpiry: true,
  },
  food: {
    namePlaceholder: 'Ej: Yerba mate 500 g',
    descriptionPlaceholder: 'Ingredientes, contenido neto y cómo se conserva.',
    skuPrefix: 'ALI',
    warranty: {
      ...BASE.warranty,
      enabled: false,
      title: 'Garantía',
      disabledNote: 'Los alimentos no llevan meses de garantía. Si querés, aclará abajo qué pasa si el producto llega en mal estado.',
    },
    returnPlaceholder: 'Ej: Solo si el producto llega vencido o en mal estado.',
    exchangePlaceholder: 'Ej: Reponemos el producto si llega dañado o vencido.',
    returnTemplates: [{ label: 'Alimentos', text: 'No aceptamos devoluciones de alimentos, salvo que el producto esté vencido o en mal estado al momento de la entrega.' }],
    variantsTip: 'Usá variantes para presentaciones y contenidos (250 g, 500 g, 1 kg). Cada una tiene su propio stock, precio y SKU.',
    tracksExpiry: true,
  },
  hardware: {
    namePlaceholder: 'Ej: Tornillo autoperforante 8 x 1"',
    descriptionPlaceholder: 'Medidas, material, uso recomendado y cantidad por envase.',
    skuPrefix: 'FER',
    warranty: {
      ...BASE.warranty,
      monthOptions: [0, 3, 6, 12, 24],
      templates: [{ label: 'Herramientas', text: 'Garantía del fabricante por defectos de fabricación. No cubre desgaste por uso, golpes ni uso indebido.' }, GENERAL_WARRANTY],
    },
    variantsTip: 'Usá variantes para medidas, calibres o materiales. Cada una tiene su propio stock, precio y SKU.',
  },
  barbershop: {
    namePlaceholder: 'Ej: Corte + barba',
    descriptionPlaceholder: 'Qué incluye el servicio, cuánto dura y para quién es.',
    skuPrefix: 'SRV',
    warranty: {
      ...BASE.warranty,
      title: 'Garantía del trabajo',
      monthOptions: [0, 1],
      templates: [{ label: 'Servicio', text: 'Si no quedaste conforme con el trabajo, volvé dentro de los 7 días y lo corregimos sin cargo.' }, GENERAL_WARRANTY],
      placeholder: 'Ej: Retoque sin cargo dentro de los 7 días.',
    },
    variantsTip: 'Usá variantes para los productos que vendés en distintas presentaciones (100 ml, 250 ml). Los servicios no necesitan variantes.',
  },
}

function isVertical(value: unknown): value is BusinessVertical {
  return typeof value === 'string' && value in PROFILES
}

/**
 * Las unidades del rubro. El modelo de servicios (o de taller) suma
 * «Servicio» aunque el rubro no la tenga, y la unidad que ya tiene el producto
 * siempre está, para no perderla al editarlo.
 */
export function unitsFor(vertical: BusinessVertical, operatingModel?: OperatingModel | string | null, current?: string | null): UnitOption[] {
  const values = [...UNITS_BY_VERTICAL[vertical]]
  if (operatingModel && ['service', 'repair', 'mixed'].includes(operatingModel) && !values.includes('servicio')) values.push('servicio')
  const options = values.map((value) => UNIT_OPTIONS.find((unit) => unit.value === value)).filter((unit): unit is UnitOption => Boolean(unit))
  const kept = current?.trim()
  if (kept && !options.some((unit) => unit.value === kept)) {
    options.push(UNIT_OPTIONS.find((unit) => unit.value === kept) ?? { value: kept, label: kept })
  }
  return options
}

export function productFormProfile(
  businessVertical: string | null | undefined,
  operatingModel?: OperatingModel | string | null,
  currentUnit?: string | null,
): ProductFormProfile {
  const vertical: BusinessVertical = isVertical(businessVertical) ? businessVertical : 'general'
  const overrides = PROFILES[vertical]
  return {
    ...BASE,
    ...overrides,
    warranty: { ...BASE.warranty, ...overrides.warranty },
    vertical,
    label: VERTICAL_LABELS[vertical],
    units: unitsFor(vertical, operatingModel, currentUnit),
  }
}

export type PostSaleDefaults = {
  warranty_months: number
  warranty_info: string
  return_window_days: number
  exchange_window_days: number
  return_policy: string
  exchange_policy: string
}

const GENERIC_POST_SALE: PostSaleDefaults = {
  warranty_months: 3,
  warranty_info: 'Cubre defectos de fábrica. No cubre golpes, humedad ni manipulación.',
  return_window_days: 7,
  exchange_window_days: 7,
  return_policy: 'Devolución dentro de 7 días con factura, empaque original y producto sin daños.',
  exchange_policy: 'Cambio dentro de 7 días por falla de fábrica o error de entrega, sujeto a stock.',
}

/**
 * Lo que trae cargado un producto nuevo en Postventa. Una remera no tiene
 * «3 meses de garantía», un alimento no se devuelve «con empaque original» y un
 * corte de pelo no se cambia por otro.
 */
const POST_SALE_BY_VERTICAL: Partial<Record<BusinessVertical, PostSaleDefaults>> = {
  clothing: {
    warranty_months: 0,
    warranty_info: '',
    return_window_days: 7,
    exchange_window_days: 15,
    return_policy: 'Devolución dentro de 7 días, sin uso, sin lavar y con su etiqueta.',
    exchange_policy: 'Cambio de talle o color dentro de 15 días, con la prenda sin uso y con etiqueta, sujeto a stock.',
  },
  cosmetics: {
    warranty_months: 0,
    warranty_info: '',
    return_window_days: 7,
    exchange_window_days: 7,
    return_policy: 'Solo productos cerrados y con el precinto intacto, dentro de 7 días.',
    exchange_policy: 'Por higiene no cambiamos productos abiertos o probados.',
  },
  food: {
    warranty_months: 0,
    warranty_info: '',
    return_window_days: 0,
    exchange_window_days: 0,
    return_policy: 'No aceptamos devoluciones de alimentos, salvo que el producto esté vencido o en mal estado al entregarlo.',
    exchange_policy: 'Reponemos el producto si llega vencido o dañado.',
  },
  barbershop: {
    warranty_months: 0,
    warranty_info: 'Si no quedaste conforme con el trabajo, volvé dentro de los 7 días y lo corregimos sin cargo.',
    return_window_days: 0,
    exchange_window_days: 0,
    return_policy: '',
    exchange_policy: '',
  },
}

export function postSaleDefaultsFor(vertical: BusinessVertical): PostSaleDefaults {
  return { ...(POST_SALE_BY_VERTICAL[vertical] ?? GENERIC_POST_SALE) }
}

/** El texto del botón «Insertar política de cambio», según el rubro. */
export function exchangeTemplateFor(vertical: BusinessVertical): string {
  return POST_SALE_BY_VERTICAL[vertical]?.exchange_policy
    || 'Cambio por el mismo producto o uno equivalente dentro del plazo indicado, sujeto a stock. El producto debe conservar su embalaje original.'
}

/** SKU automático con el prefijo del rubro: ROP-…, ALI-…, SRV-… */
export function generateProductSku(prefix: string, now = Date.now(), random = Math.random()) {
  const stamp = now.toString(36).toUpperCase()
  const tail = random.toString(36).substring(2, 6).toUpperCase().padEnd(4, '0')
  return `${prefix}-${stamp}-${tail}`
}

export const SERVICE_UNIT = 'servicio'

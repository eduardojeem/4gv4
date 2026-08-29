import type { BusinessVertical } from '@/lib/organization/business-profile'

export type VariantAttributeControl = 'text' | 'number' | 'select' | 'color'

export interface VariantAttributeSuggestion {
  key: string
  label: string
  control: VariantAttributeControl
  examples: string[]
  customizable: true
}

export interface VerticalProductCopy {
  sectionTitle: string
  sectionDescription: string
}

type Preset = Omit<VariantAttributeSuggestion, 'customizable'>

const PRESETS: Record<BusinessVertical, Preset[]> = {
  general: [],
  clothing: [
    { key: 'size', label: 'Talle', control: 'select', examples: ['S', 'M', 'L', 'XL'] },
    { key: 'color', label: 'Color', control: 'color', examples: ['Negro', 'Blanco', 'Azul'] },
    { key: 'gender', label: 'Género', control: 'select', examples: ['Unisex', 'Mujer', 'Hombre'] },
    { key: 'material', label: 'Material', control: 'text', examples: ['Algodón', 'Poliéster'] },
    { key: 'season', label: 'Temporada', control: 'text', examples: ['Verano', 'Invierno'] },
  ],
  cosmetics: [
    { key: 'line', label: 'Línea', control: 'text', examples: ['Profesional', 'Dermocosmética'] },
    { key: 'tone', label: 'Tono', control: 'color', examples: ['Claro', 'Medio', 'Oscuro'] },
    { key: 'volume', label: 'Volumen', control: 'select', examples: ['30 ml', '50 ml', '100 ml'] },
    { key: 'skin_type', label: 'Tipo de piel', control: 'select', examples: ['Seca', 'Mixta', 'Grasa'] },
    { key: 'presentation', label: 'Presentación', control: 'text', examples: ['Frasco', 'Pomo', 'Estuche'] },
  ],
  electronics: [
    { key: 'model', label: 'Modelo', control: 'text', examples: ['Estándar', 'Pro'] },
    { key: 'capacity', label: 'Capacidad', control: 'select', examples: ['128 GB', '256 GB'] },
    { key: 'color', label: 'Color', control: 'color', examples: ['Negro', 'Plata'] },
    { key: 'warranty', label: 'Garantía', control: 'select', examples: ['6 meses', '12 meses'] },
    { key: 'compatibility', label: 'Compatibilidad', control: 'text', examples: ['USB-C', 'Android'] },
  ],
  food: [
    { key: 'presentation', label: 'Presentación', control: 'text', examples: ['Caja', 'Bolsa', 'Botella'] },
    { key: 'net_content', label: 'Contenido neto', control: 'select', examples: ['250 g', '500 g', '1 kg'] },
    { key: 'storage', label: 'Conservación', control: 'text', examples: ['Ambiente', 'Refrigerado'] },
  ],
  hardware: [
    { key: 'measure', label: 'Medida', control: 'select', examples: ['6 mm', '8 mm', '10 mm'] },
    { key: 'material', label: 'Material', control: 'text', examples: ['Acero', 'PVC', 'Aluminio'] },
    { key: 'gauge', label: 'Calibre', control: 'text', examples: ['18', '20', '22'] },
    { key: 'sales_unit', label: 'Unidad de venta', control: 'select', examples: ['Unidad', 'Metro', 'Caja'] },
  ],
  other: [],
}

const COPY: Partial<Record<BusinessVertical, VerticalProductCopy>> = {
  clothing: {
    sectionTitle: 'Talles, colores y variantes',
    sectionDescription: 'Definí las combinaciones que vendés y el stock disponible de cada una.',
  },
  cosmetics: {
    sectionTitle: 'Presentaciones, tonos y variantes',
    sectionDescription: 'Organizá tonos, volúmenes y presentaciones con precios y stock independientes.',
  },
  electronics: {
    sectionTitle: 'Modelos, capacidades y variantes',
    sectionDescription: 'Separá cada configuración vendible sin mezclar series o IMEI.',
  },
  hardware: {
    sectionTitle: 'Medidas, materiales y variantes',
    sectionDescription: 'Configurá medidas y unidades comercializadas con su propio stock.',
  },
  food: {
    sectionTitle: 'Presentaciones y variantes',
    sectionDescription: 'Diferenciá contenido y presentación; lotes y vencimientos se gestionarán aparte.',
  },
}

const GENERIC_COPY: VerticalProductCopy = {
  sectionTitle: 'Características del producto',
  sectionDescription: 'Agregá atributos personalizados si necesitás describir mejor el producto.',
}

export function getVerticalAttributeSuggestions(
  vertical: BusinessVertical,
): VariantAttributeSuggestion[] {
  return PRESETS[vertical].map((item) => ({
    ...item,
    examples: [...item.examples],
    customizable: true,
  }))
}

export function getVerticalProductCopy(vertical: BusinessVertical): VerticalProductCopy {
  return { ...(COPY[vertical] ?? GENERIC_COPY) }
}

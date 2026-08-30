import { useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Info,
  Layers3,
  Lightbulb,
  Plus,
  Shirt,
  Smartphone,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import type { BusinessVertical } from '@/lib/organization/business-profile'
import {
  generateVariantCombinations,
  mergeGeneratedVariants,
  type VariantPriceDefaults,
} from '@/lib/products/variant-combinations'
import type {
  ProductAttributeDefinition,
  ProductVariantsPayload,
} from '@/lib/products/variant-contract'
import {
  getVerticalAttributeSuggestions,
  getVerticalProductCopy,
} from '@/lib/products/vertical-attributes'

export interface ProductVariantsEditorProps {
  value: ProductVariantsPayload
  onChange: (value: ProductVariantsPayload) => void
  basePrices: VariantPriceDefaults
  baseSku?: string
  businessVertical: BusinessVertical
  disabled?: boolean
}

function splitOptions(value: string): string[] {
  return [...new Set(value.split(',').map((o) => o.trim()).filter(Boolean))]
}

/** Calcula cuántas combinaciones se generarían con los atributos actuales */
function previewCombinationCount(attributes: ProductAttributeDefinition[]): number {
  const filled = attributes.filter((a) => a.options.length > 0)
  if (filled.length === 0) return 0
  return filled.reduce((acc, a) => acc * a.options.length, 1)
}

const EXAMPLE_USE_CASES = [
  {
    id: 'clothing',
    title: '👕 Indumentaria',
    productName: 'Remera Deportiva Dry-Fit',
    attributes: [
      { name: 'Talle', options: ['S', 'M', 'L', 'XL'] },
      { name: 'Color', options: ['Negro', 'Blanco'] },
    ],
    totalVariants: 8,
    formula: '4 Talles × 2 Colores = 8 variantes',
    benefit: 'Controlás el stock exacto por talle y color. Si se agota el M Negro, el cliente aún puede comprar el L Negro o el M Azul.',
  },
  {
    id: 'tech',
    title: '📱 Tecnología',
    productName: 'Smartphone Pro 5G',
    attributes: [
      { name: 'Almacenamiento', options: ['128 GB', '256 GB'] },
      { name: 'Color', options: ['Gris Espacial', 'Plata'] },
    ],
    totalVariants: 4,
    formula: '2 Memorias × 2 Colores = 4 variantes',
    benefit: 'Podés asignar un precio mayor al modelo de 256 GB y cada variante tiene su propio código de barras para el lector POS.',
  },
  {
    id: 'cosmetics',
    title: '💄 Cosmética',
    productName: 'Serum Facial Hidratante',
    attributes: [
      { name: 'Volumen', options: ['30 ml', '50 ml'] },
      { name: 'Tipo de Piel', options: ['Seca', 'Grasa', 'Mixta'] },
    ],
    totalVariants: 6,
    formula: '2 Volúmenes × 3 Pieles = 6 variantes',
    benefit: 'El cliente ve un solo producto en la tienda y elige la presentación y fórmula adecuada con un solo click.',
  },
  {
    id: 'food',
    title: '☕ Alimentos',
    productName: 'Café de Especialidad',
    attributes: [
      { name: 'Molienda', options: ['En Grano', 'Molido Fino'] },
      { name: 'Peso', options: ['250 g', '500 g', '1 kg'] },
    ],
    totalVariants: 6,
    formula: '2 Moliendas × 3 Pesos = 6 variantes',
    benefit: 'Evitás crear 6 publicaciones separadas; el comprador selecciona peso y molienda directamente en la misma ficha.',
  },
]

export function ProductVariantsEditor({
  value,
  onChange,
  basePrices,
  baseSku = 'VAR',
  businessVertical,
  disabled = false,
}: ProductVariantsEditorProps) {
  const suggestions = getVerticalAttributeSuggestions(businessVertical)
  const copy = getVerticalProductCopy(businessVertical)

  // Estado local para input de nueva opción por atributo
  const [optionInputs, setOptionInputs] = useState<Record<number, string>>({})
  const [expandedVariant, setExpandedVariant] = useState<number | null>(null)
  const [showGuide, setShowGuide] = useState(true)
  const [selectedExampleId, setSelectedExampleId] = useState('clothing')

  /* ── Mutators ── */
  const updateAttribute = (index: number, patch: Partial<ProductAttributeDefinition>) => {
    const attributes = value.attributes.map((attr, i) =>
      i === index ? { ...attr, ...patch } : attr
    )
    onChange({ ...value, attributes })
  }

  const addOptionToAttribute = (index: number, option: string) => {
    const trimmed = option.trim()
    if (!trimmed) return
    const attr = value.attributes[index]
    if (!attr) return
    if (attr.options.includes(trimmed)) return
    updateAttribute(index, { options: [...attr.options, trimmed] })
    setOptionInputs((prev) => ({ ...prev, [index]: '' }))
  }

  const removeOptionFromAttribute = (attrIndex: number, optionValue: string) => {
    const attr = value.attributes[attrIndex]
    if (!attr) return
    updateAttribute(attrIndex, { options: attr.options.filter((o) => o !== optionValue) })
  }

  const removeAttribute = (index: number) => {
    onChange({
      ...value,
      attributes: value.attributes.filter((_, i) => i !== index),
    })
  }

  const addSuggestion = (key: string) => {
    const suggestion = suggestions.find((s) => s.key === key)
    if (!suggestion || value.attributes.some((a) => a.key === suggestion.key)) return
    onChange({
      ...value,
      attributes: [...value.attributes, {
        key: suggestion.key,
        label: suggestion.label,
        control: suggestion.control,
        options: [...suggestion.examples],
      }],
    })
  }

  const addCustomAttribute = () => {
    const suffix = value.attributes.length + 1
    onChange({
      ...value,
      attributes: [...value.attributes, {
        key: `attribute_${suffix}`,
        label: `Atributo ${suffix}`,
        control: 'select',
        options: [],
      }],
    })
  }

  const generate = () => {
    const generated = generateVariantCombinations(value.attributes)
    const variants = mergeGeneratedVariants(generated, value.variants, basePrices).map((v, i) => ({
      ...v,
      sku: v.sku || `${baseSku.trim().toUpperCase() || 'VAR'}-${String(i + 1).padStart(2, '0')}`,
    }))
    onChange({ ...value, variants })
  }

  const configureShirt = () => {
    const replacesExistingConfiguration = value.attributes.length > 0 || value.variants.length > 0
    if (
      replacesExistingConfiguration
      && !window.confirm('Esta acción reemplazará los atributos y variantes actuales. ¿Querés continuar?')
    ) {
      return
    }

    const attributes: ProductAttributeDefinition[] = [
      { key: 'size', label: 'Talle', control: 'select', options: ['S', 'M', 'L', 'XL'] },
      { key: 'color', label: 'Color', control: 'color', options: ['Negro', 'Blanco'] },
    ]
    const generated = generateVariantCombinations(attributes)
    const variants = mergeGeneratedVariants(generated, [], basePrices).map((variant, index) => ({
      ...variant,
      sku: `${baseSku.trim().toUpperCase() || 'REM'}-${String(index + 1).padStart(2, '0')}`,
    }))

    onChange({ hasVariants: true, attributes, variants })
  }

  const updateVariant = (
    index: number,
    patch: Partial<ProductVariantsPayload['variants'][number]>
  ) => {
    onChange({
      ...value,
      variants: value.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    })
  }

  const removeVariant = (index: number) => {
    onChange({
      ...value,
      variants: value.variants.filter((_, i) => i !== index),
    })
  }

  const previewCount = previewCombinationCount(value.attributes)
  const hasAttributes = value.attributes.length > 0
  const hasOptions = value.attributes.some((a) => a.options.length > 0)
  const currentExample = EXAMPLE_USE_CASES.find((e) => e.id === selectedExampleId) || EXAMPLE_USE_CASES[0]

  return (
    <section className="space-y-5" aria-labelledby="product-variants-title">

      {/* ── Toggle: Producto simple vs con variantes ── */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="product-variants-title" className="font-semibold text-slate-900 dark:text-slate-100">
              {copy.sectionTitle}
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{copy.sectionDescription}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1 shadow-sm dark:bg-slate-800 shrink-0">
            <Button
              type="button"
              size="sm"
              variant={!value.hasVariants ? 'default' : 'ghost'}
              disabled={disabled}
              onClick={() => onChange({ hasVariants: false, attributes: [], variants: [] })}
              className="gap-1.5"
            >
              <Check className={`h-3.5 w-3.5 ${!value.hasVariants ? 'opacity-100' : 'opacity-0'}`} />
              Producto simple
            </Button>
            <Button
              type="button"
              size="sm"
              aria-label="Producto con variantes"
              variant={value.hasVariants ? 'default' : 'ghost'}
              disabled={disabled}
              onClick={() => onChange({ ...value, hasVariants: true })}
              className="gap-1.5"
            >
              <Layers3 className="h-3.5 w-3.5" />
              Con variantes
            </Button>
          </div>
        </div>
      </div>

      {/* ── GUÍA EXPLICATIVA CON EJEMPLOS REALES ── */}
      <div className="rounded-xl border border-violet-200/80 dark:border-violet-800/50 bg-gradient-to-br from-violet-50/60 via-purple-50/30 to-indigo-50/40 dark:from-violet-950/20 dark:via-purple-950/10 dark:to-slate-900 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowGuide((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-violet-100/40 dark:hover:bg-violet-900/20 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white shadow-xs">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-violet-900 dark:text-violet-200">
                ¿Cómo funcionan las variantes? (Guía y ejemplos)
              </p>
              <p className="text-[11px] text-violet-700/80 dark:text-violet-300/80">
                Aprendé la diferencia entre producto simple, atributos y combinaciones vendibles
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-violet-700 dark:text-violet-300 font-medium">
            <span>{showGuide ? 'Ocultar guía' : 'Ver ejemplos'}</span>
            {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {showGuide && (
          <div className="border-t border-violet-200/60 dark:border-violet-800/40 p-4 space-y-4">
            {/* Conceptos clave en 3 pasos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 p-3 border border-violet-100 dark:border-violet-900/40">
                <span className="inline-block rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-bold mb-1.5">
                  1. Atributo & Opciones
                </span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">La característica</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                  El <strong>Atributo</strong> es la categoría (ej: <em>Talle</em>) y las <strong>Opciones</strong> son los valores (ej: <em>S, M, L</em>).
                </p>
              </div>

              <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 p-3 border border-violet-100 dark:border-violet-900/40">
                <span className="inline-block rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-bold mb-1.5">
                  2. Combinaciones
                </span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Multiplicación automática</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                  El sistema cruza tus opciones: <strong>3 Talles × 2 Colores = 6 variantes</strong> generadas al instante.
                </p>
              </div>

              <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 p-3 border border-violet-100 dark:border-violet-900/40">
                <span className="inline-block rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold mb-1.5">
                  3. Stock y Precio Único
                </span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Independencia total</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Cada combinación tiene su propio <strong>SKU, código de barras, stock y precio</strong> para cobrar y descontar en el POS y tienda online.
                </p>
              </div>
            </div>

            {/* Selector de ejemplos prácticos */}
            <div className="rounded-xl bg-white/90 dark:bg-slate-900/80 border border-violet-100 dark:border-violet-900/40 p-3.5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Ejemplos prácticos según el rubro:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_USE_CASES.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => setSelectedExampleId(ex.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none ${
                        selectedExampleId === ex.id
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {ex.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detalle del ejemplo activo */}
              <div className="rounded-lg bg-violet-50/70 dark:bg-violet-950/30 p-3 border border-violet-200/50 dark:border-violet-800/40 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-xs font-bold text-violet-950 dark:text-violet-200">
                    Producto: {currentExample.productName}
                  </span>
                  <Badge variant="secondary" className="text-[10px] bg-violet-200/60 dark:bg-violet-900/60 text-violet-800 dark:text-violet-200 font-bold">
                    {currentExample.formula}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {currentExample.attributes.map((attr) => (
                    <div key={attr.name} className="flex items-center gap-1 text-[11px] bg-white dark:bg-slate-900 px-2 py-1 rounded-md border border-violet-100 dark:border-violet-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{attr.name}:</span>
                      <span className="text-violet-700 dark:text-violet-400">{attr.options.join(', ')}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-violet-800/90 dark:text-violet-300/90 leading-relaxed pt-1">
                  💡 <strong>Beneficio:</strong> {currentExample.benefit}
                </p>
                {currentExample.id === 'clothing' && (
                  <div className="flex flex-col gap-2 border-t border-violet-200/60 pt-3 dark:border-violet-800/40 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Precarga talles, colores, precios base, SKU y las 8 combinaciones.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      disabled={disabled}
                      onClick={configureShirt}
                      className="w-full gap-2 sm:w-auto"
                    >
                      <Shirt className="h-4 w-4" />
                      Configurar una remera
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {value.hasVariants && (
        <>
          {/* ── PASO 1: Sugerencias del rubro ── */}
          {suggestions.length > 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold shrink-0">1</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Elegí los atributos para tu rubro
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => {
                  const selected = value.attributes.some((a) => a.key === suggestion.key)
                  return (
                    <button
                      key={suggestion.key}
                      type="button"
                      disabled={disabled || selected}
                      onClick={() => addSuggestion(suggestion.key)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all select-none ${
                        selected
                          ? 'border-primary/40 bg-primary/10 text-primary cursor-default'
                          : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary/50 hover:text-primary hover:bg-primary/5'
                      }`}
                    >
                      {selected
                        ? <Check className="h-3 w-3 shrink-0" />
                        : <Plus className="h-3 w-3 shrink-0" />
                      }
                      {suggestion.label}
                      {selected && <span className="text-[10px] text-primary/70 font-normal">agregado</span>}
                      {!selected && suggestion.examples.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          (ej: {suggestion.examples.slice(0, 2).join(', ')})
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── PASO 2: Configurar atributos y sus opciones ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold shrink-0">2</span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Configurá las opciones de cada atributo
              </p>
            </div>

            {value.attributes.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-8 text-center">
                <Layers3 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Aún no hay atributos. Elegí uno de las sugerencias de arriba
                  <br />o agregá uno personalizado.
                </p>
              </div>
            )}

            {value.attributes.map((attribute, attrIndex) => (
              <div
                key={attribute.key}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden"
              >
                {/* Header del atributo */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex-1 min-w-0">
                    <Input
                      value={attribute.label}
                      disabled={disabled}
                      placeholder="Nombre del atributo"
                      className="h-8 text-sm font-semibold border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
                      onChange={(e) => updateAttribute(attrIndex, { label: e.target.value })}
                    />
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[11px]">
                    {attribute.options.length} {attribute.options.length === 1 ? 'opción' : 'opciones'}
                  </Badge>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`Eliminar atributo ${attribute.label}`}
                    onClick={() => removeAttribute(attrIndex)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Opciones como chips */}
                <div className="p-4 space-y-3">
                  {/* Chips de opciones existentes */}
                  <div className="flex flex-wrap gap-2 min-h-[28px]">
                    {attribute.options.length === 0 && (
                      <span className="text-[12px] text-slate-400 dark:text-slate-500 italic">
                        Sin opciones aún — agregá una abajo
                      </span>
                    )}
                    {attribute.options.map((option) => (
                      <span
                        key={option}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary dark:text-primary/90"
                      >
                        {option}
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => removeOptionFromAttribute(attrIndex, option)}
                            className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20 text-primary/60 hover:text-primary transition-colors"
                            aria-label={`Quitar opción ${option}`}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* Input para agregar opciones */}
                  {!disabled && (
                    <div className="flex gap-2">
                      <Input
                        value={optionInputs[attrIndex] ?? ''}
                        placeholder={`Ej: ${attribute.options.slice(0, 2).join(', ') || 'Rojo, Azul, Verde'}`}
                        className="h-8 text-sm flex-1"
                        onChange={(e) => setOptionInputs((prev) => ({ ...prev, [attrIndex]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const raw = optionInputs[attrIndex] ?? ''
                            // Soportar múltiples opciones separadas por coma
                            splitOptions(raw).forEach((opt) => addOptionToAttribute(attrIndex, opt))
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 shrink-0"
                        onClick={() => {
                          const raw = optionInputs[attrIndex] ?? ''
                          splitOptions(raw).forEach((opt) => addOptionToAttribute(attrIndex, opt))
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Agregar
                      </Button>
                    </div>
                  )}
                  {!disabled && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      💡 Podés escribir varias opciones separadas por coma y presionar Enter o el botón Agregar.
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Botones: agregar atributo personalizado */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={addCustomAttribute}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Agregar atributo personalizado
              </Button>
            </div>
          </div>

          {/* ── PASO 3: Generar combinaciones ── */}
          <div className="rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold shrink-0">3</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                  Generá las combinaciones vendibles
                </p>
                {previewCount > 0 && (
                  <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80">
                    Se generarán <strong>{previewCount}</strong> combinación{previewCount !== 1 ? 'es' : ''} a partir de tus atributos
                    {value.variants.length > 0 && ` · ${value.variants.length} ya generadas`}
                  </p>
                )}
                {!hasOptions && hasAttributes && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    ⚠️ Agregá opciones en al menos un atributo para poder generar combinaciones.
                  </p>
                )}
                {!hasAttributes && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Agregá atributos en el paso anterior para poder generar.
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              disabled={disabled || !hasOptions}
              onClick={generate}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20"
            >
              <Zap className="h-4 w-4" />
              {value.variants.length > 0 ? 'Regenerar combinaciones' : 'Generar combinaciones'}
            </Button>
            {value.variants.length > 0 && (
              <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70">
                ⚠️ Regenerar reemplaza las combinaciones existentes. Los valores que ya editaste se intentan preservar si el nombre de variante coincide.
              </p>
            )}
          </div>

          {/* ── PASO 4: Tabla de variantes generadas ── */}
          {value.variants.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0">4</span>
                <div className="flex items-center justify-between flex-1 gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Ajustá precios, SKUs y stock de cada variante
                  </p>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 shrink-0">
                    {value.variants.length} variante{value.variants.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>

              {/* Desktop: tabla */}
              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 md:block">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Variante</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">SKU</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Costo</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Precio Público</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Mayorista</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Stock</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-400"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {value.variants.map((variant, index) => {
                      const margin = variant.purchasePrice > 0 && variant.salePrice > 0
                        ? (((variant.salePrice - variant.purchasePrice) / variant.salePrice) * 100).toFixed(0)
                        : null
                      return (
                        <tr key={variant.clientKey} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{variant.name}</span>
                              {margin !== null && (
                                <span className="text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-px font-bold">
                                  {margin}% margen
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              value={variant.sku}
                              placeholder="SKU"
                              className="h-8 text-xs"
                              onChange={(e) => updateVariant(index, { sku: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={variant.purchasePrice}
                              className="h-8 text-xs w-24"
                              onChange={(e) => updateVariant(index, { purchasePrice: Number(e.target.value) })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={variant.salePrice}
                              className="h-8 text-xs font-semibold w-24"
                              onChange={(e) => updateVariant(index, { salePrice: Number(e.target.value) })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="—"
                              value={variant.wholesalePrice ?? ''}
                              className="h-8 text-xs w-24"
                              onChange={(e) =>
                                updateVariant(index, {
                                  wholesalePrice: e.target.value ? Number(e.target.value) : undefined,
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={variant.stockQuantity}
                              className="h-8 text-xs w-20"
                              onChange={(e) => updateVariant(index, { stockQuantity: Number(e.target.value) })}
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeVariant(index)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30 transition-colors mx-auto"
                              aria-label={`Eliminar variante ${variant.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: tarjetas expandibles */}
              <div className="space-y-2 md:hidden">
                {value.variants.map((variant, index) => {
                  const isExpanded = expandedVariant === index
                  const margin = variant.purchasePrice > 0 && variant.salePrice > 0
                    ? (((variant.salePrice - variant.purchasePrice) / variant.salePrice) * 100).toFixed(0)
                    : null
                  return (
                    <div
                      key={variant.clientKey}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden"
                    >
                      {/* Header de la tarjeta */}
                      <button
                        type="button"
                        onClick={() => setExpandedVariant(isExpanded ? null : index)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{variant.name}</span>
                            {margin !== null && (
                              <span className="text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-px font-bold">
                                {margin}%
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-mono">{variant.sku}</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {formatCurrency(variant.salePrice)}
                            </span>
                            <span>Stock: {variant.stockQuantity}</span>
                          </div>
                        </div>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                        }
                      </button>

                      {/* Panel expandido */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <label className="col-span-2 space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                              SKU
                              <Input
                                className="mt-1 h-8 font-mono text-xs"
                                value={variant.sku}
                                onChange={(e) => updateVariant(index, { sku: e.target.value })}
                              />
                            </label>
                            <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                              Costo
                              <Input
                                className="mt-1 h-8 text-xs"
                                type="number"
                                min={0}
                                step="0.01"
                                value={variant.purchasePrice}
                                onChange={(e) => updateVariant(index, { purchasePrice: Number(e.target.value) })}
                              />
                            </label>
                            <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                              Precio Público
                              <Input
                                className="mt-1 h-8 text-xs font-semibold"
                                type="number"
                                min={0}
                                step="0.01"
                                value={variant.salePrice}
                                onChange={(e) => updateVariant(index, { salePrice: Number(e.target.value) })}
                              />
                            </label>
                            <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                              Mayorista
                              <Input
                                className="mt-1 h-8 text-xs"
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="—"
                                value={variant.wholesalePrice ?? ''}
                                onChange={(e) =>
                                  updateVariant(index, {
                                    wholesalePrice: e.target.value ? Number(e.target.value) : undefined,
                                  })
                                }
                              />
                            </label>
                            <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                              Stock
                              <Input
                                className="mt-1 h-8 text-xs"
                                type="number"
                                min={0}
                                value={variant.stockQuantity}
                                onChange={(e) => updateVariant(index, { stockQuantity: Number(e.target.value) })}
                              />
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar variante
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Resumen de stock total */}
              <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Stock total:</span>
                  <Badge variant="secondary" className="text-xs">
                    {value.variants.reduce((acc, v) => acc + (v.stockQuantity || 0), 0)} unidades
                  </Badge>
                </span>
                <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">·</span>
                <span className="hidden sm:inline">
                  Precio rango:&nbsp;
                  <strong className="text-slate-700 dark:text-slate-300">
                    {formatCurrency(Math.min(...value.variants.map((v) => v.salePrice)))}
                    {' – '}
                    {formatCurrency(Math.max(...value.variants.map((v) => v.salePrice)))}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

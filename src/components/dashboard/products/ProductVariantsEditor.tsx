'use client'

import { Plus, RefreshCw, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  return [...new Set(value.split(',').map((option) => option.trim()).filter(Boolean))]
}

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

  const updateAttribute = (index: number, patch: Partial<ProductAttributeDefinition>) => {
    const attributes = value.attributes.map((attribute, attributeIndex) => (
      attributeIndex === index ? { ...attribute, ...patch } : attribute
    ))
    onChange({ ...value, attributes })
  }

  const addSuggestion = (key: string) => {
    const suggestion = suggestions.find((item) => item.key === key)
    if (!suggestion || value.attributes.some((attribute) => attribute.key === suggestion.key)) return

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
    const variants = mergeGeneratedVariants(generated, value.variants, basePrices).map((variant, index) => ({
      ...variant,
      sku: variant.sku || `${baseSku.trim().toUpperCase() || 'VAR'}-${String(index + 1).padStart(2, '0')}`,
    }))
    onChange({ ...value, variants })
  }

  const updateVariant = (index: number, patch: Partial<ProductVariantsPayload['variants'][number]>) => {
    onChange({
      ...value,
      variants: value.variants.map((variant, variantIndex) => (
        variantIndex === index ? { ...variant, ...patch } : variant
      )),
    })
  }

  return (
    <section className="space-y-5" aria-labelledby="product-variants-title">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="product-variants-title" className="font-semibold text-slate-900 dark:text-slate-100">
              {copy.sectionTitle}
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{copy.sectionDescription}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-white p-1 shadow-sm dark:bg-slate-800">
            <Button
              type="button"
              size="sm"
              variant={!value.hasVariants ? 'default' : 'ghost'}
              disabled={disabled}
              onClick={() => onChange({ hasVariants: false, attributes: [], variants: [] })}
            >
              Producto simple
            </Button>
            <Button
              type="button"
              size="sm"
              variant={value.hasVariants ? 'default' : 'ghost'}
              disabled={disabled}
              onClick={() => onChange({ ...value, hasVariants: true })}
            >
              Producto con variantes
            </Button>
          </div>
        </div>
      </div>

      {value.hasVariants && (
        <>
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Sugerencias para tu rubro</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => {
                  const selected = value.attributes.some((attribute) => attribute.key === suggestion.key)
                  return (
                    <Button
                      key={suggestion.key}
                      type="button"
                      size="sm"
                      variant={selected ? 'secondary' : 'outline'}
                      disabled={disabled || selected}
                      onClick={() => addSuggestion(suggestion.key)}
                      aria-label={`${suggestion.label}${selected ? ' agregado' : ''}`}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      {suggestion.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {value.attributes.map((attribute, index) => (
              <div key={attribute.key} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(140px,0.7fr)_minmax(260px,1.5fr)_auto] md:items-end">
                <label className="space-y-1 text-sm font-medium">
                  Nombre
                  <Input
                    value={attribute.label}
                    disabled={disabled}
                    onChange={(event) => updateAttribute(index, { label: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Opciones separadas por coma
                  <Input
                    value={attribute.options.join(', ')}
                    disabled={disabled}
                    placeholder="Ej.: Negro, Blanco, Azul"
                    onChange={(event) => updateAttribute(index, { options: splitOptions(event.target.value) })}
                  />
                </label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Eliminar ${attribute.label}`}
                  onClick={() => onChange({
                    ...value,
                    attributes: value.attributes.filter((_, attributeIndex) => attributeIndex !== index),
                  })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" disabled={disabled} onClick={addCustomAttribute}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar atributo personalizado
              </Button>
              <Button
                type="button"
                disabled={disabled || value.attributes.length === 0}
                onClick={generate}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Generar combinaciones
              </Button>
            </div>
          </div>

          {value.variants.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Combinaciones vendibles</h4>
                <Badge variant="secondary">{value.variants.length} variantes</Badge>
              </div>

              <div className="hidden overflow-x-auto rounded-xl border md:block">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 text-left dark:bg-slate-800/70">
                    <tr>
                      <th className="p-3">Variante</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Costo</th>
                      <th className="p-3">Precio</th>
                      <th className="p-3">Mayorista</th>
                      <th className="p-3">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.variants.map((variant, index) => (
                      <tr key={variant.clientKey} className="border-t">
                        <td className="p-3 font-medium">{variant.name}</td>
                        <td className="p-2"><Input value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} /></td>
                        <td className="p-2"><Input type="number" min={0} value={variant.purchasePrice} onChange={(event) => updateVariant(index, { purchasePrice: Number(event.target.value) })} /></td>
                        <td className="p-2"><Input type="number" min={0} value={variant.salePrice} onChange={(event) => updateVariant(index, { salePrice: Number(event.target.value) })} /></td>
                        <td className="p-2"><Input type="number" min={0} value={variant.wholesalePrice ?? ''} onChange={(event) => updateVariant(index, { wholesalePrice: event.target.value ? Number(event.target.value) : undefined })} /></td>
                        <td className="p-2"><Input type="number" min={0} value={variant.stockQuantity} onChange={(event) => updateVariant(index, { stockQuantity: Number(event.target.value) })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {value.variants.map((variant, index) => (
                  <article key={variant.clientKey} className="space-y-3 rounded-xl border p-4">
                    <h5 className="font-semibold">{variant.name}</h5>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="col-span-2 text-xs font-medium">SKU<Input className="mt-1" value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} /></label>
                      <label className="text-xs font-medium">Precio<Input className="mt-1" type="number" min={0} value={variant.salePrice} onChange={(event) => updateVariant(index, { salePrice: Number(event.target.value) })} /></label>
                      <label className="text-xs font-medium">Stock<Input className="mt-1" type="number" min={0} value={variant.stockQuantity} onChange={(event) => updateVariant(index, { stockQuantity: Number(event.target.value) })} /></label>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

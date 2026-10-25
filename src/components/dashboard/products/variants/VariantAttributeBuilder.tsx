'use client'

import { useId, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ProductAttributeDefinition } from '@/lib/products/variant-contract'
import { normalizeVariantAttributeText } from '@/lib/products/variant-workflow'

export interface VariantAttributeBuilderProps {
  attributes: ProductAttributeDefinition[]
  onChange: (next: ProductAttributeDefinition[]) => void
  disabled?: boolean
}

function AttributeRow({ attribute, duplicateLabel, disabled, onChange, onRemove }: {
  attribute: ProductAttributeDefinition
  duplicateLabel: boolean
  disabled: boolean
  onChange: (next: ProductAttributeDefinition) => void
  onRemove: () => void
}) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const labelError = duplicateLabel ? 'Ya existe un atributo con este nombre.' : !attribute.label.trim() ? 'Escribí un nombre para el atributo.' : ''
  const addValue = () => {
    const value = draft.trim()
    if (!value) { setError('Escribí un valor.'); return }
    if (attribute.options.some(option => normalizeVariantAttributeText(option) === normalizeVariantAttributeText(value))) {
      setError('Este valor ya existe en el atributo.')
      return
    }
    onChange({ ...attribute, options: [...attribute.options, value] })
    setDraft('')
    setError('')
  }
  return <fieldset disabled={disabled} className="min-w-0 space-y-3 rounded-xl border bg-background p-4">
    <legend className="sr-only">Atributo {attribute.label || 'nuevo'}</legend>
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor={`${id}-label`} className="text-sm font-medium">Nombre del atributo</label>
        <Input id={`${id}-label`} value={attribute.label} placeholder="Ej.: Color, talle o memoria" aria-invalid={Boolean(labelError)} aria-describedby={labelError ? `${id}-label-error` : undefined} onChange={event => onChange({ ...attribute, label: event.target.value })} />
      </div>
      <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" aria-label={`Eliminar atributo ${attribute.label || 'nuevo'}`} onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
    </div>
    {labelError && <p id={`${id}-label-error`} role="alert" className="text-sm text-destructive">{labelError}</p>}
    <div className="flex flex-wrap gap-2" aria-label={`Valores de ${attribute.label || 'atributo'}`}>
      {attribute.options.map((option, index) => <span key={`${option}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm">
        <span className="break-all">{option}</span>
        <button type="button" disabled={disabled} className="rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Eliminar ${option} de ${attribute.label || 'atributo'}`} onClick={() => onChange({ ...attribute, options: attribute.options.filter((_, optionIndex) => optionIndex !== index) })}><X className="h-3.5 w-3.5" /></button>
      </span>)}
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input aria-label={`Nuevo valor para ${attribute.label || 'atributo'}`} placeholder="Escribí un valor y presioná Enter" value={draft} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-value-error` : undefined} onChange={event => { setDraft(event.target.value); setError('') }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addValue() } }} />
      <Button type="button" variant="outline" onClick={addValue}><Plus className="mr-2 h-4 w-4" />Agregar valor</Button>
    </div>
    {error && <p id={`${id}-value-error`} role="alert" className="text-sm text-destructive">{error}</p>}
  </fieldset>
}

export function VariantAttributeBuilder({ attributes, onChange, disabled = false }: VariantAttributeBuilderProps) {
  return <div className="space-y-3">
    {attributes.map((attribute, index) => <AttributeRow key={attribute.key} attribute={attribute} disabled={disabled} duplicateLabel={Boolean(attribute.label.trim()) && attributes.some((other, otherIndex) => otherIndex !== index && normalizeVariantAttributeText(other.label) === normalizeVariantAttributeText(attribute.label))} onChange={next => onChange(attributes.map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => onChange(attributes.filter((_, itemIndex) => itemIndex !== index))} />)}
    <Button type="button" variant="outline" disabled={disabled} onClick={() => {
      let suffix = 1
      while (attributes.some(attribute => attribute.key === `attribute_${suffix}`)) suffix++
      onChange([...attributes, { key: `attribute_${suffix}`, label: '', control: 'select', options: [] }])
    }}><Plus className="mr-2 h-4 w-4" />Agregar atributo</Button>
  </div>
}

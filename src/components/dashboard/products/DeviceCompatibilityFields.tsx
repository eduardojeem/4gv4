'use client'

/**
 * Para qué celular es el repuesto: marca y modelos.
 *
 * La marca del repuesto (quién fabricó la pieza) es otro campo. Acá va el
 * teléfono al que pertenece, que es por lo que se busca en el mostrador:
 * «¿tenés pantalla de iPhone 13?».
 *
 * Los modelos son etiquetas porque una pieza sirve para varios («For iPhone 12
 * / 12 Pro»). Las sugerencias salen de lo ya cargado y de las reparaciones del
 * taller, para que el mismo modelo no quede escrito de tres formas.
 */

import { useEffect, useMemo, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  MAX_MODELOS_POR_PRODUCTO,
  normalizeDeviceBrand,
  normalizeDeviceModel,
  normalizeDeviceModels,
} from '@/lib/products/device-compatibility'
import type { DeviceOptions } from '@/lib/products/device-options'

export interface DeviceCompatibilityFieldsProps {
  brand: string | null | undefined
  models: string[] | null | undefined
  onBrandChange: (brand: string) => void
  onModelsChange: (models: string[]) => void
  disabled?: boolean
  /** Se inyecta en los tests; en la app se piden a `/api/products/device-options`. */
  options?: DeviceOptions
}

const SUGERENCIAS_VISIBLES = 8

async function pedirOpciones(): Promise<DeviceOptions | null> {
  try {
    const respuesta = await fetch('/api/products/device-options', { cache: 'no-store' })
    const cuerpo = await respuesta.json().catch(() => null)
    return cuerpo?.success ? (cuerpo.data as DeviceOptions) : null
  } catch {
    return null
  }
}

export function DeviceCompatibilityFields({
  brand,
  models,
  onBrandChange,
  onModelsChange,
  disabled,
  options: opcionesDadas,
}: DeviceCompatibilityFieldsProps) {
  const [opcionesPedidas, setOpcionesPedidas] = useState<DeviceOptions | null>(null)
  const [escribiendo, setEscribiendo] = useState('')
  const lista = useMemo(() => models ?? [], [models])
  const marca = brand ?? ''

  useEffect(() => {
    if (opcionesDadas) return
    let vigente = true
    void pedirOpciones().then((opciones) => {
      if (vigente) setOpcionesPedidas(opciones)
    })
    return () => {
      vigente = false
    }
  }, [opcionesDadas])

  const opciones = opcionesDadas ?? opcionesPedidas
  const marcaNormalizada = normalizeDeviceBrand(marca)

  const marcasSugeridas = useMemo(
    () => (opciones?.brands ?? []).filter((m) => m !== marcaNormalizada).slice(0, SUGERENCIAS_VISIBLES),
    [opciones, marcaNormalizada],
  )

  // Los modelos de la marca elegida que todavía no están, filtrados por lo que se escribe.
  const modelosSugeridos = useMemo(() => {
    if (!marcaNormalizada) return []
    const yaEstan = new Set(lista.map((m) => m.toLowerCase()))
    const buscado = escribiendo.trim().toLowerCase()
    return (opciones?.modelsByBrand[marcaNormalizada] ?? [])
      .filter((m) => !yaEstan.has(m.toLowerCase()))
      .filter((m) => !buscado || m.toLowerCase().includes(buscado))
      .slice(0, SUGERENCIAS_VISIBLES)
  }, [opciones, marcaNormalizada, lista, escribiendo])

  const agregar = (valor: string) => {
    const modelo = normalizeDeviceModel(valor)
    if (!modelo) return
    onModelsChange(normalizeDeviceModels([...lista, modelo]))
    setEscribiendo('')
  }

  const quitar = (modelo: string) => onModelsChange(lista.filter((m) => m !== modelo))

  const lleno = lista.length >= MAX_MODELOS_POR_PRODUCTO

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold">¿Para qué celular es?</p>
        <span className="text-xs text-muted-foreground">Opcional · sirve para ordenar y buscar por modelo</span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="device-brand" className="text-xs font-semibold">Marca del celular</Label>
        <Input
          id="device-brand"
          value={marca}
          disabled={disabled}
          placeholder="Ej: Apple, Samsung, Xiaomi"
          onChange={(e) => onBrandChange(e.target.value)}
          // Al salir se unifica: «sansung» queda «Samsung».
          onBlur={() => onBrandChange(normalizeDeviceBrand(marca) ?? '')}
          className="h-9 rounded-lg text-sm"
          autoComplete="off"
        />
        {marcasSugeridas.length > 0 && !disabled && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {marcasSugeridas.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onBrandChange(m)}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-700 transition-colors hover:border-primary/50 hover:bg-primary/5 dark:border-slate-700 dark:text-slate-300"
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="device-models" className="text-xs font-semibold">
          Modelos del celular
        </Label>
        <div
          className={cn(
            'flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5',
            disabled && 'opacity-60',
          )}
        >
          {lista.map((modelo) => (
            <span
              key={modelo}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {modelo}
              {!disabled && (
                <button type="button" onClick={() => quitar(modelo)} aria-label={`Quitar ${modelo}`} className="rounded hover:bg-primary/20">
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
          <input
            id="device-models"
            value={escribiendo}
            disabled={disabled || lleno}
            onChange={(e) => setEscribiendo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                agregar(escribiendo)
              } else if (e.key === 'Backspace' && !escribiendo && lista.length) {
                quitar(lista[lista.length - 1])
              }
            }}
            onBlur={() => escribiendo.trim() && agregar(escribiendo)}
            placeholder={lista.length ? '' : 'Ej: iPhone 13 — Enter para agregar otro'}
            className="min-w-[10rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Si la pieza sirve para varios modelos, cargalos todos: aparece en la búsqueda de cada uno.
        </p>

        {modelosSugeridos.length > 0 && !disabled && !lleno && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-muted-foreground">Ya usados:</span>
            {modelosSugeridos.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => agregar(m)}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-700 transition-colors hover:border-primary/50 hover:bg-primary/5 dark:border-slate-700 dark:text-slate-300"
              >
                + {m}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

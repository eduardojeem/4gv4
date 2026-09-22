'use client'

/**
 * Filtrar el listado por el celular al que pertenece el repuesto.
 *
 * Las opciones son las que tienen algún producto cargado: marca del celular y,
 * elegida la marca, sus modelos. Si la base todavía no tiene las columnas (falta
 * la migración) el filtro no aparece, porque la API lo ignoraría y la lista no
 * cambiaría.
 */

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DeviceOptions } from '@/lib/products/device-options'

const TODAS = '__todas__'

type Opciones = DeviceOptions & { columnsReady?: boolean }

export interface DeviceFilterFieldsProps {
  deviceBrand?: string
  deviceModel?: string
  onChange: (cambios: { device_brand?: string; device_model?: string }) => void
  /** Se inyecta en los tests; en la app se piden a la API. */
  options?: Opciones
}

export function DeviceFilterFields({ deviceBrand, deviceModel, onChange, options: dadas }: DeviceFilterFieldsProps) {
  const [pedidas, setPedidas] = useState<Opciones | null>(null)

  useEffect(() => {
    if (dadas) return
    let vigente = true
    void fetch('/api/products/device-options?scope=products', { cache: 'no-store' })
      .then((r) => r.json())
      .then((cuerpo) => {
        if (vigente && cuerpo?.success) setPedidas(cuerpo.data as Opciones)
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [dadas])

  const opciones = dadas ?? pedidas
  if (!opciones || opciones.columnsReady === false || opciones.brands.length === 0) return null

  const modelos = deviceBrand ? opciones.modelsByBrand[deviceBrand] ?? [] : []

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="device-brand-filter" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Marca del celular
        </Label>
        <Select
          value={deviceBrand || TODAS}
          // Cambiar de marca limpia el modelo: un «iPhone 13» no existe en Samsung.
          onValueChange={(valor) =>
            onChange({ device_brand: valor === TODAS ? undefined : valor, device_model: undefined })
          }
        >
          <SelectTrigger id="device-brand-filter" className="h-9 text-xs">
            <SelectValue placeholder="Todos los celulares" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todos los celulares</SelectItem>
            {opciones.brands.map((marca) => (
              <SelectItem key={marca} value={marca}>
                {marca}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {deviceBrand && modelos.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="device-model-filter" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Modelo del celular
          </Label>
          <Select
            value={deviceModel || TODAS}
            onValueChange={(valor) => onChange({ device_model: valor === TODAS ? undefined : valor })}
          >
            <SelectTrigger id="device-model-filter" className="h-9 text-xs">
              <SelectValue placeholder={`Todos los ${deviceBrand}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todos los {deviceBrand}</SelectItem>
              {modelos.map((modelo) => (
                <SelectItem key={modelo} value={modelo}>
                  {modelo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )
}

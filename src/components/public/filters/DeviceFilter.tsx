'use client'

/**
 * Buscar repuestos por el celular, no por la marca del repuesto.
 *
 * En un local de reparación el cliente llega diciendo «tengo un iPhone 13»:
 * no sabe —ni le importa— si la pantalla es AmpSentrix o Aftermarket. Por eso
 * este filtro va primero en el panel, antes que categorías y marcas.
 *
 * Marca y modelo se eligen en un menú con submenú (ver [DeviceMenu]) en vez de
 * una nube de chips: el panel lateral mide 208px y diez marcas con sus modelos
 * lo llenaban entero antes de llegar a las categorías.
 */

import { Smartphone } from 'lucide-react'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { DeviceMenu } from './DeviceMenu'
import type { DeviceOptions } from '@/lib/products/device-options'

interface DeviceFilterProps {
  facets: DeviceOptions
  selectedBrand: string
  selectedModel: string
  /** `celular` es la marca del teléfono; `modelo`, el modelo. */
  onChange: (updates: { celular?: string | null; modelo?: string | null }) => void
}

export function DeviceFilter({ facets, selectedBrand, selectedModel, onChange }: DeviceFilterProps) {
  if (facets.brands.length === 0) return null

  const activos = (selectedBrand ? 1 : 0) + (selectedModel ? 1 : 0)

  return (
    <AccordionItem value="device" className="border-b border-border/50 px-3">
      <AccordionTrigger className="hover:no-underline py-3.5 text-sm font-medium">
        <span className="flex items-center justify-between w-full pr-2">
          <span className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Tu celular</span>
          </span>
          {/* Solo el numero: el panel mide 208px y «2 activos» partia el titulo en dos lineas. */}
          {activos > 0 && (
            <span
              className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
              title={activos === 1 ? '1 filtro de celular activo' : `${activos} filtros de celular activos`}
            >
              {activos}
            </span>
          )}
        </span>
      </AccordionTrigger>

      <AccordionContent className="pb-3.5 space-y-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Elegí la marca y el modelo de tu teléfono para ver sólo los repuestos que le sirven.
        </p>

        <DeviceMenu
          facets={facets}
          selectedBrand={selectedBrand}
          selectedModel={selectedModel}
          onSelect={onChange}
          fullWidth
        />
      </AccordionContent>
    </AccordionItem>
  )
}

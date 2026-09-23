'use client'

/**
 * El celular, arriba y al lado de «Relevancia».
 *
 * Estaba dentro de la franja de marcas, que se desplaza: en el teléfono el
 * filtro más importante del catálogo quedaba escondido detrás de un gesto. En
 * la fila de arriba, junto a la sucursal y el orden, es de los primeros
 * controles que se ven.
 */

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DeviceMenu } from '@/components/public/filters/DeviceMenu'
import type { DeviceOptions } from '@/lib/products/device-options'

export function DeviceSelect({ facets }: { facets: DeviceOptions }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  if (facets.brands.length === 0) return null

  /** El menú manda marca y modelo juntos: cambiar de marca limpia el modelo. */
  const handleSelect = (updates: { celular?: string | null; modelo?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [clave, valor] of Object.entries(updates)) {
      if (valor) params.set(clave, valor)
      else params.delete(clave)
    }
    params.set('page', '1')
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <DeviceMenu
      facets={facets}
      selectedBrand={searchParams.get('celular') || ''}
      selectedModel={searchParams.get('modelo') || ''}
      onSelect={handleSelect}
    />
  )
}

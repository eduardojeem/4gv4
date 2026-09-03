'use client'

import { useEffect, useRef, useState } from 'react'
import { normalizeTenantSlug, validateTenantSlug, type TenantSlugProblem } from '@/lib/saas/reserved-slugs'

/**
 * Verifica la direccion de la tienda mientras se escribe.
 *
 * Antes la colision se descubria al enviar el formulario completo, y como el
 * captcha se reinicia en cada intento fallido, corregir el subdominio obligaba a
 * resolverlo de nuevo.
 */
export type SlugAvailabilityState =
  | { estado: 'vacio' }
  | { estado: 'consultando'; slug: string }
  | { estado: 'libre'; slug: string }
  | { estado: 'ocupado'; slug: string; mensaje: string; sugerencia: string | null }
  | { estado: 'invalido'; slug: string; mensaje: string; razon: TenantSlugProblem; sugerencia: string | null }
  | { estado: 'error'; slug: string; mensaje: string }

const ESPERA_MS = 450

export function useSlugAvailability(valor: string): SlugAvailabilityState {
  const [state, setState] = useState<SlugAvailabilityState>({ estado: 'vacio' })

  // Cada consulta lleva su numero: si dos salen juntas, la respuesta vieja no
  // puede pisar a la nueva y dejar el campo diciendo lo contrario de lo que hay.
  const secuenciaRef = useRef(0)

  useEffect(() => {
    const slug = normalizeTenantSlug(valor)

    if (!slug) {
      setState({ estado: 'vacio' })
      return
    }

    // El formato se resuelve sin salir a la red: no tiene sentido consultar por
    // un slug que igual va a ser rechazado.
    const formato = validateTenantSlug(slug)
    if (formato.ok === false) {
      setState({
        estado: 'invalido',
        slug,
        mensaje: formato.message,
        razon: formato.reason,
        sugerencia: formato.reason === 'reserved' ? `${slug}-tienda` : null,
      })
      return
    }

    const secuencia = ++secuenciaRef.current
    setState({ estado: 'consultando', slug })

    const control = new AbortController()
    const temporizador = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-slug?slug=${encodeURIComponent(slug)}`, {
          signal: control.signal,
        })

        if (secuencia !== secuenciaRef.current) return

        if (!res.ok) {
          // Sin respuesta util no se puede afirmar que esta libre: decirlo
          // llevaria al usuario a completar el formulario para chocar al final.
          setState({ estado: 'error', slug, mensaje: 'No pudimos verificarla. Se revisa al crear la cuenta.' })
          return
        }

        const payload = await res.json() as {
          available: boolean
          reason?: string
          message?: string
          suggestion?: string | null
        }

        if (secuencia !== secuenciaRef.current) return

        if (payload.available) {
          setState({ estado: 'libre', slug })
          return
        }

        setState({
          estado: 'ocupado',
          slug,
          mensaje: payload.message || 'Esa dirección ya está en uso.',
          sugerencia: payload.suggestion ?? null,
        })
      } catch (error) {
        if (control.signal.aborted || secuencia !== secuenciaRef.current) return
        setState({ estado: 'error', slug, mensaje: 'No pudimos verificarla. Se revisa al crear la cuenta.' })
      }
    }, ESPERA_MS)

    return () => {
      window.clearTimeout(temporizador)
      control.abort()
    }
  }, [valor])

  return state
}

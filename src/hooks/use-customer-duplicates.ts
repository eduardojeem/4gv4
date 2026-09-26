'use client'

import { useEffect, useState } from 'react'
import { normalizePhone } from '@/lib/customers/contact-rules'
import {
  normalizeDocument,
  normalizeEmail,
  type CustomerDuplicate,
} from '@/lib/customers/duplicate-check'

/**
 * Avisa mientras se escribe si el telefono, el correo o el RUC ya estan cargados
 * en otro cliente de la empresa.
 *
 * Descubrirlo recien al guardar significa haber llenado el formulario entero
 * para nada, y en la practica lleva a cambiar un digito para que "entre" — que
 * es como se termina con la misma persona cargada dos veces.
 *
 * El aviso no bloquea nada por si mismo: el alta la rechaza el servidor. Aca solo
 * se adelanta.
 */

const ESPERA_MS = 350
/** Debajo de esto no vale la pena preguntar: todavia lo estan escribiendo. */
const MIN_PHONE_DIGITOS = 6
const MIN_RUC_DIGITOS = 4
const NO_DUPLICATES: CustomerDuplicate[] = []

export type DuplicateCheckInput = {
  phone?: string
  email?: string
  ruc?: string
  excludeId?: string | null
}

export function useCustomerDuplicates(input: DuplicateCheckInput): CustomerDuplicate[] {
  const [result, setResult] = useState<{ query: string; duplicates: CustomerDuplicate[] } | null>(null)

  const phone = normalizePhone(input.phone)
  const email = normalizeEmail(input.email)
  const ruc = normalizeDocument(input.ruc)
  const excludeId = input.excludeId ?? ''

  const params = new URLSearchParams()
  if (phone.length >= MIN_PHONE_DIGITOS) params.set('phone', phone)
  // Un correo a medio escribir no sirve para comparar.
  if (email.includes('@') && email.includes('.')) params.set('email', email)
  if (ruc.length >= MIN_RUC_DIGITOS) params.set('ruc', ruc)
  if (excludeId) params.set('excludeId', excludeId)
  const query = params.has('phone') || params.has('email') || params.has('ruc') ? params.toString() : ''

  useEffect(() => {
    if (!query) return
    const controlador = new AbortController()

    const temporizador = setTimeout(async () => {
      try {
        const response = await fetch(`/api/customers/check-duplicate?${query}`, {
          signal: controlador.signal,
        })
        const body = await response.json().catch(() => null)
        if (controlador.signal.aborted) return
        setResult({ query, duplicates: Array.isArray(body?.duplicates) ? body.duplicates : [] })
      } catch {
        // Sin red o consulta cancelada: se sigue sin aviso anticipado y el
        // guardado avisa igual. Marcar un duplicado que no se pudo comprobar
        // seria peor que no decir nada.
        if (!controlador.signal.aborted) setResult({ query, duplicates: [] })
      }
    }, ESPERA_MS)

    return () => {
      clearTimeout(temporizador)
      controlador.abort()
    }
  }, [query])

  return result?.query === query ? result.duplicates : NO_DUPLICATES
}

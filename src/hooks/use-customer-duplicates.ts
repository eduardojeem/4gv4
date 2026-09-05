'use client'

import { useEffect, useRef, useState } from 'react'
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

const ESPERA_MS = 500
/** Debajo de esto no vale la pena preguntar: todavia lo estan escribiendo. */
const MIN_DIGITOS = 6

export type DuplicateCheckInput = {
  phone?: string
  email?: string
  ruc?: string
  excludeId?: string | null
}

export function useCustomerDuplicates(input: DuplicateCheckInput): CustomerDuplicate[] {
  const [duplicates, setDuplicates] = useState<CustomerDuplicate[]>([])

  // Cada consulta lleva su numero: si dos salen juntas, la respuesta vieja no
  // puede pisar a la nueva y dejar el aviso diciendo lo contrario de lo que hay.
  const secuenciaRef = useRef(0)

  const phone = normalizePhone(input.phone)
  const email = normalizeEmail(input.email)
  const ruc = normalizeDocument(input.ruc)
  const excludeId = input.excludeId ?? ''

  useEffect(() => {
    const params = new URLSearchParams()
    if (phone.length >= MIN_DIGITOS) params.set('phone', phone)
    // Un correo a medio escribir no sirve para comparar.
    if (email.includes('@') && email.includes('.')) params.set('email', email)
    if (ruc.length >= MIN_DIGITOS) params.set('ruc', ruc)
    if (excludeId) params.set('excludeId', excludeId)

    if (!params.has('phone') && !params.has('email') && !params.has('ruc')) {
      setDuplicates([])
      return
    }

    const secuencia = ++secuenciaRef.current
    const controlador = new AbortController()

    const temporizador = setTimeout(async () => {
      try {
        const response = await fetch(`/api/customers/check-duplicate?${params.toString()}`, {
          signal: controlador.signal,
        })
        const body = await response.json().catch(() => null)
        if (secuencia !== secuenciaRef.current) return
        setDuplicates(Array.isArray(body?.duplicates) ? body.duplicates : [])
      } catch {
        // Sin red o consulta cancelada: se sigue sin aviso anticipado y el
        // guardado avisa igual. Marcar un duplicado que no se pudo comprobar
        // seria peor que no decir nada.
        if (secuencia === secuenciaRef.current) setDuplicates([])
      }
    }, ESPERA_MS)

    return () => {
      clearTimeout(temporizador)
      controlador.abort()
    }
  }, [phone, email, ruc, excludeId])

  return duplicates
}

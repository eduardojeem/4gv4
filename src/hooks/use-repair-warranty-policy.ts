'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_RECEIPT_SETTINGS,
  type RepairReceiptSettings,
} from '@/lib/repairs/receipt-settings'

/**
 * La garantía por defecto del taller, en un solo lugar.
 *
 * Habia tres pantallas configurando lo mismo:
 *
 *   1. El dialogo del comprobante, que guarda en
 *      `organization_settings.repair_receipt_settings` — por empresa, en la base,
 *      y es lo que ya usa el comprobante impreso.
 *   2. /dashboard/repairs/settings → «Garantías», que escribia en
 *      `localStorage.repair_default_warranty_*`.
 *   3. El formulario de nueva reparacion, que leia y escribia
 *      `localStorage.4g_default_repair_warranty`.
 *
 * Las tres claves eran distintas y ninguna miraba a las otras: configurar la
 * politica en Ajustes no cambiaba nada en el formulario, y lo que se guardaba
 * desde el formulario vivia en ese navegador. Un local con dos computadoras
 * tenia dos politicas, y un empleado nuevo empezaba siempre en 3 meses.
 *
 * Este hook deja la (1) como unica fuente: ya estaba en la base, por empresa, y
 * es la que honra el comprobante que firma el cliente.
 */

export type WarrantyPolicy = {
  months: number
  type: 'labor' | 'parts' | 'full'
  notes: string
}

export const FALLBACK_WARRANTY_POLICY: WarrantyPolicy = {
  months: DEFAULT_RECEIPT_SETTINGS.defaultWarrantyMonths,
  type: DEFAULT_RECEIPT_SETTINGS.defaultWarrantyType,
  notes: DEFAULT_RECEIPT_SETTINGS.defaultWarrantyNotes,
}

/** Claves viejas, solo para no perder lo que el taller ya habia configurado. */
const LEGACY_KEYS = {
  months: 'repair_default_warranty_months',
  type: 'repair_default_warranty_type',
  notes: 'repair_default_warranty_notes',
  blob: '4g_default_repair_warranty',
} as const

/**
 * Lo que quedo en el navegador de las dos versiones anteriores. Se usa una sola
 * vez, cuando la empresa todavia no guardo nada en la base: sin esto, un taller
 * que habia puesto 6 meses volvia a 3 sin aviso.
 */
function readLegacyPolicy(): Partial<WarrantyPolicy> {
  if (typeof window === 'undefined') return {}
  const found: Partial<WarrantyPolicy> = {}

  try {
    const months = Number(localStorage.getItem(LEGACY_KEYS.months))
    if (Number.isFinite(months) && months >= 0) found.months = months
    const type = localStorage.getItem(LEGACY_KEYS.type)
    if (type === 'labor' || type === 'parts' || type === 'full') found.type = type
    const notes = localStorage.getItem(LEGACY_KEYS.notes)
    if (notes) found.notes = notes
  } catch { /* almacenamiento bloqueado: se sigue sin migrar */ }

  if (found.months === undefined) {
    try {
      const raw = localStorage.getItem(LEGACY_KEYS.blob)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (typeof parsed?.months === 'number') found.months = parsed.months
        if (parsed?.type === 'labor' || parsed?.type === 'parts' || parsed?.type === 'full') found.type = parsed.type
        if (typeof parsed?.notes === 'string' && parsed.notes) found.notes = parsed.notes
      }
    } catch { /* json corrupto: se ignora */ }
  }

  return found
}

export type RepairWarrantyPolicyState = {
  policy: WarrantyPolicy
  loading: boolean
  /** Solo `settings.manage` puede cambiar la politica del taller. */
  canEdit: boolean
  /** false = la empresa todavia no la guardo; lo que se ve es un valor sugerido. */
  persisted: boolean
  error: string | null
  save: (next: WarrantyPolicy) => Promise<{ ok: boolean; error?: string }>
}

export function useRepairWarrantyPolicy(enabled = true): RepairWarrantyPolicyState {
  const [policy, setPolicy] = useState<WarrantyPolicy>(FALLBACK_WARRANTY_POLICY)
  const [loading, setLoading] = useState(enabled)
  const [canEdit, setCanEdit] = useState(false)
  const [persisted, setPersisted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * El comprobante completo, tal como esta guardado. Guardar solo los campos de
   * garantia no alcanza: la API normaliza contra los valores por defecto, no
   * contra lo guardado, asi que un PUT parcial resetearia el formato de papel,
   * el logo y el texto legal.
   */
  const settingsRef = useRef<RepairReceiptSettings>(DEFAULT_RECEIPT_SETTINGS)

  useEffect(() => {
    if (!enabled) return
    let vigente = true

    void (async () => {
      try {
        const response = await fetch('/api/repairs/receipt-settings')
        const body = await response.json().catch(() => null)
        if (!vigente) return

        if (!response.ok || !body?.success || !body.data) {
          setError('No se pudo cargar la garantía predeterminada del taller.')
          setLoading(false)
          return
        }

        const settings = body.data as RepairReceiptSettings
        settingsRef.current = settings
        setCanEdit(Boolean(body.canEdit))
        setPersisted(Boolean(body.persisted))

        const desdeServidor: WarrantyPolicy = {
          months: settings.defaultWarrantyMonths,
          type: settings.defaultWarrantyType,
          notes: settings.defaultWarrantyNotes,
        }

        setPolicy(body.persisted ? desdeServidor : { ...desdeServidor, ...readLegacyPolicy() })
        setLoading(false)
      } catch {
        if (vigente) {
          setError('No se pudo cargar la garantía predeterminada del taller.')
          setLoading(false)
        }
      }
    })()

    return () => { vigente = false }
  }, [enabled])

  const save = useCallback(async (next: WarrantyPolicy) => {
    try {
      const response = await fetch('/api/repairs/receipt-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            ...settingsRef.current,
            defaultWarrantyMonths: next.months,
            defaultWarrantyType: next.type,
            defaultWarrantyNotes: next.notes,
          },
        }),
      })

      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        return {
          ok: false,
          error: body?.error
            || (response.status === 403
              ? 'Solo un administrador puede cambiar la garantía del taller.'
              : 'No se pudo guardar la garantía predeterminada.'),
        }
      }

      settingsRef.current = body.data as RepairReceiptSettings
      setPolicy(next)
      setPersisted(true)
      return { ok: true }
    } catch {
      return { ok: false, error: 'No se pudo guardar la garantía predeterminada.' }
    }
  }, [])

  return { policy, loading, canEdit, persisted, error, save }
}

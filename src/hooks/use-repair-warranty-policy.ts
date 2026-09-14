'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_RECEIPT_SETTINGS,
  type RepairReceiptSettings,
} from '@/lib/repairs/receipt-settings'
import { clampWarrantyMonths, isWarrantyType, type WarrantyType } from '@/lib/repairs/warranty'
import {
  patchReceiptSettings,
  refreshReceiptSettings,
  subscribeReceiptSettings,
} from '@/lib/repair-receipt'

/**
 * La garantía por defecto del taller, en un solo lugar.
 *
 * Había tres pantallas configurando lo mismo, cada una con su clave de
 * localStorage y sin mirar a las otras. Este hook deja como única fuente la
 * configuración del comprobante (`organization_settings.repair_receipt_settings`):
 * está en la base, por empresa, y es la que honra el comprobante que firma el
 * cliente.
 *
 * Guarda solo los tres campos de garantía. Antes mandaba la configuración entera
 * leída al abrir: si esa lectura había fallado, mandaba los valores de fábrica y
 * reseteaba el papel, el logo y el texto legal de toda la empresa.
 */

export type WarrantyPolicy = {
  months: number
  type: WarrantyType
  notes: string
}

export const FALLBACK_WARRANTY_POLICY: WarrantyPolicy = {
  months: DEFAULT_RECEIPT_SETTINGS.defaultWarrantyMonths,
  type: DEFAULT_RECEIPT_SETTINGS.defaultWarrantyType,
  notes: DEFAULT_RECEIPT_SETTINGS.defaultWarrantyNotes,
}

/** Claves viejas, solo para no perder lo que el taller ya había configurado. */
const LEGACY_KEYS = {
  months: 'repair_default_warranty_months',
  type: 'repair_default_warranty_type',
  notes: 'repair_default_warranty_notes',
  blob: '4g_default_repair_warranty',
} as const

/**
 * Lo que quedó en el navegador de las versiones anteriores. Se usa solo cuando
 * la empresa todavía no guardó nada en la base: sin esto, un taller que había
 * puesto 6 meses volvía a 3 sin aviso.
 */
function readLegacyPolicy(): Partial<WarrantyPolicy> {
  if (typeof window === 'undefined') return {}
  const found: Partial<WarrantyPolicy> = {}

  try {
    const rawMonths = localStorage.getItem(LEGACY_KEYS.months)
    if (rawMonths !== null && rawMonths !== '') found.months = clampWarrantyMonths(rawMonths)
    const type = localStorage.getItem(LEGACY_KEYS.type)
    if (isWarrantyType(type)) found.type = type
    const notes = localStorage.getItem(LEGACY_KEYS.notes)
    if (notes) found.notes = notes
  } catch { /* almacenamiento bloqueado: se sigue sin migrar */ }

  if (found.months === undefined) {
    try {
      const raw = localStorage.getItem(LEGACY_KEYS.blob)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (typeof parsed?.months === 'number') found.months = clampWarrantyMonths(parsed.months)
        if (isWarrantyType(parsed?.type)) found.type = parsed.type
        if (typeof parsed?.notes === 'string' && parsed.notes) found.notes = parsed.notes
      }
    } catch { /* json corrupto: se ignora */ }
  }

  return found
}

function policyFrom(settings: RepairReceiptSettings): WarrantyPolicy {
  return {
    months: settings.defaultWarrantyMonths,
    type: settings.defaultWarrantyType,
    notes: settings.defaultWarrantyNotes,
  }
}

export type RepairWarrantyPolicyState = {
  policy: WarrantyPolicy
  loading: boolean
  /** Solo `settings.manage` puede cambiar la política del taller. */
  canEdit: boolean
  /** false = la empresa todavía no la guardó; lo que se ve es un valor sugerido. */
  persisted: boolean
  error: string | null
  save: (next: WarrantyPolicy) => Promise<{ ok: boolean; error?: string }>
}

export function useRepairWarrantyPolicy(enabled = true): RepairWarrantyPolicyState {
  const [policy, setPolicy] = useState<WarrantyPolicy>(FALLBACK_WARRANTY_POLICY)
  // Empieza cargando aunque el consumidor se monte cerrado. Al abrir el modal
  // por primera vez no debe existir un render que exponga el respaldo como real.
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [persisted, setPersisted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let vigente = true

    // El hook suele montarse con el diálogo cerrado (`enabled = false`). Al
    // abrirlo se vuelve a entrar en carga antes de exponer el respaldo de 3
    // meses; si no, el formulario lo toma como definitivo y ya no aplica la
    // política real cuando llega del servidor.
    // Se difiere al microtask para no encadenar un render sincrónico dentro
    // del efecto. La carga queda marcada antes de que pueda resolverse la
    // petición iniciada debajo.
    void Promise.resolve().then(() => {
      if (!vigente) return
      setLoading(true)
      setError(null)
    })

    void refreshReceiptSettings({ force: true }).then((snapshot) => {
      if (!vigente) return
      if (!snapshot) {
        setError('No se pudo cargar la garantía predeterminada del taller.')
        setLoading(false)
        return
      }
      setCanEdit(snapshot.canEdit)
      setPersisted(snapshot.persisted)
      const desdeServidor = policyFrom(snapshot.settings)
      setPolicy(snapshot.persisted ? desdeServidor : { ...desdeServidor, ...readLegacyPolicy() })
      setLoading(false)
    })

    return () => { vigente = false }
  }, [enabled])

  // Si otra pantalla guarda —el diálogo del comprobante, Ajustes u otra
  // pestaña—, la política que muestra esta se actualiza sola.
  useEffect(() => {
    if (!enabled) return
    return subscribeReceiptSettings((settings) => setPolicy(policyFrom(settings)))
  }, [enabled])

  const save = useCallback(async (next: WarrantyPolicy) => {
    const result = await patchReceiptSettings({
      defaultWarrantyMonths: clampWarrantyMonths(next.months),
      defaultWarrantyType: next.type,
      defaultWarrantyNotes: next.notes,
    })

    if ('error' in result) {
      return {
        ok: false,
        error: result.status === 403
          ? 'Solo un administrador puede cambiar la garantía del taller.'
          : result.error || 'No se pudo guardar la garantía predeterminada.',
      }
    }

    setPolicy(policyFrom(result.settings))
    setPersisted(true)
    setError(null)
    return { ok: true }
  }, [])

  return { policy, loading, canEdit, persisted, error, save }
}

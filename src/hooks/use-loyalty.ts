'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

export interface LoyaltySettingsRow {
  organization_id: string
  enabled: boolean
  currency_per_point: number
  points_per_unit: number
  rounding: 'floor' | 'round'
  max_points_per_customer_per_day: number | null
  points_expiration_months: number | null
}

export interface PointRuleRow {
  id: string
  name: string
  description: string | null
  starts_at: string
  ends_at: string
  kind: 'multiplier' | 'bonus_per_purchase'
  multiplier: number
  bonus_points: number
  max_bonus_points_per_customer: number | null
  max_bonus_points_total: number | null
  awarded_bonus_points: number
  min_purchase_amount: number | null
  is_active: boolean
}

export interface RaffleRow {
  id: string
  name: string
  description: string | null
  prizes: Array<{ position: number; title: string; details?: string }>
  requirements: string | null
  terms: string | null
  starts_at: string
  ends_at: string
  points_per_ticket: number
  max_tickets_per_customer: number | null
  max_tickets_total: number
  status: 'draft' | 'published' | 'closed' | 'completed' | 'cancelled'
  min_age: number
  drawn_at: string | null
  draw_seed: string | null
  tickets?: Array<{ count: number }>
  winners?: Array<{ count: number }>
}

export const DEFAULT_LOYALTY_SETTINGS: Omit<LoyaltySettingsRow, 'organization_id'> = {
  enabled: false,
  currency_per_point: 10_000,
  points_per_unit: 1,
  rounding: 'floor',
  max_points_per_customer_per_day: null,
  points_expiration_months: null,
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}))
}

/** Toma el primer mensaje útil de una respuesta de error de la API. */
function errorMessage(payload: unknown, fallback: string): string {
  const body = payload as { error?: string; details?: Array<{ message?: string }> } | null
  const detail = body?.details?.[0]?.message
  return detail || body?.error || fallback
}

/**
 * Configuración de puntos, promociones temporales y sorteos.
 *
 * `moduleInstalled` en false significa que falta correr la migración: la
 * sección lo dice en vez de mostrar un error genérico.
 */
export function useLoyalty() {
  const [settings, setSettings] = useState<LoyaltySettingsRow | null>(null)
  const [rules, setRules] = useState<PointRuleRow[]>([])
  const [raffles, setRaffles] = useState<RaffleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [moduleInstalled, setModuleInstalled] = useState(true)
  const [moduleMessage, setModuleMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, rulesRes, rafflesRes] = await Promise.all([
        fetch('/api/loyalty/settings', { cache: 'no-store' }),
        fetch('/api/loyalty/rules', { cache: 'no-store' }),
        fetch('/api/raffles', { cache: 'no-store' }),
      ])

      const [settingsBody, rulesBody, rafflesBody] = await Promise.all([
        readJson(settingsRes),
        readJson(rulesRes),
        readJson(rafflesRes),
      ])

      const missing = [settingsBody, rulesBody, rafflesBody].find(
        (body) => body && body.moduleInstalled === false
      )

      if (missing) {
        setModuleInstalled(false)
        setModuleMessage(missing.message ?? null)
        setSettings(null)
        setRules([])
        setRaffles([])
        return
      }

      setModuleInstalled(true)
      setModuleMessage(null)
      setSettings(settingsBody?.settings ?? null)
      setRules(rulesBody?.rules ?? [])
      setRaffles(rafflesBody?.raffles ?? [])
    } catch (error) {
      console.error('No se pudo cargar puntos y sorteos', error)
      toast.error('No se pudo cargar puntos y sorteos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveSettings = useCallback(async (values: Omit<LoyaltySettingsRow, 'organization_id'>) => {
    const response = await fetch('/api/loyalty/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const body = await readJson(response)

    if (!response.ok) {
      toast.error(errorMessage(body, 'No se pudo guardar la configuración'))
      return false
    }

    setSettings(body.settings)
    toast.success('Configuración de puntos guardada')
    return true
  }, [])

  const createRule = useCallback(async (values: Record<string, unknown>) => {
    const response = await fetch('/api/loyalty/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const body = await readJson(response)

    if (!response.ok) {
      toast.error(errorMessage(body, 'No se pudo crear la promoción de puntos'))
      return false
    }

    setRules((current) => [body.rule, ...current])
    toast.success('Promoción de puntos creada')
    return true
  }, [])

  const toggleRule = useCallback(async (id: string, isActive: boolean) => {
    const response = await fetch(`/api/loyalty/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    })
    const body = await readJson(response)

    if (!response.ok) {
      toast.error(errorMessage(body, 'No se pudo actualizar la promoción'))
      return false
    }

    setRules((current) => current.map((rule) => (rule.id === id ? body.rule : rule)))
    return true
  }, [])

  const deleteRule = useCallback(async (id: string) => {
    const response = await fetch(`/api/loyalty/rules/${id}`, { method: 'DELETE' })

    if (!response.ok) {
      toast.error(errorMessage(await readJson(response), 'No se pudo eliminar la promoción'))
      return false
    }

    setRules((current) => current.filter((rule) => rule.id !== id))
    toast.success('Promoción eliminada')
    return true
  }, [])

  const createRaffle = useCallback(async (values: Record<string, unknown>) => {
    const response = await fetch('/api/raffles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const body = await readJson(response)

    if (!response.ok) {
      toast.error(errorMessage(body, 'No se pudo crear el sorteo'))
      return false
    }

    setRaffles((current) => [body.raffle, ...current])
    toast.success('Sorteo creado')
    return true
  }, [])

  const updateRaffleStatus = useCallback(async (id: string, status: RaffleRow['status']) => {
    const response = await fetch(`/api/raffles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const body = await readJson(response)

    if (!response.ok) {
      toast.error(errorMessage(body, 'No se pudo cambiar el estado del sorteo'))
      return false
    }

    setRaffles((current) => current.map((raffle) => (raffle.id === id ? { ...raffle, ...body.raffle } : raffle)))
    return true
  }, [])

  const drawRaffle = useCallback(async (id: string) => {
    const response = await fetch(`/api/raffles/${id}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const body = await readJson(response)

    if (!response.ok) {
      toast.error(errorMessage(body, 'No se pudo realizar el sorteo'))
      return null
    }

    toast.success('Sorteo realizado')
    await refresh()
    return body.winners as Array<{ prize_position: number; prize_title: string; customer_id: string }>
  }, [refresh])

  return {
    settings,
    rules,
    raffles,
    loading,
    moduleInstalled,
    moduleMessage,
    refresh,
    saveSettings,
    createRule,
    toggleRule,
    deleteRule,
    createRaffle,
    updateRaffleStatus,
    drawRaffle,
  }
}

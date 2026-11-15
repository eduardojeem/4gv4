'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTenantScope } from '@/hooks/use-tenant-scope'

import { type LoyaltySettingsRow, type PointRuleRow, type RaffleRow } from '@/lib/loyalty/contracts'
export { DEFAULT_LOYALTY_SETTINGS } from '@/lib/loyalty/contracts'
export type { LoyaltySettingsRow, PointRuleRow, RaffleRow } from '@/lib/loyalty/contracts'

async function readJson(response: Response) {
  return response.json().catch(() => ({}))
}

/** Las mutaciones conservan el borrador y muestran un error también sin conexión. */
async function mutationFetch(input: string, options: RequestInit) {
  try { return await fetch(input, options) } catch {
    return new Response(JSON.stringify({ error: 'No se pudo conectar. Revisá tu conexión e intentá de nuevo.' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  }
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
  const { organizationId } = useTenantScope()
  const scopedFetch = useCallback((input: string, options: RequestInit = {}) => mutationFetch(input, {
    ...options,
    headers: { ...options.headers, ...(organizationId ? { 'x-organization-id': organizationId } : {}) },
  }), [organizationId])
  const [settings, setSettings] = useState<LoyaltySettingsRow | null>(null)
  const [rules, setRules] = useState<PointRuleRow[]>([])
  const [raffles, setRaffles] = useState<RaffleRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [serviceVisitsReady, setServiceVisitsReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [moduleInstalled, setModuleInstalled] = useState(true)
  const [moduleMessage, setModuleMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [settingsRes, rulesRes, rafflesRes] = await Promise.all([
        scopedFetch('/api/loyalty/settings', { cache: 'no-store' }),
        scopedFetch('/api/loyalty/rules', { cache: 'no-store' }),
        scopedFetch('/api/raffles', { cache: 'no-store' }),
      ])

      const [settingsBody, rulesBody, rafflesBody] = await Promise.all([
        readJson(settingsRes),
        readJson(rulesRes),
        readJson(rafflesRes),
      ])

      const failed = [settingsRes, rulesRes, rafflesRes].findIndex((res) => !res.ok)
      if (failed >= 0) throw new Error(errorMessage([settingsBody, rulesBody, rafflesBody][failed], 'No se pudo cargar el programa. Intentá de nuevo.'))
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
      setServiceVisitsReady(settingsBody?.capabilities?.serviceVisits === true)
      setSettings(settingsBody?.settings ?? null)
      setRules(rulesBody?.rules ?? [])
      setRaffles(rafflesBody?.raffles ?? [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el programa')
      console.error('No se pudo cargar puntos y sorteos', error)
      toast.error('No se pudo cargar puntos y sorteos')
    } finally {
      setLoading(false)
    }
  }, [scopedFetch])

  useEffect(() => {
    void refresh()
  }, [refresh, scopedFetch])

  const saveSettings = useCallback(async (values: Omit<LoyaltySettingsRow, 'organization_id'>) => {
    const response = await scopedFetch('/api/loyalty/settings', {
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
  }, [scopedFetch])

  const createRule = useCallback(async (values: Record<string, unknown>) => {
    const response = await scopedFetch('/api/loyalty/rules', {
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
  }, [scopedFetch])

  const toggleRule = useCallback(async (id: string, isActive: boolean) => {
    const response = await scopedFetch(`/api/loyalty/rules/${id}`, {
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
  }, [scopedFetch])

  const deleteRule = useCallback(async (id: string) => {
    const response = await scopedFetch(`/api/loyalty/rules/${id}`, { method: 'DELETE' })

    if (!response.ok) {
      toast.error(errorMessage(await readJson(response), 'No se pudo eliminar la promoción'))
      return false
    }

    setRules((current) => current.filter((rule) => rule.id !== id))
    toast.success('Promoción eliminada')
    return true
  }, [scopedFetch])

  const createRaffle = useCallback(async (values: Record<string, unknown>) => {
    const response = await scopedFetch('/api/raffles', {
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
  }, [scopedFetch])

  const updateRaffleStatus = useCallback(async (id: string, status: RaffleRow['status']) => {
    const response = await scopedFetch(`/api/raffles/${id}`, {
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
  }, [scopedFetch])

  const drawRaffle = useCallback(async (id: string) => {
    const response = await scopedFetch(`/api/raffles/${id}/draw`, {
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
  }, [refresh, scopedFetch])

  return {
    settings,
    rules,
    raffles,
    loading,
    moduleInstalled,
    moduleMessage,
    loadError,
    serviceVisitsReady,
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

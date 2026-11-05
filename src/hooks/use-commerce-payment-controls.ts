'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { commerceControlId, type PaymentControlSnapshot } from '@/lib/payments/control-contract'

export function useCommercePaymentControls() {
  const { user } = useAuth()
  const key = `${user?.id ?? ''}:${user?.organization?.id ?? ''}`
  const [result, setResult] = useState<{ key: string; snapshot?: PaymentControlSnapshot; error?: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/admin/payment-controls', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const payload = await response.json()
      if (!response.ok || payload.scope !== 'commerce' || !Array.isArray(payload.methods)) throw new Error(payload.error || 'No se pudieron consultar los medios de cobro.')
      if (user?.organization?.id && payload.organizationId !== user.organization.id) throw new Error('El comercio activo cambió. Volvé a abrir el cobro.')
      if (!controller.signal.aborted) setResult({ key, snapshot: payload })
    }).catch(error => { if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : 'No se pudieron cargar los medios.' }) })
    return () => controller.abort()
  }, [key, user?.organization?.id])
  const current = result?.key === key ? result : null
  const allows = (method: unknown) => {
    try { return current?.snapshot?.methods.find(item => item.id === commerceControlId(method))?.available === true }
    catch { return false }
  }
  return { allows, ready: Boolean(current?.snapshot), error: current?.error ?? null }
}

'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CreditFileDTO, CreditFilePolicy } from '@/lib/credits/credit-file-contract'

export function useCustomerCreditFile(customerId: string) {
  const [file, setFile] = useState<CreditFileDTO | null>(null)
  const [policy, setPolicy] = useState<CreditFilePolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const inFlight = useRef(false)
  const base = `/api/customers/${encodeURIComponent(customerId)}/credit-file`
  const reload = useCallback(async (signal?: AbortSignal) => {
    const ticket = generation.current
    setLoading(true); setError(null)
    try {
      const response = await fetch(base, { cache: 'no-store', signal })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo cargar la ficha.')
      if (ticket === generation.current && !signal?.aborted) { setFile(result.file); setPolicy(result.policy) }
    } catch (cause) {
      if (ticket === generation.current && !signal?.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la ficha.')
    } finally { if (ticket === generation.current && !signal?.aborted) setLoading(false) }
  }, [base])
  useEffect(() => {
    const ticket = ++generation.current
    setFile(null); setPolicy(null)
    const controller = new AbortController()
    void reload(controller.signal)
    return () => { generation.current = ticket + 1; controller.abort() }
  }, [reload])
  const action = async (suffix: string, method: string, body: unknown) => {
    if (inFlight.current) return null
    inFlight.current = true; setBusy(true); setError(null)
    const ticket = generation.current
    try {
      const form = body instanceof FormData
      const response = await fetch(suffix === 'policy' ? '/api/credits/file-policy' : `${base}${suffix}`, { method, cache: 'no-store', headers: form ? undefined : { 'Content-Type': 'application/json' }, body: form ? body : JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar. Reintentá.')
      if (ticket !== generation.current) return null
      if (result.file) setFile(result.file)
      if (result.policy) setPolicy(result.policy)
      return result
    } catch (cause) {
      if (ticket === generation.current) setError(cause instanceof Error ? cause.message : 'No se pudo completar la acción.')
      return null
    } finally { inFlight.current = false; setBusy(false) }
  }
  return { file, policy, loading, busy, error, reload, action }
}

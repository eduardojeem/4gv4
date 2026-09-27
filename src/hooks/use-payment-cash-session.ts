'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useCashRegister } from '@/hooks/useCashRegister'
import type { PaymentCashSessionState } from '@/lib/payments/cash-session-guard'

type OpenSession = { id?: string | null } | null

export function usePaymentCashSession({
  active,
  registerId = 'principal',
}: {
  active: boolean
  registerId?: string
}) {
  const cashRegister = useCashRegister()
  const checkOpenSessionRef = useRef(cashRegister.checkOpenSession)
  const [state, setState] = useState<PaymentCashSessionState>(active ? 'checking' : 'idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [scope, setScope] = useState({ active, registerId })
  const requestId = useRef(0)
  if (scope.active !== active || scope.registerId !== registerId) {
    setScope({ active, registerId })
    setState(active ? 'checking' : 'idle')
    setSessionId(null)
  }

  useEffect(() => {
    checkOpenSessionRef.current = cashRegister.checkOpenSession
  }, [cashRegister.checkOpenSession])

  const loadSession = useCallback(() => {
    if (!active) return Promise.resolve(null)
    const currentRequest = ++requestId.current
    const readSession = async () => await checkOpenSessionRef.current(registerId) as OpenSession
    return readSession().then(session => {
      if (currentRequest !== requestId.current) return null
      const nextSessionId = typeof session?.id === 'string' ? session.id : null
      setSessionId(nextSessionId)
      setState(nextSessionId ? 'open' : 'closed')
      return nextSessionId
    }).catch(() => {
      if (currentRequest !== requestId.current) return null
      setSessionId(null)
      setState('closed')
      return null
    })
  }, [active, registerId])

  const refresh = useCallback(() => {
    if (!active) return Promise.resolve(null)
    setState('checking')
    return loadSession()
  }, [active, loadSession])

  useEffect(() => {
    void loadSession()
    return () => { requestId.current += 1 }
  }, [loadSession])

  const markClosed = useCallback(() => {
    requestId.current += 1
    setSessionId(null)
    setState('closed')
  }, [])

  return { state, sessionId, refresh, markClosed }
}

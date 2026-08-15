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

  useEffect(() => {
    checkOpenSessionRef.current = cashRegister.checkOpenSession
  }, [cashRegister.checkOpenSession])

  const refresh = useCallback(async () => {
    if (!active) {
      setSessionId(null)
      setState('idle')
      return null
    }

    setState('checking')
    try {
      const session = await checkOpenSessionRef.current(registerId) as OpenSession
      const nextSessionId = typeof session?.id === 'string' ? session.id : null
      setSessionId(nextSessionId)
      setState(nextSessionId ? 'open' : 'closed')
      return nextSessionId
    } catch {
      setSessionId(null)
      setState('closed')
      return null
    }
  }, [active, registerId])

  useEffect(() => {
    if (!active) {
      setSessionId(null)
      setState('idle')
      return
    }

    void refresh()
  }, [active, refresh])

  const markClosed = useCallback(() => {
    setSessionId(null)
    setState('closed')
  }, [])

  return { state, sessionId, refresh, markClosed }
}

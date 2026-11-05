'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_CREDIT_POS_POLICY,
  normalizeCreditPosPolicy,
  type CreditPlanOption,
  type CreditPosPolicy,
} from '@/lib/credits/pos-credit-policy'

export type PosCreditPolicyState = {
  policy: CreditPosPolicy
  /** Dueño o administrador: puede vender fuera de la política. */
  canOverride: boolean
  defaultPlans: CreditPlanOption[]
  loaded: boolean
}

const INITIAL: PosCreditPolicyState = {
  policy: DEFAULT_CREDIT_POS_POLICY,
  canOverride: false,
  defaultPlans: [],
  loaded: false,
}

// Una sola lectura por carga de página: el panel se monta varias veces.
let cached: Promise<PosCreditPolicyState> | null = null

function loadPolicy(): Promise<PosCreditPolicyState> {
  cached ??= fetch('/api/pos/credit-policy', { cache: 'no-store' })
    .then(async (response) => {
      const body = await response.json().catch(() => null) as {
        data?: { policy?: unknown; canOverride?: unknown; defaultPlans?: CreditPlanOption[] }
      } | null
      if (!response.ok || !body?.data) throw new Error('credit-policy')
      return {
        policy: normalizeCreditPosPolicy(body.data.policy),
        canOverride: body.data.canOverride === true,
        defaultPlans: Array.isArray(body.data.defaultPlans) ? body.data.defaultPlans : [],
        loaded: true,
      }
    })
    .catch(() => {
      cached = null
      // Sin política a la vista se muestra todo; el servidor igual la aplica.
      return { ...INITIAL, loaded: true }
    })
  return cached
}

/** Política de crédito de la organización para acotar el formulario del POS. */
export function usePosCreditPolicy(): PosCreditPolicyState {
  const [state, setState] = useState<PosCreditPolicyState>(INITIAL)
  useEffect(() => {
    let active = true
    void loadPolicy().then((next) => { if (active) setState(next) })
    return () => { active = false }
  }, [])
  return state
}

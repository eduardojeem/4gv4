import type { Factor, SupabaseClient } from '@supabase/supabase-js'
import type { AssuranceLevel } from '@/lib/auth/mfa'

/**
 * Lo que necesitan las pantallas de 2FA sobre la sesión actual. Todo pasa por
 * `supabase.auth.mfa.*` con la sesión del usuario: Supabase sólo devuelve y
 * modifica los factores de quien está logueado.
 */
export type MfaState = {
  currentLevel: AssuranceLevel | null
  /** Tiene un factor verificado y esta sesión todavía no pasó el código. */
  pending: boolean
  /** Apps autenticadoras ya verificadas. */
  totpFactors: Factor[]
}

export async function loadMfaState(supabase: SupabaseClient): Promise<MfaState> {
  const [{ data: aal, error: aalError }, { data: factors, error: factorsError }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ])
  if (aalError) throw aalError
  if (factorsError) throw factorsError

  const currentLevel = (aal?.currentLevel ?? null) as AssuranceLevel | null
  const totpFactors = (factors?.totp ?? []).filter((factor) => factor.status === 'verified')
  return {
    currentLevel,
    pending: totpFactors.length > 0 && currentLevel !== 'aal2',
    totpFactors,
  }
}

/** Pide un challenge y lo verifica con el código: la sesión pasa a `aal2`. */
export async function verifyTotpCode(supabase: SupabaseClient, factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw error
}

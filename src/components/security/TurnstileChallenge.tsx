'use client'

import { useCallback, useState } from 'react'
import Script from 'next/script'
import { ShieldCheck } from 'lucide-react'
import { Turnstile, type TurnstileTheme } from '@marsidev/react-turnstile'

type ChallengeState = 'pending' | 'success' | 'expired' | 'error'

interface TurnstileChallengeProps {
  action: string
  onTokenChange: (token: string | null) => void
  resetKey: number
  theme?: TurnstileTheme
  disabled?: boolean
}

const stateMessage: Record<ChallengeState, string> = {
  pending: 'Completa la verificacion de seguridad para continuar.',
  success: 'Verificacion completada.',
  expired: 'La verificacion vencio. Completa el desafio nuevamente.',
  error: 'No pudimos completar la verificacion. Reintenta o revisa tu conexion.',
}

export function TurnstileChallenge({
  action,
  onTokenChange,
  resetKey,
  theme = 'auto',
  disabled = false,
}: TurnstileChallengeProps) {
  const [challengeState, setChallengeState] = useState<{ resetKey: number; status: ChallengeState }>({
    resetKey,
    status: 'pending',
  })
  const state = challengeState.resetKey === resetKey ? challengeState.status : 'pending'
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()

  const clearToken = useCallback((nextState: ChallengeState) => {
    onTokenChange(null)
    setChallengeState({ resetKey, status: nextState })
  }, [onTokenChange, resetKey])

  if (!siteKey) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
      >
        La proteccion anti-bots no esta configurada. Agrega la Site Key de Turnstile para continuar.
      </div>
    )
  }

  const hasError = state === 'expired' || state === 'error'

  return (
    <div className="space-y-2" aria-label="Verificacion de seguridad">
      <Script
        id="cf-turnstile-script"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onError={() => clearToken('error')}
      />
      <div
        className={`min-w-0 overflow-hidden rounded-lg ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        aria-disabled={disabled}
      >
        <Turnstile
          key={resetKey}
          injectScript={false}
          siteKey={siteKey}
          onSuccess={(token) => {
            onTokenChange(token)
            setChallengeState({ resetKey, status: 'success' })
          }}
          onExpire={() => clearToken('expired')}
          onError={() => clearToken('error')}
          onTimeout={() => clearToken('expired')}
          onUnsupported={() => clearToken('error')}
          scriptOptions={{ onError: () => clearToken('error') }}
          options={{
            action,
            appearance: 'always',
            language: 'es',
            refreshExpired: 'auto',
            refreshTimeout: 'auto',
            responseField: false,
            size: 'flexible',
            theme,
          }}
          className="w-full"
        />
      </div>
      <p
        role={hasError ? 'alert' : 'status'}
        aria-live={hasError ? 'assertive' : 'polite'}
        className={`flex items-start gap-1.5 text-xs leading-5 ${
          state === 'success'
            ? 'text-emerald-600 dark:text-emerald-400'
            : hasError
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-muted-foreground'
        }`}
      >
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{stateMessage[state]}</span>
      </p>
    </div>
  )
}

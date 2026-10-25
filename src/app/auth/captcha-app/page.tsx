'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { TurnstileChallenge } from '@/components/security/TurnstileChallenge'
import { appReturnWithCaptcha, safeAppReturnUrl } from '@/lib/mobile-app-return'

/**
 * Solo el captcha de Cloudflare, para el registro nativo de la app: la app abre
 * esta página, la persona completa la verificación y el token vuelve a la app
 * (solo a su propia dirección). El registro lo manda la app con ese token.
 */
function CaptchaForApp() {
  const searchParams = useSearchParams()
  const appReturn = safeAppReturnUrl(searchParams.get('app_return'))
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (token && appReturn) window.location.assign(appReturnWithCaptcha(appReturn, token))
  }, [token, appReturn])

  if (!appReturn) {
    return <p className="text-center text-sm text-muted-foreground">Abrí esta verificación desde la app para crear tu comercio.</p>
  }
  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-lg font-semibold">Verificación de seguridad</h1>
      <p className="text-center text-sm text-muted-foreground">
        {token ? 'Listo. Volviendo a la app…' : 'Confirmá que sos una persona para crear tu comercio.'}
      </p>
      <TurnstileChallenge action="company_register" onTokenChange={setToken} resetKey={0} />
    </div>
  )
}

export default function AppCaptchaPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <Suspense fallback={null}>
        <CaptchaForApp />
      </Suspense>
    </main>
  )
}

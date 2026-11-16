'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { buildGoogleCallbackUrl } from '@/lib/auth/google-oauth'

/**
 * Entrar o crear la cuenta con Google. Es el mismo botón para las dos cosas:
 * si el correo no tiene cuenta, Supabase la crea y el trigger `handle_new_user`
 * arma el perfil, igual que un registro con contraseña.
 *
 * `next` es la ruta interna a la que se vuelve después de Google. Sin `next`
 * (los modales) vuelve a la página donde estaba la persona.
 */
export function GoogleSignInButton({
  next,
  label = 'Continuar con Google',
  disabled,
  className,
}: {
  next?: string
  label?: string
  disabled?: boolean
  className?: string
}) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: buildGoogleCallbackUrl(window.location.origin, next ?? `${window.location.pathname}${window.location.search}`),
          // Deja elegir la cuenta: en una PC compartida no entra con la última que usó.
          queryParams: { prompt: 'select_account' },
        },
      })
      // Sin error el navegador ya se fue a Google; el botón queda cargando.
      if (error) throw error
    } catch {
      toast.error('No se pudo abrir Google. Probá de nuevo en unos segundos.')
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={disabled || loading}
      className={className ?? 'h-11 w-full rounded-xl font-semibold'}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleLogo className="mr-2 h-4 w-4" />}
      {loading ? 'Abriendo Google...' : label}
    </Button>
  )
}

/** Separador «o con tu correo» entre Google y el formulario. */
export function AuthMethodDivider({ text = 'o con tu correo' }: { text?: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {text}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  )
}

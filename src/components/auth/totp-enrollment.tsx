'use client'

import { useState } from 'react'
import { Check, Copy, Loader2, QrCode, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TotpCodeInput } from '@/components/auth/totp-code-input'
import { createClient } from '@/lib/supabase/client'
import { describeMfaError, isCompleteTotpCode } from '@/lib/auth/mfa'
import { verifyTotpCode } from '@/lib/auth/mfa-client'

type PendingEnrollment = { factorId: string; qrCode: string; secret: string }

type TotpEnrollmentProps = {
  /** La app quedó verificada: la sesión ya es `aal2`. */
  onEnrolled: () => void | Promise<void>
  onCancel?: () => void
  /** Empieza mostrando el QR sin esperar el botón (pantalla de activación obligatoria). */
  startLabel?: string
}

const ISSUER = 'MiTiendaPY'

/**
 * Activar una app autenticadora (Google Authenticator, Microsoft Authenticator,
 * 1Password…): QR y secreto para cargarla y el primer código para confirmarla.
 * Hasta verificar el código, el factor queda «sin verificar» y no se exige.
 */
export function TotpEnrollment({ onEnrolled, onCancel, startLabel = 'Configurar app autenticadora' }: TotpEnrollmentProps) {
  const [pending, setPending] = useState<PendingEnrollment | null>(null)
  const [starting, setStarting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const start = async () => {
    setStarting(true)
    setError(null)
    try {
      const supabase = createClient()
      // Una activación que quedó a medias deja un factor sin verificar con el
      // mismo nombre y haría fallar la nueva: se borra antes.
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const stale = (factors?.all ?? []).filter((factor) => factor.factor_type === 'totp' && factor.status !== 'verified')
      await Promise.all(stale.map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })))

      const verifiedCount = (factors?.totp ?? []).filter((factor) => factor.status === 'verified').length
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: ISSUER,
        friendlyName: verifiedCount > 0 ? `App autenticadora ${verifiedCount + 1}` : 'App autenticadora',
      })
      if (enrollError || !data) throw enrollError ?? new Error('enroll')
      setPending({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
      setCode('')
    } catch (err) {
      setError(describeMfaError(err))
    } finally {
      setStarting(false)
    }
  }

  const cancel = async () => {
    if (pending) {
      await createClient().auth.mfa.unenroll({ factorId: pending.factorId }).catch(() => undefined)
    }
    setPending(null)
    setCode('')
    setError(null)
    onCancel?.()
  }

  const verify = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!pending || !isCompleteTotpCode(code)) {
      setError('Escribí los 6 dígitos que muestra la app.')
      return
    }
    setVerifying(true)
    setError(null)
    try {
      await verifyTotpCode(createClient(), pending.factorId, code)
      toast.success('Listo. La verificación en dos pasos quedó activada.')
      setPending(null)
      await onEnrolled()
    } catch (err) {
      setError(describeMfaError(err))
      setCode('')
    } finally {
      setVerifying(false)
    }
  }

  const copySecret = async () => {
    if (!pending) return
    try {
      await navigator.clipboard.writeText(pending.secret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar. Seleccioná la clave y copiala a mano.')
    }
  }

  if (!pending) {
    return (
      <div className="space-y-2">
        <Button type="button" size="sm" onClick={start} disabled={starting} className="gap-1.5 text-xs">
          {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
          {startLabel}
        </Button>
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        <li>Abrí tu app autenticadora (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
        <li>Escaneá el código QR o cargá la clave a mano.</li>
        <li>Escribí el código de 6 dígitos que te muestra la app.</li>
      </ol>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* El QR lo genera Supabase como SVG en data URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pending.qrCode}
          alt="Código QR para cargar la cuenta en la app autenticadora"
          className="h-44 w-44 shrink-0 rounded-lg border border-border/60 bg-white p-2"
        />
        <div className="w-full min-w-0 space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">¿No podés escanear? Clave para cargar a mano</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md border border-border/60 bg-background px-2 py-1.5 font-mono text-xs">
                {pending.secret}
              </code>
              <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={copySecret} aria-label="Copiar clave">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totp-enroll-code" className="text-xs">Código de 6 dígitos</Label>
            <TotpCodeInput id="totp-enroll-code" value={code} onChange={setCode} disabled={verifying} autoFocus />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={verifying} className="text-xs">
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={verifying || !isCompleteTotpCode(code)} className="gap-1.5 text-xs">
          {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Verificar y activar
        </Button>
      </div>
    </form>
  )
}

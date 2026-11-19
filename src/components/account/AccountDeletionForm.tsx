'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

const CONFIRM_WORD = 'ELIMINAR'

type Method = 'password' | 'code'

/**
 * Formulario de la página pública para pedir la eliminación de la cuenta.
 * Se confirma con la contraseña o, si la cuenta entra con Google, con un
 * código que llega al correo.
 */
export function AccountDeletionForm({
  email,
  closesOrganizations,
  hasPassword,
}: {
  email: string | null
  closesOrganizations: string[]
  hasPassword: boolean
}) {
  const [method, setMethod] = useState<Method>(hasPassword ? 'password' : 'code')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ scheduledFor: string; emailSent: boolean } | null>(null)

  async function requestCode() {
    setSendingCode(true)
    setError(null)
    try {
      const response = await fetch('/api/account/delete/code', { method: 'POST' })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        setError(payload?.error || 'No se pudo mandar el código.')
        return
      }
      setCodeSent(true)
    } catch {
      setError('No se pudo conectar. Revisá tu conexión y probá de nuevo.')
    } finally {
      setSendingCode(false)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(method === 'password' ? { password, confirm, source: 'web' } : { code, confirm, source: 'web' }),
      })
      const payload = await response.json().catch(() => null) as { error?: string; scheduledFor?: string; emailSent?: boolean } | null
      if (!response.ok || !payload?.scheduledFor) {
        setError(payload?.error || 'No se pudo registrar el pedido.')
        return
      }
      setDone({ scheduledFor: payload.scheduledFor, emailSent: payload.emailSent !== false })
      await createClient().auth.signOut({ scope: 'local' }).catch(() => {})
    } catch {
      setError('No se pudo conectar. Revisá tu conexión y probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <p role="status" className="text-sm">
        Listo. Tu cuenta quedó bloqueada y tus datos personales se eliminan el{' '}
        {new Date(done.scheduledFor).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })}.{' '}
        {done.emailSent ? 'Te mandamos la confirmación por correo.' : 'No pudimos mandarte el correo de confirmación, pero el pedido quedó registrado.'}
      </p>
    )
  }

  const secretReady = method === 'password' ? Boolean(password) : /^\d{6}$/.test(code.trim())
  const canSubmit = !saving && secretReady && acknowledged && confirm.trim().toUpperCase() === CONFIRM_WORD

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Eliminar {email ? <span className="break-all">{email}</span> : 'esta cuenta'}</h2>
        {closesOrganizations.length > 0 && (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            Sos el único administrador de {closesOrganizations.join(', ')}. Si seguís, ese negocio se cierra para todo el
            equipo. Para que siga funcionando, primero sumá a otra persona como administrador.
          </p>
        )}
      </div>

      {method === 'password' ? (
        <div className="space-y-1.5">
          <Label htmlFor="delete-password">Contraseña</Label>
          <Input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={saving} />
          <button type="button" className="text-xs text-primary underline-offset-4 hover:underline" onClick={() => { setMethod('code'); setError(null) }}>
            No sé mi contraseña: mandame un código por correo
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="delete-code">Código que te mandamos por correo</Label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {codeSent ? `Lo mandamos a ${email ?? 'tu correo'}. Vence en 10 minutos.` : 'Como entrás sin contraseña, confirmá con un código que llega a tu correo.'}
          </p>
          <div className="flex gap-2">
            <Input
              id="delete-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              disabled={saving || !codeSent}
              placeholder="123456"
            />
            <Button type="button" variant="outline" onClick={() => void requestCode()} disabled={sendingCode || saving}>
              {sendingCode && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {codeSent ? 'Reenviar' : 'Mandar código'}
            </Button>
          </div>
          {hasPassword && (
            <button type="button" className="text-xs text-primary underline-offset-4 hover:underline" onClick={() => { setMethod('password'); setError(null) }}>
              Prefiero usar mi contraseña
            </button>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="delete-confirm">Escribí {CONFIRM_WORD} para confirmar</Label>
        <Input id="delete-confirm" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoCapitalize="characters" disabled={saving} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={saving} />
        <span>Entiendo que pierdo el acceso desde ahora y que, pasado el plazo, mis datos personales no se pueden recuperar.</span>
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={!canSubmit} className="bg-rose-600 text-white hover:bg-rose-700">
        {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        Eliminar mi cuenta
      </Button>
    </form>
  )
}

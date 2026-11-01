'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

const CONFIRM_WORD = 'ELIMINAR'

/** Formulario de la página pública para pedir la eliminación de la cuenta. */
export function AccountDeletionForm({ email, closesOrganizations }: { email: string | null; closesOrganizations: string[] }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scheduledFor, setScheduledFor] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirm, source: 'web' }),
      })
      const payload = await response.json().catch(() => null) as { error?: string; scheduledFor?: string } | null
      if (!response.ok) {
        setError(payload?.error || 'No se pudo registrar el pedido.')
        return
      }
      setScheduledFor(payload?.scheduledFor ?? null)
      await createClient().auth.signOut({ scope: 'local' }).catch(() => {})
    } catch {
      setError('No se pudo conectar. Revisá tu conexión y probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (scheduledFor) {
    return (
      <p role="status" className="text-sm">
        Listo. Tu cuenta quedó bloqueada y tus datos personales se eliminan el{' '}
        {new Date(scheduledFor).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })}. Te mandamos
        la confirmación por correo.
      </p>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Eliminar {email ? <span className="break-all">{email}</span> : 'esta cuenta'}</h2>
        {closesOrganizations.length > 0 && (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            Sos el único administrador de {closesOrganizations.join(', ')}. Si seguís, ese negocio se cierra. Para que siga
            funcionando, primero sumá a otra persona como administrador.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="delete-password">Contraseña</Label>
        <Input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={saving} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="delete-confirm">Escribí {CONFIRM_WORD} para confirmar</Label>
        <Input id="delete-confirm" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoCapitalize="characters" disabled={saving} required />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        disabled={saving || !password || confirm.trim().toUpperCase() !== CONFIRM_WORD}
        className="bg-rose-600 text-white hover:bg-rose-700"
      >
        {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        Eliminar mi cuenta
      </Button>
    </form>
  )
}

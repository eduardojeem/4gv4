'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Fingerprint, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { PasskeyListItem } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import {
  browserSupportsPasskeys,
  defaultPasskeyLabel,
  describePasskeyError,
  isPasskeyCancellation,
} from '@/lib/auth/passkeys'

function relative(date: string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

/**
 * Passkeys del usuario logueado: registrar el dispositivo actual, ver y borrar.
 * Supabase Auth sólo devuelve y borra las del usuario de la sesión.
 */
export function PasskeysSection() {
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [supported, setSupported] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.passkey.list()
    if (error) {
      setUnavailable(describePasskeyError(error))
      setPasskeys([])
    } else {
      setUnavailable(null)
      setPasskeys(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    setSupported(browserSupportsPasskeys())
    void load()
  }, [load])

  const handleRegister = async () => {
    setRegistering(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.registerPasskey()
      if (error) {
        if (!isPasskeyCancellation(error)) toast.error(describePasskeyError(error))
        return
      }
      if (data?.id && !data.friendly_name) {
        // El nombre ayuda a reconocer el dispositivo en la lista; si falla no importa.
        await supabase.auth.passkey
          .update({ passkeyId: data.id, friendlyName: defaultPasskeyLabel(navigator.userAgent) })
          .catch(() => undefined)
      }
      toast.success('Listo. La próxima vez podés ingresar con tu huella o Face ID.')
      await load()
    } catch (err) {
      toast.error(describePasskeyError(err))
    } finally {
      setRegistering(false)
    }
  }

  const handleDelete = async (passkey: PasskeyListItem) => {
    const label = passkey.friendly_name || 'esta passkey'
    if (!window.confirm(`¿Borrar ${label}? Ese dispositivo ya no podrá ingresar sin contraseña.`)) return
    setDeletingId(passkey.id)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.passkey.delete({ passkeyId: passkey.id })
      if (error) {
        toast.error(describePasskeyError(error))
        return
      }
      setPasskeys((current) => current.filter((item) => item.id !== passkey.id))
      toast.success('Passkey borrada.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-border/60 p-4 bg-card space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="rounded-lg bg-emerald-500/10 p-2.5 mt-0.5 text-emerald-600">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-foreground">Huella, Face ID o Windows Hello</p>
              {passkeys.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {passkeys.length} {passkeys.length === 1 ? 'dispositivo' : 'dispositivos'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Registrá este dispositivo para ingresar sin escribir la contraseña. La contraseña sigue funcionando.
            </p>
          </div>
        </div>
        <div className="sm:shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5"
            onClick={handleRegister}
            disabled={!supported || registering || Boolean(unavailable)}
            title={supported ? undefined : 'Este navegador no admite passkeys'}
          >
            {registering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Registrar este dispositivo
          </Button>
        </div>
      </div>

      {!supported && !loading && (
        <p className="text-xs text-muted-foreground">Este navegador no admite passkeys.</p>
      )}
      {unavailable && <p className="text-xs text-muted-foreground">{unavailable}</p>}

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando passkeys…</p>
      ) : (
        passkeys.length > 0 && (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{passkey.friendly_name || 'Passkey'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Registrada {relative(passkey.created_at)}
                    {passkey.last_used_at ? ` · Último uso ${relative(passkey.last_used_at)}` : ' · Sin usar'}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(passkey)}
                  disabled={deletingId === passkey.id}
                  aria-label={`Borrar ${passkey.friendly_name || 'passkey'}`}
                >
                  {deletingId === passkey.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Preferences = {
  orderNotifications: boolean
  repairNotifications: boolean
  creditNotifications: boolean
  promotions: boolean
  marketingCommunications: boolean
  publicProfile: boolean
}

const labels: Array<{ key: keyof Preferences; title: string; detail: string }> = [
  { key: 'orderNotifications', title: 'Pedidos', detail: 'Cambios importantes en tus compras.' },
  { key: 'repairNotifications', title: 'Reparaciones', detail: 'Avances y equipos listos para retirar.' },
  { key: 'creditNotifications', title: 'Cuotas y créditos', detail: 'Vencimientos y movimientos de tu cuenta.' },
  { key: 'promotions', title: 'Promociones', detail: 'Ofertas de las tiendas. Desactivado inicialmente.' },
  { key: 'marketingCommunications', title: 'Novedades comerciales', detail: 'Consejos y comunicaciones de MiTiendaPy.' },
]

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/

export function MarketplacePreferencesForm() {
  const [values, setValues] = useState<Preferences | null>(null)
  const [message, setMessage] = useState('Cargando preferencias…')
  const [username, setUsername] = useState<string | null>(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameMessage, setUsernameMessage] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/marketplace/profile/preferences', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error()
        return response.json() as Promise<{ preferences: Preferences; username: string | null }>
      })
      .then(({ preferences, username: currentUsername }) => {
        if (!active) return
        setValues(preferences)
        setMessage('')
        setUsername(currentUsername)
        setUsernameInput(currentUsername ?? '')
      })
      .catch(() => { if (active) setMessage('No pudimos cargar las preferencias.') })
    return () => { active = false }
  }, [])

  const update = async (key: keyof Preferences, checked: boolean) => {
    if (!values) return
    // Activar el perfil público sin un nombre de usuario elegido lo deja
    // encendido pero inalcanzable: no hay URL a la que apunte todavía.
    if (key === 'publicProfile' && checked && !username) {
      setUsernameMessage('Elegí un nombre de usuario antes de activar tu perfil público.')
      return
    }
    const previous = values
    setValues({ ...values, [key]: checked })
    setMessage('Guardando…')
    try {
      const response = await fetch('/api/marketplace/profile/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: checked }),
      })
      const body = await response.json().catch(() => null) as { preferences?: Preferences; error?: string } | null
      if (!response.ok || !body?.preferences) throw new Error(body?.error || 'No se pudo guardar')
      setValues(body.preferences)
      setMessage('Guardado')
    } catch (error) {
      setValues(previous)
      setMessage(error instanceof Error && error.message !== 'No se pudo guardar' ? error.message : 'No se pudo guardar. Restauramos la opción anterior.')
    }
  }

  const saveUsername = async () => {
    const next = usernameInput.trim().toLowerCase()
    if (!USERNAME_PATTERN.test(next)) {
      setUsernameMessage('Entre 3 y 30 caracteres: minúsculas, números y guion bajo.')
      return
    }
    setUsernameSaving(true)
    setUsernameMessage('')
    try {
      const response = await fetch('/api/marketplace/profile/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: next }),
      })
      const body = await response.json().catch(() => null) as { username?: string | null; error?: string } | null
      if (!response.ok) throw new Error(body?.error || 'No se pudo guardar el nombre de usuario.')
      setUsername(body?.username ?? next)
      setUsernameMessage('Nombre de usuario guardado.')
    } catch (error) {
      setUsernameMessage(error instanceof Error ? error.message : 'No se pudo guardar el nombre de usuario.')
    } finally {
      setUsernameSaving(false)
    }
  }

  return <div className="space-y-3">
    {values && labels.map(({ key, title, detail }) => <div key={key} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
      <label htmlFor={`preference-${key}`} className="cursor-pointer pr-2">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </label>
      <Switch id={`preference-${key}`} checked={values[key]} onCheckedChange={(checked) => void update(key, checked)} aria-label={title} />
    </div>)}

    {values && (
      <div className="rounded-lg border border-border/60 p-3">
        <div className="flex items-start justify-between gap-3">
          <label htmlFor="preference-publicProfile" className="cursor-pointer pr-2">
            <span className="block text-sm font-medium">Perfil público</span>
            <span className="block text-xs text-muted-foreground">
              Permitir que otros vean tu perfil en {username ? `mitiendapy.com/perfil/${username}` : 'una URL propia, una vez que elijas tu nombre de usuario'}.
            </span>
          </label>
          <Switch
            id="preference-publicProfile"
            checked={values.publicProfile}
            onCheckedChange={(checked) => void update('publicProfile', checked)}
            aria-label="Perfil público"
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Input
            value={usernameInput}
            onChange={(event) => setUsernameInput(event.target.value.toLowerCase())}
            placeholder="tu_nombre_de_usuario"
            className="h-9 text-sm"
            maxLength={30}
            disabled={usernameSaving}
          />
          <Button type="button" size="sm" variant="outline" disabled={usernameSaving || usernameInput.trim() === (username ?? '')} onClick={() => void saveUsername()}>
            {usernameSaving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
        {usernameMessage && <p className="mt-1.5 text-xs text-muted-foreground" aria-live="polite">{usernameMessage}</p>}
      </div>
    )}

    <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">{message}</p>
  </div>
}

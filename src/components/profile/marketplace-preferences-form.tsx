'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'

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
  { key: 'publicProfile', title: 'Perfil público', detail: 'Permitir que otros vean tu perfil. Desactivado inicialmente.' },
]

export function MarketplacePreferencesForm() {
  const [values, setValues] = useState<Preferences | null>(null)
  const [message, setMessage] = useState('Cargando preferencias…')

  useEffect(() => {
    let active = true
    fetch('/api/marketplace/profile/preferences', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error()
        return response.json() as Promise<{ preferences: Preferences }>
      })
      .then(({ preferences }) => { if (active) { setValues(preferences); setMessage('') } })
      .catch(() => { if (active) setMessage('No pudimos cargar las preferencias.') })
    return () => { active = false }
  }, [])

  const update = async (key: keyof Preferences, checked: boolean) => {
    if (!values) return
    const previous = values
    setValues({ ...values, [key]: checked })
    setMessage('Guardando…')
    try {
      const response = await fetch('/api/marketplace/profile/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: checked }),
      })
      if (!response.ok) throw new Error()
      const body = await response.json() as { preferences: Preferences }
      setValues(body.preferences)
      setMessage('Guardado')
    } catch {
      setValues(previous)
      setMessage('No se pudo guardar. Restauramos la opción anterior.')
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
    <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">{message}</p>
  </div>
}

'use client'

import type React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Building2, Check, Mail, MapPin, Phone, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { BillingProfile } from '@/lib/saas/subscription-service'

type EditableProfile = Pick<BillingProfile, 'business_name' | 'ruc' | 'billing_email' | 'fiscal_address' | 'phone'>
type ProfileErrors = Partial<Record<keyof EditableProfile, string>>

function validateProfile(values: EditableProfile) {
  const errors: ProfileErrors = {}
  const ruc = values.ruc?.replace(/[^\d]/g, '') || ''

  if (!values.business_name?.trim()) errors.business_name = 'Ingresá la razón social.'
  if (!ruc) errors.ruc = 'Ingresá el RUC o la cédula.'
  if (!values.billing_email?.trim()) errors.billing_email = 'Ingresá el correo de facturación.'
  if (values.billing_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.billing_email.trim())) {
    errors.billing_email = 'Ese correo no parece válido.'
  }
  if (!values.phone?.trim()) errors.phone = 'Ingresá el teléfono.'
  if (!values.fiscal_address?.trim()) errors.fiscal_address = 'Ingresá la dirección fiscal.'

  return errors
}

const FIELDS: Array<{
  key: keyof EditableProfile
  label: string
  placeholder: string
  icon: typeof Building2
  type?: string
  wide?: boolean
  hint?: string
}> = [
  { key: 'business_name', label: 'Razón social', placeholder: 'Mi Empresa S.A.', icon: Building2 },
  { key: 'ruc', label: 'RUC o cédula', placeholder: '80000000-1', icon: Building2, hint: 'Como figura en tu constancia' },
  { key: 'billing_email', label: 'Correo de facturación', placeholder: 'contabilidad@empresa.com', icon: Mail, type: 'email' },
  { key: 'phone', label: 'Teléfono de contacto', placeholder: '+595 981 123 456', icon: Phone },
  { key: 'fiscal_address', label: 'Dirección fiscal', placeholder: 'Avda. Principal 1234, Asunción', icon: MapPin, wide: true },
]

export function BillingProfileForm({ profile }: { profile: BillingProfile | null }) {
  const router = useRouter()
  const [values, setValues] = useState<EditableProfile>({
    business_name: profile?.business_name || '',
    ruc: profile?.ruc || '',
    billing_email: profile?.billing_email || '',
    fiscal_address: profile?.fiscal_address || '',
    phone: profile?.phone || '',
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [message, setMessage] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateProfile(values)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setStatus('error')
      setMessage('Revisá los datos marcados antes de guardar.')
      const primero = FIELDS.find((field) => nextErrors[field.key])
      if (primero) document.getElementById(primero.key)?.focus()
      return
    }

    setErrors({})
    setStatus('saving')
    setMessage('')

    try {
      const response = await fetch('/api/admin/subscriptions/billing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null

      if (!response.ok) {
        setStatus('error')
        setMessage(payload?.error || 'No se pudieron guardar los datos de facturación.')
        return
      }

      setStatus('saved')
      setMessage('Datos guardados.')
      router.refresh()
    } catch {
      setStatus('error')
      setMessage('No se pudo conectar con el servidor. Intentá nuevamente.')
    }
  }

  function update(key: keyof EditableProfile, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    // La confirmacion verde se quedaba pegada: seguias editando y la pantalla
    // seguia diciendo «Datos guardados» con cambios sin guardar.
    if (status !== 'saving') {
      setStatus('idle')
      setMessage('')
    }
  }

  return (
    // Sin noValidate el navegador cortaba el submit antes de tiempo y estos
    // mensajes, que dicen que pasa en cada campo, no se veian nunca.
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        {FIELDS.map(({ key, label, placeholder, icon: Icon, type, wide, hint }) => {
          const error = errors[key]
          return (
            <div key={key} className={cn('space-y-2', wide && 'md:col-span-2')}>
              <Label htmlFor={key} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </Label>
              <div className="relative">
                <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={key}
                  type={type}
                  required
                  placeholder={placeholder}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${key}-error` : hint ? `${key}-hint` : undefined}
                  className={cn(
                    'h-11 rounded-2xl pl-10 text-sm shadow-2xs',
                    error && 'border-destructive focus-visible:ring-destructive'
                  )}
                  value={values[key] || ''}
                  onChange={(event) => update(key, event.target.value)}
                />
              </div>
              {error ? (
                <p id={`${key}-error`} className="text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : hint ? (
                <p id={`${key}-hint`} className="text-xs text-muted-foreground">
                  {hint}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="flex flex-col justify-between gap-4 border-t border-border pt-5 sm:flex-row sm:items-center">
        <Button type="submit" disabled={status === 'saving'} className="h-11 gap-2 rounded-2xl px-6 font-bold">
          <Save className="h-4 w-4" />
          {status === 'saving' ? 'Guardando...' : 'Guardar datos'}
        </Button>

        {status === 'saved' && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <Check className="h-3.5 w-3.5" />
            {message}
          </span>
        )}
        {status === 'error' && (
          <span
            role="alert"
            className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {message}
          </span>
        )}
      </div>
    </form>
  )
}

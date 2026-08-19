'use client'

import type React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Mail, MapPin, Phone, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BillingProfile } from '@/lib/saas/subscription-service'

type EditableProfile = Pick<BillingProfile, 'business_name' | 'ruc' | 'billing_email' | 'fiscal_address' | 'phone'>
type ProfileErrors = Partial<Record<keyof EditableProfile, string>>

function validateProfile(values: EditableProfile) {
  const errors: ProfileErrors = {}
  const ruc = values.ruc?.replace(/[^\d]/g, '') || ''

  if (!values.business_name?.trim()) errors.business_name = 'Ingresa la razon social.'
  if (!ruc) errors.ruc = 'Ingresa el RUC o CI del cliente.'
  if (!values.billing_email?.trim()) errors.billing_email = 'Ingresa el correo de facturacion.'
  if (values.billing_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.billing_email.trim())) {
    errors.billing_email = 'Ingresa un correo valido.'
  }
  if (!values.phone?.trim()) errors.phone = 'Ingresa el telefono del cliente.'
  if (!values.fiscal_address?.trim()) errors.fiscal_address = 'Ingresa la direccion fiscal.'

  return errors
}

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
      setMessage('Revisa los datos marcados antes de guardar.')
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
      setMessage('No se pudo conectar con el servidor. Intenta nuevamente.')
    }
  }

  function update(key: keyof EditableProfile, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    if (status === 'error') {
      setStatus('idle')
      setMessage('')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="business_name" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Razón Social
          </Label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="business_name"
              className="pl-10 rounded-2xl border-slate-200 dark:border-slate-800 h-11 text-sm bg-white dark:bg-slate-900 shadow-2xs focus-visible:ring-indigo-500"
              required
              placeholder="Ej: Mi Empresa S.A."
              aria-invalid={Boolean(errors.business_name)}
              value={values.business_name || ''}
              onChange={(event) => update('business_name', event.target.value)}
            />
          </div>
          {errors.business_name && <p className="text-xs font-medium text-rose-500">{errors.business_name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ruc" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            RUC o Documento de Identidad
          </Label>
          <Input
            id="ruc"
            required
            aria-invalid={Boolean(errors.ruc)}
            placeholder="Ej: 80000000-1"
            className="rounded-2xl border-slate-200 dark:border-slate-800 h-11 text-sm bg-white dark:bg-slate-900 shadow-2xs focus-visible:ring-indigo-500 font-mono"
            value={values.ruc || ''}
            onChange={(event) => update('ruc', event.target.value)}
          />
          {errors.ruc && <p className="text-xs font-medium text-rose-500">{errors.ruc}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing_email" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Correo de Facturación
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="billing_email"
              className="pl-10 rounded-2xl border-slate-200 dark:border-slate-800 h-11 text-sm bg-white dark:bg-slate-900 shadow-2xs focus-visible:ring-indigo-500"
              type="email"
              required
              placeholder="contabilidad@empresa.com"
              aria-invalid={Boolean(errors.billing_email)}
              value={values.billing_email || ''}
              onChange={(event) => update('billing_email', event.target.value)}
            />
          </div>
          {errors.billing_email && <p className="text-xs font-medium text-rose-500">{errors.billing_email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Teléfono de Contacto
          </Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="phone"
              className="pl-10 rounded-2xl border-slate-200 dark:border-slate-800 h-11 text-sm bg-white dark:bg-slate-900 shadow-2xs focus-visible:ring-indigo-500 font-mono"
              required
              placeholder="+595 981 123 456"
              aria-invalid={Boolean(errors.phone)}
              value={values.phone || ''}
              onChange={(event) => update('phone', event.target.value)}
            />
          </div>
          {errors.phone && <p className="text-xs font-medium text-rose-500">{errors.phone}</p>}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="fiscal_address" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Dirección Fiscal
          </Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="fiscal_address"
              className="pl-10 rounded-2xl border-slate-200 dark:border-slate-800 h-11 text-sm bg-white dark:bg-slate-900 shadow-2xs focus-visible:ring-indigo-500"
              required
              placeholder="Avda. Principal 1234, Asunción, Paraguay"
              aria-invalid={Boolean(errors.fiscal_address)}
              value={values.fiscal_address || ''}
              onChange={(event) => update('fiscal_address', event.target.value)}
            />
          </div>
          {errors.fiscal_address && <p className="text-xs font-medium text-rose-500">{errors.fiscal_address}</p>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-5">
        <Button
          type="submit"
          disabled={status === 'saving'}
          className="rounded-2xl h-11 px-6 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-2"
        >
          <Save className="h-4 w-4" />
          {status === 'saving' ? 'Guardando perfil...' : 'Guardar datos de facturación'}
        </Button>
        {status === 'saved' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-xs border border-emerald-200 dark:border-emerald-800">
            ✓ {message}
          </span>
        )}
        {status === 'error' && (
          <span role="alert" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-semibold text-xs border border-rose-200 dark:border-rose-800">
            ⚠ {message}
          </span>
        )}
      </div>
    </form>
  )
}

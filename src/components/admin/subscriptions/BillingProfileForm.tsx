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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateProfile(values)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setStatus('error')
      return
    }

    setErrors({})
    setStatus('saving')

    const response = await fetch('/api/admin/subscriptions/billing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    setStatus(response.ok ? 'saved' : 'error')
    if (response.ok) router.refresh()
  }

  function update(key: keyof EditableProfile, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    if (status === 'error') setStatus('idle')
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="business_name">Razon social</Label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="business_name"
              className="pl-9"
              required
              aria-invalid={Boolean(errors.business_name)}
              value={values.business_name || ''}
              onChange={(event) => update('business_name', event.target.value)}
            />
          </div>
          {errors.business_name && <p className="text-sm text-destructive">{errors.business_name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ruc">RUC o CI</Label>
          <Input
            id="ruc"
            required
            aria-invalid={Boolean(errors.ruc)}
            placeholder="Ej: 80000000-1"
            value={values.ruc || ''}
            onChange={(event) => update('ruc', event.target.value)}
          />
          {errors.ruc && <p className="text-sm text-destructive">{errors.ruc}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing_email">Correo de facturacion</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="billing_email"
              className="pl-9"
              type="email"
              required
              aria-invalid={Boolean(errors.billing_email)}
              value={values.billing_email || ''}
              onChange={(event) => update('billing_email', event.target.value)}
            />
          </div>
          {errors.billing_email && <p className="text-sm text-destructive">{errors.billing_email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefono</Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              className="pl-9"
              required
              aria-invalid={Boolean(errors.phone)}
              value={values.phone || ''}
              onChange={(event) => update('phone', event.target.value)}
            />
          </div>
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="fiscal_address">Direccion fiscal</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="fiscal_address"
              className="pl-9"
              required
              aria-invalid={Boolean(errors.fiscal_address)}
              value={values.fiscal_address || ''}
              onChange={(event) => update('fiscal_address', event.target.value)}
            />
          </div>
          {errors.fiscal_address && <p className="text-sm text-destructive">{errors.fiscal_address}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center">
        <Button type="submit" disabled={status === 'saving'} className="gap-2">
          <Save className="h-4 w-4" />
          {status === 'saving' ? 'Guardando...' : 'Guardar facturacion'}
        </Button>
        {status === 'saved' && <span className="text-sm text-emerald-600">Datos guardados.</span>}
        {status === 'error' && <span className="text-sm text-destructive">Revisa los datos marcados antes de guardar.</span>}
      </div>
    </form>
  )
}

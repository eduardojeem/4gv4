'use client'

/**
 * CustomerFormSimple
 *
 * Formulario optimizado de creación y edición rápida de cliente:
 * - Soporte para RUC / Cédula paraguaya
 * - Ciudades con presets rápidos
 * - Límite de crédito en Guaraníes (₲) y plazos de pago
 * - Validación inteligente (no bloqueante para ventas rápidas)
 * - Diseño moderno, responsivo y adaptado al tema oscuro/claro
 */

import React, { useState, useEffect } from 'react'
import {
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertCircle,
  CreditCard,
  Building2,
  Package,
  Star,
  Check,
  ShieldCheck,
  Coins
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { canInviteCustomer } from '@/lib/customers/invite-customer-to-store'
import { validateCustomerContact, ALTERNATE_PHONE_LABELS } from '@/lib/customers/contact-rules'
import { formatThousands, parseThousands } from '@/lib/currency'

export interface SimpleCustomerFormData {
  firstName: string
  lastName?: string
  ruc?: string
  phone: string
  /** Contacto de un tercero, para avisarle cuando su equipo esta en el taller. */
  alternatePhone?: string
  /** De quien es ese telefono: sin esto nadie sabe con quien va a hablar. */
  alternatePhoneLabel?: string
  email: string
  city?: string
  address: string
  customerType: 'individual' | 'mayorista' | 'empresa' | 'vip'
  creditLimit?: string
  paymentTerms?: string
  notes: string
  /** Enviar invitación a la tienda pública para que el cliente cree su contraseña. */
  inviteToStore?: boolean
}

interface ValidationErrors {
  [key: string]: string
}

interface CustomerFormSimpleProps {
  initialData?: Partial<SimpleCustomerFormData>
  /** Ofrece invitar a la tienda pública. Solo tiene sentido al crear. */
  showStoreInvite?: boolean
  onSubmit: (data: SimpleCustomerFormData) => void
  onCancel?: () => void
  submitLabel?: string
  isSubmitting?: boolean
  className?: string
}

const customerTypeCards = [
  {
    value: 'individual' as const,
    label: 'Particular',
    sublabel: 'Consumidor final',
    icon: User,
  },
  {
    value: 'empresa' as const,
    label: 'Empresa',
    sublabel: 'Con RUC / Factura',
    icon: Building2,
  },
  {
    value: 'mayorista' as const,
    label: 'Mayorista',
    sublabel: 'Precios de reventa',
    icon: Package,
  },
  {
    value: 'vip' as const,
    label: 'VIP / Taller',
    sublabel: 'Cliente preferencial',
    icon: Star,
  },
]

const popularCities = [
  'Asunción',
  'San Lorenzo',
  'Luque',
  'Capiatá',
  'Lambaré',
  'Fernando de la Mora',
  'Ciudad del Este',
  'Encarnación'
]

// Las reglas viven en `@/lib/customers/contact-rules` para que este formulario y
// los dos de reparaciones dejen de pedir campos distintos para lo mismo.
function validateForm(data: SimpleCustomerFormData): ValidationErrors {
  const contactErrors = validateCustomerContact({
    name: data.firstName,
    phone: data.phone,
    email: data.email,
    alternatePhone: data.alternatePhone,
    alternatePhoneLabel: data.alternatePhoneLabel,
  })

  const errors: ValidationErrors = {}
  if (contactErrors.name) errors.firstName = contactErrors.name
  if (contactErrors.phone) errors.phone = contactErrors.phone
  if (contactErrors.email) errors.email = contactErrors.email
  if (contactErrors.alternatePhone) errors.alternatePhone = contactErrors.alternatePhone
  if (contactErrors.alternatePhoneLabel) errors.alternatePhoneLabel = contactErrors.alternatePhoneLabel

  return errors
}

export function CustomerFormSimple({
  initialData,
  showStoreInvite = false,
  onSubmit,
  onCancel,
  submitLabel = 'Guardar Cliente',
  isSubmitting = false,
  className
}: CustomerFormSimpleProps) {
  const [formData, setFormData] = useState<SimpleCustomerFormData>({
    inviteToStore: false,
    firstName: '',
    lastName: '',
    ruc: '',
    phone: '',
    email: '',
    city: 'Asunción',
    address: '',
    customerType: 'individual',
    creditLimit: '',
    paymentTerms: 'contado',
    notes: '',
    ...initialData
  })

  const [errors, setErrors] = useState<ValidationErrors>({})

  // Actualizar estado si initialData cambia
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData
      }))
    }
  }, [initialData])

  const handleInputChange = (field: keyof SimpleCustomerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const validationErrors = validateForm(formData)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length === 0) {
      onSubmit(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4 text-slate-800 dark:text-slate-200", className)}>
      {/* ─── Tipo de Cliente / Segmento (Pill Cards) ─── */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Tipo de Cliente
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {customerTypeCards.map((type) => {
            const isSelected = formData.customerType === type.value
            const Icon = type.icon
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => handleInputChange('customerType', type.value)}
                className={cn(
                  "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all relative cursor-pointer",
                  isSelected
                    ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-xs ring-1 ring-blue-500"
                    : "border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
                <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{type.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal leading-tight">
                  {type.sublabel}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Bloque 1: Identificación y Contacto ─── */}
      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <User className="h-3.5 w-3.5 text-blue-500" />
          <span>Datos Principales</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Nombre / Razón Social */}
          <div className="space-y-1">
            <Label htmlFor="firstName" className="text-xs font-medium flex items-center justify-between">
              <span>Nombre o Razón Social <span className="text-red-500">*</span></span>
            </Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              placeholder="Ej: Juan Carlos / Inversiones SRL"
              className={cn(
                "h-9 text-xs rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900",
                errors.firstName && "border-red-500 focus-visible:ring-red-500"
              )}
              autoFocus
            />
            {errors.firstName && (
              <p className="text-[11px] text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.firstName}
              </p>
            )}
          </div>

          {/* Apellido / Nombre Fantasía */}
          <div className="space-y-1">
            <Label htmlFor="lastName" className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Apellido / Fantasía (opcional)
            </Label>
            <Input
              id="lastName"
              value={formData.lastName || ''}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              placeholder="Ej: Pérez / Comercial"
              className="h-9 text-xs rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900"
            />
          </div>

          {/* RUC / Cédula de Identidad */}
          <div className="space-y-1">
            <Label htmlFor="ruc" className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              <span>RUC / Cédula (C.I.)</span>
            </Label>
            <Input
              id="ruc"
              value={formData.ruc || ''}
              onChange={(e) => handleInputChange('ruc', e.target.value)}
              placeholder="Ej: 4567890-1 ó 3456789"
              className="h-9 text-xs font-mono rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900"
            />
          </div>

          {/* Teléfono / WhatsApp */}
          <div className="space-y-1">
            <Label htmlFor="phone" className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              <span>Teléfono / WhatsApp <span className="text-red-500">*</span></span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="Ej: 0981 123456 ó +595 981..."
              className={cn(
                "h-9 text-xs font-mono rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900",
                errors.phone && "border-red-500 focus-visible:ring-red-500"
              )}
            />
            {errors.phone && (
              <p className="text-[11px] text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.phone}
              </p>
            )}
          </div>

          {/* Contacto alternativo.
              En un taller el celular del cliente suele ser el equipo que dejó:
              este es el número de un tercero al que sí se lo puede ubicar. */}
          <div className="space-y-1">
            <Label htmlFor="alternatePhone" className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              <span>Otro teléfono para avisarle (opcional)</span>
            </Label>
            <Input
              id="alternatePhone"
              type="tel"
              value={formData.alternatePhone || ''}
              onChange={(e) => handleInputChange('alternatePhone', e.target.value)}
              placeholder="Si deja su celular en reparación"
              className={cn(
                "h-9 text-xs font-mono rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900",
                errors.alternatePhone && "border-red-500 focus-visible:ring-red-500"
              )}
            />
            {errors.alternatePhone && (
              <p className="text-[11px] text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.alternatePhone}
              </p>
            )}
          </div>

          {/* Solo tiene sentido preguntar de quién es si hay un número cargado. */}
          {(formData.alternatePhone || '').trim().length > 0 && (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="alternatePhoneLabel" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                ¿De quién es ese teléfono? <span className="text-red-500">*</span>
              </Label>
              <Input
                id="alternatePhoneLabel"
                list="alternate-phone-labels"
                value={formData.alternatePhoneLabel || ''}
                onChange={(e) => handleInputChange('alternatePhoneLabel', e.target.value)}
                placeholder="Ej: hermana, jefe, hijo…"
                className={cn(
                  "h-9 text-xs rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900",
                  errors.alternatePhoneLabel && "border-red-500 focus-visible:ring-red-500"
                )}
              />
              <datalist id="alternate-phone-labels">
                {ALTERNATE_PHONE_LABELS.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
              {errors.alternatePhoneLabel && (
                <p className="text-[11px] text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.alternatePhoneLabel}
                </p>
              )}
            </div>
          )}

          {/* Correo Electrónico */}
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="email" className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              <span>Correo Electrónico (opcional)</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="cliente@ejemplo.com"
              className={cn(
                "h-9 text-xs rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900",
                errors.email && "border-red-500 focus-visible:ring-red-500"
              )}
            />
            {errors.email && (
              <p className="text-[11px] text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.email}
              </p>
            )}

            {/* Invitacion a la tienda publica. Se muestra siempre al crear,
                aunque todavia no haya correo: si solo apareciera al escribir
                uno, nadie que no sepa que existe la encontraria. Sin correo
                valido queda deshabilitada y explica que falta. */}
            {showStoreInvite && (() => {
              const canInvite = canInviteCustomer(formData.email)
              return (
                <label
                  htmlFor="invite-to-store"
                  className={cn(
                    'mt-1.5 flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors',
                    canInvite
                      ? 'cursor-pointer border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/20'
                      : 'cursor-not-allowed border-slate-200 bg-slate-50/60 opacity-70 dark:border-white/10 dark:bg-white/[0.02]'
                  )}
                >
                  <input
                    id="invite-to-store"
                    type="checkbox"
                    disabled={!canInvite}
                    checked={canInvite && Boolean(formData.inviteToStore)}
                    onChange={(e) => handleInputChange('inviteToStore', e.target.checked as never)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-indigo-600 disabled:cursor-not-allowed"
                  />
                  <span className="text-[11px] leading-relaxed">
                    <span className={cn(
                      'font-semibold',
                      canInvite
                        ? 'text-indigo-900 dark:text-indigo-200'
                        : 'text-slate-600 dark:text-slate-400'
                    )}>
                      Invitar a la tienda online
                    </span>
                    <span className={cn(
                      'block',
                      canInvite
                        ? 'text-indigo-700/80 dark:text-indigo-300/80'
                        : 'text-slate-500 dark:text-slate-400'
                    )}>
                      {canInvite
                        ? `Le enviamos un correo a ${formData.email.trim()} para que cree su contraseña y pueda ver sus compras y pedidos.`
                        : 'Cargá un correo arriba para poder enviarle la invitación.'}
                    </span>
                  </span>
                </label>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ─── Bloque 2: Ubicación ─── */}
      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <MapPin className="h-3.5 w-3.5 text-emerald-500" />
          <span>Ubicación y Dirección</span>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <Label htmlFor="city" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Ciudad
              </Label>
              <Input
                id="city"
                value={formData.city || ''}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="Ej: Asunción"
                className="h-9 text-xs rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="address" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Dirección / Referencia (opcional)
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Ej: Av. Eusebio Ayala c/ Choferes del Chaco"
                className="h-9 text-xs rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          {/* Quick city suggestions */}
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <span className="text-[10px] text-slate-400 mr-1">Sugerencias:</span>
            {popularCities.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => handleInputChange('city', city)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer",
                  formData.city === city
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold"
                    : "border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Bloque 3: Condiciones Comerciales y Crédito ─── */}
      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            <span>Comercial y Crédito</span>
          </div>
          {Number(formData.creditLimit) > 0 ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold">
              Crédito Habilitado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200 dark:border-white/10">
              Sin Crédito
            </Badge>
          )}
        </div>

        {/* Botón de Habilitar Límite de Crédito si está deshabilitado */}
        {(!formData.creditLimit || Number(formData.creditLimit) <= 0) ? (
          <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                <span>¿Habilitar compras y reparaciones a crédito?</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Permite al cliente financiar en cuotas o retirar equipos con saldo pendiente.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                onClick={() => handleInputChange('creditLimit', '1000000')}
                className="h-7 px-2.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1 shadow-xs"
              >
                <CreditCard className="h-3 w-3" />
                Habilitar Crédito
              </Button>
              <button
                type="button"
                onClick={() => handleInputChange('creditLimit', '500000')}
                className="text-[10px] px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 font-semibold text-slate-600 dark:text-slate-400"
              >
                ₲ 500.000
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('creditLimit', '2000000')}
                className="text-[10px] px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 font-semibold text-slate-600 dark:text-slate-400"
              >
                ₲ 2.000.000
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Límite de Crédito en Guaraníes */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="creditLimit" className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Límite de Crédito (₲ Guaraníes)</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => handleInputChange('creditLimit', '0')}
                    className="text-[10px] text-red-500 hover:underline font-medium"
                  >
                    Deshabilitar
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₲</span>
                  <Input
                    id="creditLimit"
                    type="text"
                    inputMode="numeric"
                    value={formatThousands(formData.creditLimit)}
                    onChange={(e) => handleInputChange('creditLimit', parseThousands(e.target.value).toString())}
                    placeholder="Ej: 1.000.000"
                    className="pl-7 h-9 text-xs font-mono font-bold rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              {/* Términos de Pago */}
              <div className="space-y-1">
                <Label htmlFor="paymentTerms" className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span>Condición de Pago Habitual</span>
                </Label>
                <Select
                  value={formData.paymentTerms || 'contado'}
                  onValueChange={(value) => handleInputChange('paymentTerms', value)}
                >
                  <SelectTrigger className="h-9 text-xs rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Seleccionar condición..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contado">Al Contado</SelectItem>
                    <SelectItem value="15_dias">Crédito 15 Días</SelectItem>
                    <SelectItem value="30_dias">Crédito 30 Días</SelectItem>
                    <SelectItem value="60_dias">Crédito 60 Días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Presets rápidos de crédito */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-slate-400 mr-1">Montos rápidos:</span>
              {['500000', '1000000', '2000000', '3000000', '5000000', '10000000'].map((amt) => {
                const formatted = Number(amt).toLocaleString('es-PY')
                const isCurrent = formData.creditLimit === amt
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleInputChange('creditLimit', amt)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer",
                      isCurrent
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold"
                        : "border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    ₲ {formatted}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Observaciones / Notas */}
        <div className="space-y-1">
          <Label htmlFor="notes" className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Notas u Observaciones (opcional)
          </Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Preferencias del cliente, recomendaciones, contactos alternativos..."
            className="min-h-[55px] text-xs rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 resize-none"
          />
        </div>
      </div>

      {/* ─── Botones de Acción ─── */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-9 px-4 text-xs font-semibold rounded-xl border-slate-200 dark:border-white/10"
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-9 px-5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20"
        >
          {isSubmitting ? 'Guardando...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
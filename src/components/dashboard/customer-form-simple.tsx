'use client'

/**
 * CustomerFormSimple
 *
 * Formulario simplificado de cliente basado en el patrón del sistema de reparaciones:
 * - Solo campos esenciales
 * - Validación básica
 * - Interfaz limpia y compacta
 * - Fácil de usar y entender
 */

import React, { useState, useEffect } from 'react'
import { User, Phone, Mail, MapPin, FileText, AlertCircle, Check, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface SimpleCustomerFormData {
  firstName: string
  lastName: string
  phone: string
  email: string
  address: string
  customerType: 'individual' | 'mayorista' | 'empresa'
  creditLimit?: string
  paymentTerms?: string
  notes: string
}

interface ValidationErrors {
  [key: string]: string
}

interface CustomerFormSimpleProps {
  initialData?: Partial<SimpleCustomerFormData>
  onSubmit: (data: SimpleCustomerFormData) => void
  onCancel?: () => void
  submitLabel?: string
  isSubmitting?: boolean
  className?: string
}

const customerTypeOptions = [
  { value: 'individual', label: 'Individual', icon: User },
  { value: 'mayorista', label: 'Mayorista', icon: User },
  { value: 'empresa', label: 'Empresa', icon: User },
]

function validateForm(data: SimpleCustomerFormData): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.firstName = 'El nombre es obligatorio (mín. 2 caracteres)'
  }

  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.lastName = 'El apellido es obligatorio (mín. 2 caracteres)'
  }

  if (!data.phone || !/^\+?[0-9\s-]{7,}$/.test(data.phone)) {
    errors.phone = 'Teléfono inválido'
  }

  if (data.email && !/.+@.+\..+/.test(data.email)) {
    errors.email = 'Correo inválido'
  }

  if (!data.address || data.address.trim().length < 5) {
    errors.address = 'La dirección es obligatoria (mín. 5 caracteres)'
  }

  if (!data.customerType) {
    errors.customerType = 'Selecciona un tipo de cliente'
  }

  return errors
}

export function CustomerFormSimple({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Guardar Cliente',
  isSubmitting = false,
  className
}: CustomerFormSimpleProps) {
  const [formData, setFormData] = useState<SimpleCustomerFormData>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    customerType: 'individual',
    notes: '',
    ...initialData
  })

  const [errors, setErrors] = useState<ValidationErrors>({})
  const [formProgress, setFormProgress] = useState(0)

  // Calcular progreso del formulario
  useEffect(() => {
    const requiredFields = ['firstName', 'lastName', 'phone', 'address', 'customerType']
    const filledFields = requiredFields.filter(field => {
      const value = formData[field as keyof SimpleCustomerFormData]
      return value && value.toString().trim().length > 0
    })
    setFormProgress((filledFields.length / requiredFields.length) * 100)
  }, [formData])

  const handleInputChange = (field: keyof SimpleCustomerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Limpiar error del campo cuando el usuario empiece a escribir
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

  const getFieldIcon = (field: keyof SimpleCustomerFormData) => {
    if (errors[field]) {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }

    const value = formData[field]
    if (value && value.toString().trim().length > 0) {
      return <Check className="h-4 w-4 text-green-500" />
    }

    return null
  }

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          Información del Cliente
        </CardTitle>
        {formProgress > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${formProgress}%` }}
            />
          </div>
        )}
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información Personal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium flex items-center gap-1">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="Ej: Juan"
                  className={cn(
                    'pr-10',
                    errors.firstName ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'
                  )}
                />
                <div className="absolute right-3 top-3">
                  {getFieldIcon('firstName')}
                </div>
              </div>
              {errors.firstName && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.firstName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium flex items-center gap-1">
                Apellido <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Ej: Pérez"
                  className={cn(
                    'pr-10',
                    errors.lastName ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'
                  )}
                />
                <div className="absolute right-3 top-3">
                  {getFieldIcon('lastName')}
                </div>
              </div>
              {errors.lastName && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.lastName}
                </p>
              )}
            </div>
          </div>

          {/* Información de Contacto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-1">
                <Phone className="h-4 w-4" />
                Teléfono <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+598 99 123 456"
                  className={cn(
                    'pr-10',
                    errors.phone ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'
                  )}
                />
                <div className="absolute right-3 top-3">
                  {getFieldIcon('phone')}
                </div>
              </div>
              {errors.phone && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.phone}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-1">
                <Mail className="h-4 w-4" />
                Email (opcional)
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="cliente@email.com"
                  className={cn(
                    'pr-10',
                    errors.email ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'
                  )}
                />
                <div className="absolute right-3 top-3">
                  {getFieldIcon('email')}
                </div>
              </div>
              {errors.email && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email}
                </p>
              )}
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              Dirección <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Ej: Av. 18 de Julio 1234"
                className={cn(
                  'pr-10',
                  errors.address ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'
                )}
              />
              <div className="absolute right-3 top-3">
                {getFieldIcon('address')}
              </div>
            </div>
            {errors.address && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.address}
              </p>
            )}
          </div>

          {/* Tipo de Cliente */}
          <div className="space-y-2">
            <Label htmlFor="customerType" className="text-sm font-medium flex items-center gap-1">
              Tipo de Cliente <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.customerType}
              onValueChange={(value: 'individual' | 'mayorista' | 'empresa') => handleInputChange('customerType', value)}
            >
              <SelectTrigger className={cn(
                errors.customerType ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customerTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customerType && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.customerType}
              </p>
            )}
          </div>

          {/* Información Financiera */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="creditLimit" className="text-sm font-medium flex items-center gap-1">
                <CreditCard className="h-4 w-4" />
                Límite de Crédito
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <Input
                  id="creditLimit"
                  type="number"
                  min="0"
                  step="100"
                  value={formData.creditLimit || ''}
                  onChange={(e) => handleInputChange('creditLimit', e.target.value)}
                  placeholder="0.00"
                  className="pl-7 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentTerms" className="text-sm font-medium flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Términos de Pago
              </Label>
              <Select
                value={formData.paymentTerms}
                onValueChange={(value) => handleInputChange('paymentTerms', value)}
              >
                <SelectTrigger className="focus:border-blue-500">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contado">Contado</SelectItem>
                  <SelectItem value="15_dias">15 Días</SelectItem>
                  <SelectItem value="30_dias">30 Días</SelectItem>
                  <SelectItem value="60_dias">60 Días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Notas (opcional)
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Información adicional sobre el cliente..."
              className="min-h-[80px] focus:border-blue-500"
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || formProgress < 80}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Guardando...' : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
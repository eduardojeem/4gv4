/**
 * Customer Form Utilities
 *
 * Utilidades y helpers para el formulario de edición de clientes
 */

import { z } from 'zod'

// Validation helpers
export const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
export const rucRegex = /^[A-Z0-9]{10,13}$/

// Custom validation functions
export const validatePhone = (phone: string): boolean => {
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validateRUC = (ruc: string): boolean => {
  return rucRegex.test(ruc.replace(/[-\s]/g, ''))
}

// Format helpers
export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

export const formatRUC = (ruc: string): string => {
  const cleaned = ruc.replace(/\W/g, '').toUpperCase()
  if (cleaned.length >= 10) {
    return cleaned.slice(0, 13)
  }
  return cleaned
}

// Suggestion generators
export const generateEmailSuggestions = (name: string, company?: string): string[] => {
  if (!name) return []

  const nameParts = name.toLowerCase().split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]

  const suggestions = [
    `${firstName}.${lastName}@gmail.com`,
    `${firstName}${lastName}@gmail.com`,
    `${firstName}@${company?.toLowerCase().replace(/\s/g, '') || 'empresa'}.com`,
    `${firstName}.${lastName}@${company?.toLowerCase().replace(/\s/g, '') || 'empresa'}.com`
  ]

  return suggestions.filter((suggestion, index, self) => self.indexOf(suggestion) === index)
}

export const generateUsernameSuggestions = (name: string): string[] => {
  if (!name) return []

  const nameParts = name.toLowerCase().split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]

  return [
    `${firstName}${lastName}`,
    `${firstName}.${lastName}`,
    `${firstName}_${lastName}`,
    `${firstName}${lastName}123`
  ]
}

// Data transformation helpers
export const transformFormDataToCustomer = <T extends Record<string, unknown>>(formData: T): T => {
  return {
    ...formData,
    name: typeof formData.name === 'string' ? formData.name.trim() : formData.name,
    email: typeof formData.email === 'string' ? formData.email.toLowerCase().trim() : formData.email,
    phone: typeof formData.phone === 'string' ? formData.phone.replace(/\D/g, '') : formData.phone,
    whatsapp: typeof formData.whatsapp === 'string' ? formData.whatsapp.replace(/\D/g, '') : formData.whatsapp,
    address: typeof formData.address === 'string' ? formData.address.trim() : formData.address,
    city: typeof formData.city === 'string' ? formData.city.trim() : formData.city,
    company: typeof formData.company === 'string' ? formData.company.trim() : formData.company,
    position: typeof formData.position === 'string' ? formData.position.trim() : formData.position,
    ruc: typeof formData.ruc === 'string' ? formData.ruc.replace(/\W/g, '').toUpperCase() : formData.ruc,
    notes: typeof formData.notes === 'string' ? formData.notes.trim() : formData.notes,
  }
}

// Validation schema with custom messages
export const createCustomerValidationSchema = () => {
  return z.object({
    name: z.string()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(100, 'El nombre no puede exceder 100 caracteres')
      .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios'),

    email: z.string()
      .email('Formato de email inválido')
      .max(255, 'El email no puede exceder 255 caracteres')
      .refine(validateEmail, 'Email inválido'),

    phone: z.string()
      .min(10, 'El teléfono debe tener al menos 10 dígitos')
      .max(15, 'El teléfono no puede exceder 15 dígitos')
      .refine(validatePhone, 'Formato de teléfono inválido'),

    whatsapp: z.string()
      .optional()
      .refine((val) => !val || validatePhone(val), 'Formato de WhatsApp inválido'),

    ruc: z.string()
      .optional()
      .refine((val) => !val || validateRUC(val), 'Formato de RUC inválido'),

    credit_limit: z.number()
      .min(0, 'El límite de crédito no puede ser negativo')
      .max(1000000, 'El límite de crédito no puede exceder $1,000,000'),

    discount_percentage: z.number()
      .min(0, 'El descuento no puede ser negativo')
      .max(100, 'El descuento no puede exceder 100%'),

    // ... otros campos con validaciones específicas
  })
}

// Form step validation
export const validateFormStep = (stepId: string, formData: Record<string, unknown>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []

  switch (stepId) {
    case 'basic': {
      const name = typeof formData.name === 'string' ? formData.name.trim() : ''
      const email = typeof formData.email === 'string' ? formData.email.trim() : ''
      const phone = typeof formData.phone === 'string' ? formData.phone.trim() : ''
      if (!name) errors.push('El nombre es requerido')
      if (!email) errors.push('El email es requerido')
      if (!phone) errors.push('El teléfono es requerido')
      if (email && !validateEmail(email)) errors.push('Email inválido')
      if (phone && !validatePhone(phone)) errors.push('Teléfono inválido')
      break
    }

    case 'contact':
      // Validaciones opcionales para información de contacto
      break

    case 'classification':
      if (!formData.customer_type) errors.push('El tipo de cliente es requerido')
      if (!formData.segment) errors.push('El segmento es requerido')
      if (!formData.status) errors.push('El estado es requerido')
      break

    case 'financial': {
      const creditLimit = Number(formData.credit_limit) || 0
      const discountPercentage = Number(formData.discount_percentage) || 0
      if (creditLimit < 0) errors.push('El límite de crédito no puede ser negativo')
      if (discountPercentage < 0 || discountPercentage > 100) {
        errors.push('El descuento debe estar entre 0% y 100%')
      }
      break
    }

    case 'preferences':
      if (!formData.preferred_contact) errors.push('El método de contacto preferido es requerido')
      break

    case 'additional':
      // Validaciones opcionales para información adicional
      break
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Progress calculation
export const calculateFormProgress = (formData: Record<string, unknown>): number => {
  const requiredFields = [
    'name', 'email', 'phone', 'customer_type', 'segment', 'status', 'preferred_contact'
  ]

  const optionalFields = [
    'whatsapp', 'address', 'city', 'company', 'position', 'ruc',
    'credit_limit', 'discount_percentage', 'payment_terms', 'tags', 'notes', 'birthday'
  ]

  const allFields = [...requiredFields, ...optionalFields]

  let filledFields = 0

  allFields.forEach(field => {
    const value = formData[field]
    if (value !== undefined && value !== null && value !== '' &&
        (Array.isArray(value) ? value.length > 0 : true)) {
      filledFields++
    }
  })

  return Math.round((filledFields / allFields.length) * 100)
}

// Auto-save helpers
export const shouldAutoSave = (formData: Record<string, unknown>, lastSavedData: Record<string, unknown> | null | undefined): boolean => {
  if (!lastSavedData) return true

  // Compare relevant fields for changes
  const fieldsToCompare = [
    'name', 'email', 'phone', 'whatsapp', 'address', 'city',
    'company', 'position', 'ruc', 'customer_type', 'segment',
    'status', 'credit_limit', 'discount_percentage', 'payment_terms',
    'preferred_contact', 'notes'
  ]

  return fieldsToCompare.some(field => formData[field] !== lastSavedData[field])
}

// Export utilities
export const exportFormDataAsJSON = (formData: Record<string, unknown>): string => {
  return JSON.stringify(transformFormDataToCustomer(formData), null, 2)
}

export const importFormDataFromJSON = (jsonString: string): unknown => {
  try {
    return JSON.parse(jsonString)
  } catch (_error) {
    throw new Error('Formato JSON inválido')
  }
}
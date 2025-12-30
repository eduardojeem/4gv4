import { ProductFormData } from '@/types/products'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
}

/**
 * Valida los datos del formulario de producto
 */
export async function validateProductForm(
  formData: ProductFormData,
  isEditing: boolean = false
): Promise<ValidationResult> {
  const errors: Record<string, string> = {}

  // ===== VALIDACIONES BÁSICAS =====
  
  // Nombre
  if (!formData.name?.trim()) {
    errors.name = 'El nombre es requerido'
  } else if (formData.name.length < 3) {
    errors.name = 'El nombre debe tener al menos 3 caracteres'
  } else if (formData.name.length > 200) {
    errors.name = 'El nombre no puede exceder 200 caracteres'
  }

  // SKU
  if (!formData.sku?.trim()) {
    errors.sku = 'El SKU es requerido'
  } else if (formData.sku.length < 3) {
    errors.sku = 'El SKU debe tener al menos 3 caracteres'
  } else if (!/^[A-Z0-9-_]+$/i.test(formData.sku)) {
    errors.sku = 'El SKU solo puede contener letras, números, guiones y guiones bajos'
  } else if (!isEditing) {
    // Validar SKU único solo para productos nuevos
    const isUnique = await checkSKUUnique(formData.sku)
    if (!isUnique) {
      errors.sku = 'Este SKU ya existe. Por favor usa otro código.'
    }
  }

  // ===== VALIDACIONES DE PRECIOS =====
  
  // Precio de compra
  if (formData.purchase_price < 0) {
    errors.purchase_price = 'El precio de compra no puede ser negativo'
  }

  // Precio de venta
  if (!formData.sale_price || formData.sale_price <= 0) {
    errors.sale_price = 'El precio de venta es requerido y debe ser mayor a 0'
  }

  // Validación de negocio: precio venta > precio compra
  if (formData.purchase_price > 0 && formData.sale_price > 0) {
    if (formData.sale_price <= formData.purchase_price) {
      errors.sale_price = 'El precio de venta debe ser mayor al precio de compra'
    } else {
      // Validar margen mínimo (10%)
      const margin = ((formData.sale_price - formData.purchase_price) / formData.sale_price) * 100
      if (margin < 10) {
        errors.sale_price = `Margen muy bajo (${margin.toFixed(1)}%). Se recomienda mínimo 10%`
      }
    }
  }

  // Precio mayorista
  if (formData.wholesale_price && formData.wholesale_price > 0) {
    if (formData.wholesale_price < 0) {
      errors.wholesale_price = 'El precio mayorista no puede ser negativo'
    } else if (formData.wholesale_price >= formData.sale_price) {
      errors.wholesale_price = 'El precio mayorista debe ser menor al precio de venta'
    } else if (formData.wholesale_price <= formData.purchase_price) {
      errors.wholesale_price = 'El precio mayorista debe ser mayor al precio de compra'
    }
  }

  // Precio de oferta
  if (formData.has_offer) {
    if (!formData.offer_price || formData.offer_price <= 0) {
      errors.offer_price = 'El precio de oferta es requerido cuando la oferta está activa'
    } else if (formData.offer_price >= formData.sale_price) {
      errors.offer_price = 'El precio de oferta debe ser menor al precio de venta'
    } else if (formData.offer_price <= formData.purchase_price) {
      errors.offer_price = 'El precio de oferta debe ser mayor al precio de compra para mantener rentabilidad'
    } else {
      // Validar descuento mínimo (5%)
      const discount = ((formData.sale_price - formData.offer_price) / formData.sale_price) * 100
      if (discount < 5) {
        errors.offer_price = `Descuento muy bajo (${discount.toFixed(1)}%). Se recomienda mínimo 5%`
      }
    }
  }

  // ===== VALIDACIONES DE INVENTARIO =====
  
  // Stock actual
  if (formData.stock_quantity < 0) {
    errors.stock_quantity = 'El stock no puede ser negativo'
  }

  // Stock mínimo
  if (formData.min_stock < 0) {
    errors.min_stock = 'El stock mínimo no puede ser negativo'
  }

  // Stock máximo
  if (formData.max_stock !== undefined && formData.max_stock !== null) {
    if (formData.max_stock < 0) {
      errors.max_stock = 'El stock máximo no puede ser negativo'
    } else if (formData.max_stock > 0 && formData.max_stock <= formData.min_stock) {
      errors.max_stock = 'El stock máximo debe ser mayor al stock mínimo'
    }
  }

  // Validar sobrestock
  if (formData.max_stock && formData.max_stock > 0 && formData.stock_quantity > formData.max_stock) {
    errors.stock_quantity = `Stock actual excede el máximo permitido (${formData.max_stock})`
  }

  // ===== VALIDACIONES OPCIONALES =====
  
  // Código de barras
  if (formData.barcode && formData.barcode.trim()) {
    if (!validateBarcode(formData.barcode)) {
      errors.barcode = 'Formato de código de barras inválido (debe ser EAN-8, EAN-13 o UPC-A)'
    }
  }

  // Descripción
  if (formData.description && formData.description.length > 1000) {
    errors.description = 'La descripción no puede exceder 1000 caracteres'
  }

  // Marca
  if (formData.brand && formData.brand.length > 100) {
    errors.brand = 'La marca no puede exceder 100 caracteres'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Valida formato de código de barras (EAN-8, EAN-13, UPC-A)
 */
export function validateBarcode(barcode: string): boolean {
  // Eliminar espacios
  const cleaned = barcode.replace(/\s/g, '')
  
  // Validar longitud (8, 12 o 13 dígitos)
  if (!/^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$/.test(cleaned)) {
    return false
  }

  // Validar dígito verificador
  return validateBarcodeChecksum(cleaned)
}

/**
 * Valida el dígito verificador del código de barras
 */
function validateBarcodeChecksum(barcode: string): boolean {
  const digits = barcode.split('').map(Number)
  const checkDigit = digits.pop()!
  
  let sum = 0
  digits.forEach((digit, index) => {
    // Para EAN-13 y UPC-A, alternar multiplicadores 1 y 3
    const multiplier = index % 2 === 0 ? 1 : 3
    sum += digit * multiplier
  })
  
  const calculatedCheckDigit = (10 - (sum % 10)) % 10
  return calculatedCheckDigit === checkDigit
}

/**
 * Verifica si un SKU es único (consulta al servidor)
 */
async function checkSKUUnique(sku: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/products/check-sku?sku=${encodeURIComponent(sku)}`)
    
    if (!response.ok) {
      console.error('Error checking SKU uniqueness')
      return true // En caso de error, permitir continuar
    }
    
    const data = await response.json()
    return data.isUnique
  } catch (error) {
    console.error('Error checking SKU:', error)
    return true // En caso de error, permitir continuar
  }
}

/**
 * Genera un código EAN-13 válido
 */
export function generateEAN13(prefix: string = '750'): string {
  // Generar 9 dígitos aleatorios
  const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')
  const code = prefix + random
  
  // Calcular dígito verificador
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const checkDigit = (10 - (sum % 10)) % 10
  
  return code + checkDigit
}

/**
 * Calcula el margen de ganancia
 */
export function calculateMargin(purchasePrice: number, salePrice: number): number {
  if (purchasePrice <= 0 || salePrice <= 0) return 0
  return ((salePrice - purchasePrice) / salePrice) * 100
}

/**
 * Calcula el descuento
 */
export function calculateDiscount(originalPrice: number, discountPrice: number): number {
  if (originalPrice <= 0 || discountPrice <= 0) return 0
  return ((originalPrice - discountPrice) / originalPrice) * 100
}

/**
 * Valida que un precio sea válido
 */
export function isValidPrice(price: number): boolean {
  return price >= 0 && !isNaN(price) && isFinite(price)
}

/**
 * Valida que una cantidad sea válida
 */
export function isValidQuantity(quantity: number): boolean {
  return quantity >= 0 && Number.isInteger(quantity)
}

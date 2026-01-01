/**
 * Sistema de validación para productos
 * Asegura que toda la información sea precisa, actualizada, relevante y consistente
 */

import { z } from 'zod'

// Esquema de validación para productos
export const ProductSchema = z.object({
  id: z.string().min(1, 'ID es requerido'),
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .refine(val => val.trim().length > 0, 'El nombre no puede estar vacío'),
  
  sku: z.string()
    .min(3, 'SKU debe tener al menos 3 caracteres')
    .max(50, 'SKU no puede exceder 50 caracteres')
    .regex(/^[A-Z0-9-_]+$/, 'SKU solo puede contener letras mayúsculas, números, guiones y guiones bajos'),
  
  category: z.string()
    .min(1, 'Categoría es requerida')
    .max(50, 'Categoría no puede exceder 50 caracteres'),
  
  description: z.string()
    .max(500, 'Descripción no puede exceder 500 caracteres')
    .optional(),
  
  sale_price: z.number()
    .positive('El precio de venta debe ser positivo')
    .max(999999999, 'Precio de venta demasiado alto'),
  
  cost_price: z.number()
    .positive('El precio de costo debe ser positivo')
    .max(999999999, 'Precio de costo demasiado alto'),
  
  stock_quantity: z.number()
    .int('La cantidad debe ser un número entero')
    .min(0, 'La cantidad no puede ser negativa'),
  
  min_stock: z.number()
    .int('El stock mínimo debe ser un número entero')
    .min(0, 'El stock mínimo no puede ser negativo'),
  
  status: z.enum(['active', 'inactive'], {
    errorMap: () => ({ message: 'Estado debe ser activo o inactivo' })
  }),
  
  image: z.string()
    .url('URL de imagen inválida')
    .optional()
    .or(z.literal('')),
    
  image_url: z.string()
    .url('URL de imagen inválida')
    .optional()
    .or(z.literal('')),
  
  supplier: z.string()
    .max(100, 'Proveedor no puede exceder 100 caracteres')
    .optional(),
  
  barcode: z.string()
    .max(50, 'Código de barras no puede exceder 50 caracteres')
    .optional(),
  
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
}).refine(
  (data) => data.sale_price > data.cost_price,
  {
    message: 'El precio de venta debe ser mayor al precio de costo',
    path: ['sale_price']
  }
).refine(
  (data) => data.min_stock <= data.stock_quantity || data.stock_quantity === 0,
  {
    message: 'El stock mínimo no puede ser mayor al stock actual (excepto cuando stock es 0)',
    path: ['min_stock']
  }
)

export type Product = z.infer<typeof ProductSchema>

// Validaciones específicas para diferentes contextos
export const ProductCreateSchema = ProductSchema.omit({ 
  id: true, 
  created_at: true, 
  updated_at: true 
})

export const ProductUpdateSchema = ProductSchema.partial().extend({
  id: z.string().min(1, 'ID es requerido'),
  updated_at: z.string().datetime().optional()
})

// Validaciones de negocio
export class ProductValidator {
  /**
   * Valida que el margen de ganancia sea aceptable
   */
  static validateMargin(salePrice: number, costPrice: number, minMarginPercent: number = 10): boolean {
    const margin = ((salePrice - costPrice) / salePrice) * 100
    return margin >= minMarginPercent
  }

  /**
   * Valida que el stock esté en niveles saludables
   */
  static validateStockHealth(stockQuantity: number, minStock: number): 'healthy' | 'low' | 'out' {
    if (stockQuantity === 0) return 'out'
    if (stockQuantity <= minStock) return 'low'
    return 'healthy'
  }

  /**
   * Valida que el SKU sea único en el sistema
   */
  static async validateUniqueSku(sku: string, existingProducts: Product[], excludeId?: string): Promise<boolean> {
    const duplicates = existingProducts.filter(p => 
      p.sku.toLowerCase() === sku.toLowerCase() && p.id !== excludeId
    )
    return duplicates.length === 0
  }

  /**
   * Valida que el nombre del producto sea único en la misma categoría
   */
  static validateUniqueNameInCategory(
    name: string, 
    category: string, 
    existingProducts: Product[], 
    excludeId?: string
  ): boolean {
    const duplicates = existingProducts.filter(p => 
      p.name.toLowerCase() === name.toLowerCase() && 
      p.category === category && 
      p.id !== excludeId
    )
    return duplicates.length === 0
  }

  /**
   * Valida que los precios estén dentro de rangos razonables para la categoría
   */
  static validatePriceRange(
    salePrice: number, 
    category: string, 
    categoryPriceRanges: Record<string, { min: number; max: number }>
  ): boolean {
    const range = categoryPriceRanges[category]
    if (!range) return true // Si no hay rango definido, se acepta cualquier precio
    
    return salePrice >= range.min && salePrice <= range.max
  }

  /**
   * Valida que la información esté actualizada (no muy antigua)
   */
  static validateDataFreshness(updatedAt: string, maxAgeInDays: number = 90): boolean {
    const updateDate = new Date(updatedAt)
    const now = new Date()
    const daysDiff = (now.getTime() - updateDate.getTime()) / (1000 * 3600 * 24)
    
    return daysDiff <= maxAgeInDays
  }
}

// Utilidades para limpieza y normalización de datos
export class ProductDataCleaner {
  /**
   * Normaliza el nombre del producto
   */
  static normalizeName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
      .replace(/[^\w\s-]/g, '') // Remover caracteres especiales excepto guiones
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  /**
   * Normaliza el SKU
   */
  static normalizeSku(sku: string): string {
    return sku
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-_]/g, '') // Solo letras, números, guiones y guiones bajos
  }

  /**
   * Normaliza la categoría
   */
  static normalizeCategory(category: string): string {
    return category
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
  }

  /**
   * Limpia y valida URL de imagen
   */
  static cleanImageUrl(url: string): string | null {
    if (!url || url.trim() === '') return null
    
    const cleanUrl = url.trim()
    
    // Validar que sea una URL válida
    try {
      new URL(cleanUrl)
      return cleanUrl
    } catch {
      return null
    }
  }

  /**
   * Redondea precios a 2 decimales
   */
  static roundPrice(price: number): number {
    return Math.round(price * 100) / 100
  }
}

// Constantes para validación
export const VALIDATION_CONSTANTS = {
  MAX_NAME_LENGTH: 100,
  MAX_SKU_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_CATEGORY_LENGTH: 50,
  MIN_MARGIN_PERCENT: 10,
  MAX_PRICE: 999999999,
  DATA_FRESHNESS_DAYS: 90,
  
  // Rangos de precios por categoría (ejemplo)
  CATEGORY_PRICE_RANGES: {
    'electronics': { min: 10000, max: 50000000 },
    'clothing': { min: 5000, max: 1000000 },
    'food': { min: 1000, max: 500000 },
    'books': { min: 2000, max: 200000 },
    'home': { min: 5000, max: 10000000 }
  } as Record<string, { min: number; max: number }>,
  
  // Categorías válidas
  VALID_CATEGORIES: [
    'electronics',
    'clothing',
    'food',
    'books',
    'home',
    'sports',
    'beauty',
    'automotive',
    'toys',
    'health'
  ] as const
}

// Función helper para validar un producto completo
export async function validateProduct(
  product: Partial<Product>, 
  existingProducts: Product[] = [],
  isUpdate: boolean = false
): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = []

  try {
    // Validación de esquema
    if (isUpdate) {
      ProductUpdateSchema.parse(product)
    } else {
      ProductCreateSchema.parse(product)
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...(error as z.ZodError).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`))
    }
  }

  // Validaciones de negocio
  if (product.sale_price && product.cost_price) {
    if (!ProductValidator.validateMargin(product.sale_price, product.cost_price)) {
      errors.push('El margen de ganancia es muy bajo (mínimo 10%)')
    }
  }

  if (product.sku) {
    const isUniqueSku = await ProductValidator.validateUniqueSku(
      product.sku, 
      existingProducts, 
      product.id
    )
    if (!isUniqueSku) {
      errors.push('El SKU ya existe en el sistema')
    }
  }

  if (product.name && product.category) {
    const isUniqueNameInCategory = ProductValidator.validateUniqueNameInCategory(
      product.name,
      product.category,
      existingProducts,
      product.id
    )
    if (!isUniqueNameInCategory) {
      errors.push('Ya existe un producto con este nombre en la misma categoría')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Hook para validación en tiempo real
export function useProductValidation() {
  const validateField = (field: keyof Product, value: unknown, product: Partial<Product>) => {
    try {
      const fieldSchema = ProductSchema.shape[field]
      fieldSchema.parse(value)
      return { isValid: true, error: null }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          isValid: false, 
          error: (error as z.ZodError).errors[0]?.message || 'Valor inválido' 
        }
      }
      return { isValid: false, error: 'Error de validación' }
    }
  }

  const validateMargin = (salePrice: number, costPrice: number) => {
    return ProductValidator.validateMargin(salePrice, costPrice)
  }

  const validateStockHealth = (stockQuantity: number, minStock: number) => {
    return ProductValidator.validateStockHealth(stockQuantity, minStock)
  }

  return {
    validateField,
    validateMargin,
    validateStockHealth,
    validateProduct
  }
}
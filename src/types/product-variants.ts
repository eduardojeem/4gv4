// Tipos para el sistema de variantes de productos

export interface VariantAttribute {
  id: string
  name: string // ej: "Color", "Talla", "Material"
  type: 'color' | 'size' | 'text' | 'number'
  required: boolean
  options: VariantOption[]
  created_at: string
  updated_at: string
}

export interface VariantOption {
  id: string
  attribute_id: string
  value: string // ej: "Rojo", "XL", "Algodón"
  display_value?: string // Valor para mostrar (opcional)
  color_hex?: string // Para atributos de color
  sort_order: number
  active: boolean
}

export interface ProductVariant {
  id: string
  product_id: string
  sku: string // SKU único para la variante
  barcode?: string
  name: string // Nombre descriptivo de la variante
  
  // Atributos de la variante
  attributes: VariantAttributeValue[]
  
  // Precios específicos de la variante
  price: number
  wholesale_price?: number
  cost_price?: number
  
  // Inventario específico de la variante
  stock: number
  min_stock: number
  max_stock?: number
  
  // Estado y metadatos
  active: boolean
  weight?: number
  dimensions?: {
    length?: number
    width?: number
    height?: number
  }
  
  // Imágenes específicas de la variante
  images?: string[]
  
  created_at: string
  updated_at: string
}

export interface VariantAttributeValue {
  attribute_id: string
  attribute_name: string
  option_id: string
  value: string
  display_value?: string
  color_hex?: string
}

// Producto extendido con variantes
export interface ProductWithVariants {
  id: string
  name: string
  description?: string
  category_id?: string
  brand?: string
  
  // Configuración de variantes
  has_variants: boolean
  variant_attributes: string[] // IDs de atributos usados
  
  // Precio base (si no tiene variantes)
  base_price?: number
  base_wholesale_price?: number
  base_cost_price?: number
  
  // Stock base (si no tiene variantes)
  base_stock?: number
  base_min_stock?: number
  
  // Variantes del producto
  variants: ProductVariant[]
  
  // Metadatos del producto
  images?: string[]
  tags?: string[]
  active: boolean
  
  created_at: string
  updated_at: string
}

// Para el carrito con variantes
export interface CartItemWithVariant {
  id: string
  product_id: string
  variant_id?: string
  product_name: string
  variant_name?: string
  variant_attributes?: VariantAttributeValue[]
  sku: string
  barcode?: string
  price: number
  wholesale_price?: number
  quantity: number
  stock: number
  image?: string
}

// Configuración de atributos para productos
export interface ProductVariantConfig {
  product_id: string
  attributes: {
    attribute_id: string
    required: boolean
    options: string[] // IDs de opciones permitidas
  }[]
}

// Para búsqueda y filtrado
export interface VariantFilter {
  attribute_id: string
  option_ids: string[]
}

export interface ProductSearchWithVariants {
  query?: string
  category_id?: string
  brand?: string
  price_min?: number
  price_max?: number
  in_stock?: boolean
  variant_filters?: VariantFilter[]
  sort_by?: 'name' | 'price' | 'stock' | 'created_at'
  sort_order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// Respuesta de búsqueda
export interface ProductSearchResult {
  products: ProductWithVariants[]
  total: number
  filters: {
    categories: { id: string; name: string; count: number }[]
    brands: { name: string; count: number }[]
    attributes: {
      attribute: VariantAttribute
      options: { option: VariantOption; count: number }[]
    }[]
    price_range: { min: number; max: number }
  }
}

// Para el inventario
export interface VariantStockMovement {
  id: string
  variant_id: string
  product_id: string
  type: 'in' | 'out' | 'adjustment' | 'sale' | 'return'
  quantity: number
  previous_stock: number
  new_stock: number
  reason?: string
  reference_id?: string // ID de venta, compra, etc.
  user_id?: string
  created_at: string
}

// Para reportes
export interface VariantSalesReport {
  variant_id: string
  product_id: string
  product_name: string
  variant_name: string
  sku: string
  total_sold: number
  total_revenue: number
  avg_price: number
  period: {
    start: string
    end: string
  }
}
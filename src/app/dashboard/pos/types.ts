import type { Product as UnifiedProduct } from '@/types/product-unified'

// Use the unified Product type for consistency
export type Product = UnifiedProduct

export interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  loyaltyPoints?: number
}

export interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  stock: number
  subtotal: number
  discount?: number
  image?: string
  // Precio mayorista del inventario (si está disponible)
  wholesalePrice?: number
  // Resguardo del precio original al agregar
  originalPrice?: number
  // Categoría del producto (para promociones basadas en categoría)
  category?: string
}

export interface PaymentSplit {
  id: string
  method: 'cash' | 'card' | 'transfer' | 'credit'
  amount: number
  reference?: string
  cardLast4?: string
}

export interface PaymentMethodOption {
  id: string
  label: string
  icon: any
  requiresReference?: boolean
  requiresCash?: boolean
  color?: string
}

export interface CashMovement {
  id: string
  type: 'opening' | 'sale' | 'in' | 'out' | 'closing'
  amount: number
  note?: string
  timestamp: string
}

export interface CashRegisterState {
  isOpen: boolean
  balance: number
  movements: CashMovement[]
}

import type { Product as UnifiedProduct } from '@/types/product-unified'
import type { InstallmentPlanOption } from '@/types/product-unified'
import type { ComponentType } from 'react'

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
  // Identificador para servicios/reparaciones
  isService?: boolean
  promoCode?: string
  // Condiciones comerciales del producto usadas por el selector de cuotas del checkout.
  installmentsEnabled?: boolean
  installmentsPlans?: InstallmentPlanOption[]
}

export interface PaymentSplit {
  id: string
  method: 'cash' | 'card' | 'transfer' | 'credit'
  amount: number
  reference?: string
  cardLast4?: string
  provider?: string
  institution?: string
  channel?: 'card_terminal' | 'bank_transfer' | 'qr'
  terminalId?: string
}

export interface PaymentMethodOption {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  requiresReference?: boolean
  requiresCash?: boolean
  color?: string
}

export interface CashMovement {
  id: string
  type: 'opening' | 'sale' | 'in' | 'cash_in' | 'out' | 'cash_out' | 'closing'
  amount: number
  note?: string
  reason?: string // Alias for note
  timestamp?: string
  created_at?: string // Alias for timestamp
  payment_method?: 'cash' | 'card' | 'transfer' | 'mixed'
}

export interface CashRegisterState {
  isOpen: boolean
  balance: number
  movements: CashMovement[]
}

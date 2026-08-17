import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { CartItem } from '../types'

export interface HeldSale {
  id: string
  label?: string
  title?: string
  createdAt?: string
  timestamp?: number
  formattedDate?: string
  cart: CartItem[]
  items?: CartItem[]
  itemCount: number
  isWholesale: boolean
  discount: number
  selectedCustomer?: string
  customerId?: string | null
  customerName?: string | null
  selectedRepairIds?: string[]
  total: number
  note?: string
}

const STORAGE_KEY = 'pos.heldSales'

export function useHeldSales() {
  const [heldSales, setHeldSales] = useState<HeldSale[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Load held sales on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setHeldSales(parsed)
        }
      }
    } catch (e) {
      console.error('Error loading held sales from localStorage', e)
    } finally {
      setIsInitialized(true)
    }
  }, [])

  // Persist to localStorage whenever heldSales changes
  const persistSales = useCallback((sales: HeldSale[]) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sales.slice(0, 30)))
      setHeldSales(sales)
    } catch (e) {
      console.error('Error saving held sales to localStorage', e)
    }
  }, [])

  // Park / Hold current sale
  const parkSale = useCallback((
    cart: CartItem[],
    isWholesale: boolean,
    discount: number,
    total: number,
    customerName?: string | null,
    selectedCustomer?: string,
    selectedRepairIds: string[] = [],
    note?: string
  ): boolean => {
    if ((!cart || cart.length === 0) && selectedRepairIds.length === 0) {
      toast.error('El carrito está vacío', { description: 'Agrega productos antes de poner una venta en espera.' })
      return false
    }

    const now = new Date()
    const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const custName = customerName || 'Consumidor Final'
    const label = `${custName} - ${timeLabel}`
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0) + selectedRepairIds.length

    const newHeldSale: HeldSale = {
      id: `held-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      label,
      title: label,
      createdAt: now.toISOString(),
      timestamp: Date.now(),
      formattedDate: timeLabel,
      cart: cart.map(i => ({ ...i })),
      items: cart.map(i => ({ ...i })),
      itemCount,
      isWholesale,
      discount,
      selectedCustomer: selectedCustomer || '',
      customerId: selectedCustomer || null,
      customerName: custName,
      selectedRepairIds: [...selectedRepairIds],
      total,
      note
    }

    const updated = [newHeldSale, ...heldSales.filter(s => s.id !== newHeldSale.id)]
    persistSales(updated)
    toast.success('Venta puesta en espera', {
      description: `Guardada con ${itemCount} ítem${itemCount !== 1 ? 's' : ''}. Puedes recuperarla en cualquier momento.`
    })
    return true
  }, [heldSales, persistSales])

  // Delete a held sale
  const deleteSale = useCallback((id: string) => {
    const updated = heldSales.filter(s => s.id !== id)
    persistSales(updated)
    toast.info('Venta en espera eliminada')
  }, [heldSales, persistSales])

  // Clear all held sales
  const clearAllSales = useCallback(() => {
    persistSales([])
    toast.info('Todas las ventas en espera han sido borradas')
  }, [persistSales])

  return {
    heldSales,
    setHeldSales,
    heldSalesCount: heldSales.length,
    parkSale,
    deleteSale,
    clearAllSales,
    isInitialized
  }
}

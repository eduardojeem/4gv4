'use client'

import React, { useState, useMemo, useCallback, useEffect, memo, useRef } from 'react'
import Link from 'next/link'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, FileText,
  Users, Package, Star, Filter, Grid, List,
  Keyboard, Maximize, Minimize, BarChart3,
  Clock, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Save,
  Printer, Download, Share2, Settings, AlertTriangle,
  Loader2, CheckCircle2, XCircle, Tag, Sparkles, Award, ArrowRight, Wrench,
  ArrowUpCircle, ArrowDownCircle
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { useCashRegisterContext } from './contexts/CashRegisterContext'
import { Button } from '@/components/ui/button'
import { ThemeToggleSimple } from '@/components/ui/theme-toggle'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { toast } from 'sonner'
import { ReceiptGenerator } from '@/components/pos/ReceiptGenerator'
import { createReceiptData, printReceipt, downloadReceipt, shareReceipt } from '@/lib/receipt-utils'
import { InventoryAlerts } from '@/components/pos/InventoryAlerts'
import { AccessibilitySettings } from '@/components/pos/AccessibilitySettings'
import { VirtualizedProductGrid } from './components/VirtualizedProductList'
import { formatStockStatus } from '@/lib/inventory-manager'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { config, isDemoNoDb, getTaxConfig } from '@/lib/config'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { SupabaseStatus } from '@/components/supabase-status'
import { formatCurrency } from '@/lib/currency'
import { 
  calculateRepairTotal, 
  createRepairCartItem, 
  calculateMixedCartTotal,
  CartRepairItem 
} from '@/lib/pos-calculator'
import { usePOSProducts } from '@/hooks/usePOSProducts'
import { POSBarcodeScanner } from '@/components/barcode/BarcodeScanner'
import { VariantSelector } from '@/components/pos/VariantSelector'
import { useProductVariants } from '@/hooks/useProductVariants'
import { useSmartSearch } from './hooks/useSmartSearch'
import { usePromotionEngine } from '@/hooks/use-promotion-engine'
import { ProductWithVariants, ProductVariant } from '@/types/product-variants'
import { usePerformanceMonitor, useRenderTimeMonitor } from './hooks/usePerformanceMonitor'
import { recordMetric } from './utils/performance-monitor'
import { useErrorHandler } from './hooks/useErrorHandler'
import { ErrorMonitor } from './components/ErrorMonitor'
import { PerformanceDashboard } from './components/PerformanceDashboard'
import { ProductCard } from './components/ProductCard'
import { CheckoutModal } from './components/CheckoutModal'
import { useCheckout } from './contexts/CheckoutContext'
import { usePOSCustomer } from './contexts/POSCustomerContext'
import { CartItem, PaymentSplit, PaymentMethodOption } from './types'
import type { Product } from '@/types/product-unified'

const getErrorMessage = (e: unknown) => {
  if (!e) return 'Unknown error'
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) return String((e as any).message)
  try { return JSON.stringify(e) } catch { return String(e) }
}

// Utilidades de código de barras (EAN-8/13)
const normalizeBarcode = (raw: string) => raw.replace(/\D+/g, '').trim()
const eanChecksum = (digits: string) => {
  const len = digits.length
  const weights = len === 8 ? [3, 1, 3, 1, 3, 1, 3] : [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]
  const sum = digits
    .slice(0, len - 1)
    .split('')
    .reduce((acc, d, i) => acc + Number(d) * weights[i], 0)
  const check = (10 - (sum % 10)) % 10
  return check
}
const isValidEan = (digits: string) => {
  const n = digits.length
  if (n !== 8 && n !== 13) return false
  const expected = eanChecksum(digits)
  return Number(digits[n - 1]) === expected
}

// Eliminado: datos de productos mock no utilizados




export default function POSPage() {
  // Monitoreo de performance y errores
  const {
    measureCartOperation,
    measureProductSearch,
    measureSaleProcessing,
    performanceScore
  } = usePerformanceMonitor()

  const { withErrorHandling } = useErrorHandler()

  // Monitoreo de tiempo de renderizado
  useRenderTimeMonitor('POSPage')

  // Estados principales
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])

  // Use centralized customer state
  const { 
    selectedCustomer, 
    setSelectedCustomer, 
    customers, 
    setCustomers,
    setCustomersSourceSupabase,
    setNewCustomerOpen
  } = usePOSCustomer()

  // Use centralized checkout state
  const {
    isCheckoutOpen,
    setIsCheckoutOpen,
    paymentStatus,
    setPaymentStatus,
    paymentError,
    setPaymentError,
    paymentMethod,
    setPaymentMethod,
    isMixedPayment,
    setIsMixedPayment,
    cashReceived,
    setCashReceived,
    cardNumber,
    setCardNumber,
    transferReference,
    setTransferReference,
    splitAmount,
    setSplitAmount,
    notes,
    setNotes,
    discount,
    setDiscount,
    paymentSplit,
    setPaymentSplit,
    addPaymentSplit,
    removePaymentSplit,
    resetCheckoutState
  } = useCheckout()
  


  const [customerRepairs, setCustomerRepairs] = useState<any[]>([])
  const [selectedRepairIds, setSelectedRepairIds] = useState<string[]>([])
  
  const [paymentAttempts, setPaymentAttempts] = useState<Array<{ time: string; status: 'processing' | 'success' | 'failed'; method: 'single' | 'mixed'; amount: number; message?: string }>>([])
  const addPaymentAttempt = useCallback((attempt: { status: 'processing' | 'success' | 'failed'; method: 'single' | 'mixed'; amount: number; message?: string }) => {
    setPaymentAttempts(prev => [{ ...attempt, time: new Date().toISOString() }, ...prev].slice(0, 50))
  }, [])
  const normalizePaymentError = useCallback((err: any): string => {
    try {
      if (!err) return 'Error desconocido'
      const msg = typeof err === 'string' ? err : (err.message || err.error_description || err.details || err.hint || 'Error desconocido')
      const lower = (msg || '').toLowerCase()
      if (lower.includes('network') || lower.includes('fetch')) return 'Error de red: verifique la conexión.'
      if (lower.includes('permission') || lower.includes('auth') || lower.includes('jwt')) return 'Permisos insuficientes o sesión inválida.'
      if (lower.includes('duplicate key') || lower.includes('unique constraint')) return 'Registro duplicado.'
      if (lower.includes('timeout')) return 'Tiempo de espera agotado.'
      if (lower.includes('not null')) return 'Faltan datos requeridos.'
      return msg
    } catch {
      return 'Error desconocido'
    }
  }, [])
  // Reiniciar estado de pago al abrir/cerrar el modal
  useEffect(() => {
    if (isCheckoutOpen) {
      setPaymentStatus('idle')
      setPaymentError('')
    }
  }, [isCheckoutOpen])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  // Opciones de vinculación de reparación
  const [markRepairDelivered, setMarkRepairDelivered] = useState(false)
  const [finalCostFromSale, setFinalCostFromSale] = useState(false)
  const selectedRepairs = useMemo(() => customerRepairs.filter((r: any) => selectedRepairIds.includes(r.id)), [customerRepairs, selectedRepairIds])
  const supabaseStatusToLabel: Record<string, string> = {
    recibido: 'Recibido',
    diagnostico: 'En diagnóstico',
    reparacion: 'En reparación',
    listo: 'Listo para entrega',
    entregado: 'Entregado',
  }
  useEffect(() => {
    // Resetear toggles al cerrar checkout o al cambiar de reparación
    if (!isCheckoutOpen) {
      setMarkRepairDelivered(false)
      setFinalCostFromSale(false)
    }
  }, [isCheckoutOpen, selectedRepairIds])
  const [showFeatured, setShowFeatured] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [showAccessibilitySettings, setShowAccessibilitySettings] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Venta mayorista
  const [isWholesale, setIsWholesale] = useState(false)
  const WHOLESALE_DISCOUNT_RATE = 10

  // Estados para variantes y promociones
  const [variantSelectorOpen, setVariantSelectorOpen] = useState(false)
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<ProductWithVariants | null>(null)

  // Hooks para variantes y promociones
  const { getProductWithVariants, convertVariantToCartItem } = useProductVariants()
  const { calculateCartSummary } = usePromotionEngine()



  // Contexto de caja
  const { 
    registers, 
    setRegisters,
    activeRegisterId, 
    setActiveRegisterId, 
    getCurrentRegister,
    updateActiveRegister,
    registerState,
    setRegisterState,
    addMovement,
    openRegister
  } = useCashRegisterContext()

  // Gestor de cajas: crear, renombrar, eliminar
  const [isOpenRegisterDialogOpen, setIsOpenRegisterDialogOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('0')
  const [openingNote, setOpeningNote] = useState('')
  const [isRegisterManagerOpen, setIsRegisterManagerOpen] = useState(false)
  const [newRegisterName, setNewRegisterName] = useState('')
  const [renameRegisterId, setRenameRegisterId] = useState<string | null>(null)
  const [renameRegisterName, setRenameRegisterName] = useState('')

  // Movement Dialog State
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false)
  const [movementType, setMovementType] = useState<'in' | 'out'>('out')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementNote, setMovementNote] = useState('')

  // Estados para múltiples métodos de pago
  // Eliminados estados locales que ahora están en CheckoutContext

  // Estados para sistema de tickets
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [currentReceipt, setCurrentReceipt] = useState<any>(null)
  const [lastSaleData, setLastSaleData] = useState<any>(null)

  // Estados para sistema de inventario usando el hook de Supabase
  const {
    products: inventoryProducts,
    loading: productsLoading,
    error: productsError,
    processSale: processInventorySale,
    findProductByBarcode
  } = usePOSProducts()

  // Función para verificar disponibilidad de stock
  const checkAvailability = useCallback((productId: string, quantity: number) => {
    const product = inventoryProducts.find(p => p.id === productId)
    return product ? product.stock_quantity >= quantity : false
  }, [inventoryProducts])

  // Smart search integration (after inventoryProducts is available)
  const { 
    query: smartSearchQuery, 
    setQuery: setSmartSearchQuery,
    searchResults: smartSearchResults,
    suggestions: smartSearchSuggestions,
    isSearching: isSmartSearching,
    addToRecentSearches
  } = useSmartSearch({
    products: inventoryProducts || [],
    maxResults: 20,
    enableFuzzySearch: true,
    enableSemanticSearch: true
  })

  // Mantener compatibilidad con el inventoryManager existente
  const inventoryManager = useMemo(() => ({
    getProducts: () => inventoryProducts,
    processSale: (items: Array<{ productId: string; quantity: number }>) => {
      // Convertir items array a SaleData format
      const cartItems = items.map(item => {
        const product = inventoryProducts.find(p => p.id === item.productId)
        return {
          id: item.productId,
          name: product?.name || '',
          sku: product?.sku || '',
          price: product?.sale_price || 0,
          quantity: item.quantity,
          stock: product?.stock_quantity || 0,
          subtotal: (product?.sale_price || 0) * item.quantity
        }
      })

      const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0)

      const saleData = {
        items: cartItems,
        total,
        payment_method: 'cash' as const
      }

      return processInventorySale(saleData)
    },
    subscribe: (callback: (products: any[]) => void) => {
      // Para compatibilidad, retornamos una función de desuscripción vacía
      // ya que los productos se actualizan automáticamente con el hook
      return () => { }
    },
    importData: (data: { products: any[] }) => {
      // En modo demo, no necesitamos importar datos ya que usamos Supabase
      console.log('Modo Supabase: importData no necesario')
    }
  }), [inventoryProducts, processInventorySale])

  // Sincronizar clientes: cargar y suscribirse en tiempo real
  useEffect(() => {
    if (!config.supabase.isConfigured) {
      setCustomers([])
      return
    }

    const supabase = createSupabaseClient()

    const mapRowToCustomer = (row: any) => ({
      id: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim(),
      email: row.email || '',
      phone: row.phone || '',
      type: row.customer_type || 'regular',
      updated_at: row.updated_at,
    })

    const loadInitial = async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('customers')
        .select('id,first_name,last_name,phone,email,customer_type,updated_at')

      if (error) {
        console.warn('Error cargando clientes:', error.message)
        setCustomers([])
        toast.warning('No se pudo cargar clientes desde Supabase')
        setCustomersSourceSupabase(false)
        return false
      }

      const mapped = (data || []).map(mapRowToCustomer)
      setCustomers(mapped)
      setCustomersSourceSupabase(true)
      return true
    }

    let channel: RealtimeChannel | null = null
      ; (async () => {
        const ok = await loadInitial()
        if (ok) {
          const channelInstance = supabase
            .channel('customers-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload: any) => {
              const row = (payload.new || payload.old) as any
              if (!row) return

              if (payload.eventType === 'DELETE') {
                setCustomers(prev => prev.filter(c => c.id !== row.id))
                return
              }

              const mapped = mapRowToCustomer(row)
              setCustomers(prev => {
                const idx = prev.findIndex(c => c.id === row.id)
                if (idx === -1) return [mapped, ...prev]
                const copy = [...prev]
                copy[idx] = mapped
                return copy
              })
            })

          channel = channelInstance
          channelInstance.subscribe()
        }
      })()

    return () => {
      if (channel) channel.unsubscribe()
    }
  }, [])

  // Cargar reparaciones del cliente seleccionado y suscribirse a cambios
  useEffect(() => {
    // Cargar reparaciones del cliente desde Supabase
    if (!selectedCustomer) {
      setCustomerRepairs([])
      setSelectedRepairIds([])
      return
    }

    const supabase = createSupabaseClient()

    let canSubscribe = true
    const loadRepairs = async () => {
      const { data, error }: any = await supabase
        .from('repairs')
        .select('id, device_brand, device_model, status, created_at, final_cost, estimated_cost, notes:problem_description, customer_id')
        .eq('customer_id', selectedCustomer)
        .order('created_at', { ascending: false })
      if (error) {
        const msg = error.message || ''
        const missingTable = msg.includes("Could not find the table 'public.repairs'") || msg.includes('relation "repairs" does not exist')
        if (missingTable) {
          console.warn('Tabla repairs no encontrada en Supabase; usando lista vacía para el cliente.')
          canSubscribe = false
          setCustomerRepairs([])
        } else {
          console.error('Error cargando reparaciones del cliente:', msg)
        }
        return
      }
      setCustomerRepairs(data || [])
    }

    loadRepairs()
    let channel: RealtimeChannel | null = null
    if (canSubscribe) {
      channel = supabase
        .channel('repairs-sync-pos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, (payload: any) => {
          const row = (payload.new || payload.old)
          if (!row || row.customer_id !== selectedCustomer) return

          if (payload.eventType === 'DELETE') {
            setCustomerRepairs(prev => prev.filter(r => r.id !== row.id))
            if (selectedRepairIds.includes(row.id)) setSelectedRepairIds(prev => prev.filter(id => id !== row.id))
            return
          }

          setCustomerRepairs(prev => {
            const idx = prev.findIndex(r => r.id === row.id)
            const mapped = { ...row, notes: row.problem_description }
            if (idx === -1) return [mapped, ...prev]
            const copy = [...prev]
            copy[idx] = mapped
            return copy
          })
        })
        .subscribe()
    }

    return () => {
      if (channel) channel.unsubscribe()
    }
  }, [selectedCustomer])

  // Persistir venta y actualizar stock en Supabase
  const persistSaleToSupabase = useCallback(
    async (
      items: CartItem[],
      method: string,
      discountValue: number,
      taxValue: number,
      totalValue: number,
      existingSaleId?: string
    ) => {
      try {
        // Persistir en Supabase
        const supabase = createSupabaseClient()
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth?.user?.id || 'pos-user'

        const methodMap: Record<string, 'efectivo' | 'tarjeta' | 'transferencia'> = {
          cash: 'efectivo',
          card: 'tarjeta',
          transfer: 'transferencia',
          credit: 'tarjeta',
          // Pago mixto: usar efectivo como fallback en esquema actual
          mixed: 'efectivo',
        }
        const paymentMethodDb = methodMap[method] || 'efectivo'

        let saleId: string | undefined = existingSaleId

        if (!saleId) {
          const { data: saleRow, error: saleError } = await supabase
            .from('sales')
            .insert({
              customer_id: selectedCustomer || null,
              user_id: userId,
              total_amount: totalValue,
              tax_amount: taxValue || 0,
              discount_amount: discountValue || 0,
              payment_method: paymentMethodDb,
              status: 'completada',
            })
            .select()
            .single()

          if (saleError) throw new Error(saleError.message)
          saleId = saleRow?.id
        }

        if (saleId) {
          if (!existingSaleId) {
            const saleItems = items.map((i) => {
              const unitApplied = isWholesale
                ? (typeof i.wholesalePrice === 'number' ? i.wholesalePrice : (i.price * (1 - (WHOLESALE_DISCOUNT_RATE / 100))))
                : i.price
              const lineTotal = unitApplied * i.quantity
              return {
                sale_id: saleId!,
                product_id: i.id,
                quantity: i.quantity,
                unit_price: unitApplied,
                subtotal: lineTotal,
              }
            })
            
            if (saleItems.length > 0) {
              const { error: itemsError } = await supabase
                .from('sale_items')
                .insert(saleItems)
              if (itemsError) throw new Error(itemsError.message)
            }
          }

          if (method === 'credit' && selectedCustomer) {
            try {
              const termMonths = 12
              const interestRate = 0
              const { data: creditRow, error: creditError } = await supabase
                .from('customer_credits')
                .insert({
                  customer_id: selectedCustomer,
                  sale_id: saleId,
                  principal: totalValue,
                  interest_rate: interestRate,
                  term_months: termMonths,
                  start_date: new Date().toISOString(),
                  status: 'active'
                })
                .select()
                .single()
              if (creditError) throw new Error(creditError.message)
              const creditId = creditRow?.id as string
              if (creditId) {
                const installmentAmount = Math.round((totalValue / termMonths) * 100) / 100
                const base = Date.now()
                const installments = Array.from({ length: termMonths }).map((_, idx) => ({
                  credit_id: creditId,
                  installment_number: idx + 1,
                  due_date: new Date(base + (idx + 1) * 30 * 24 * 60 * 60 * 1000).toISOString(),
                  amount: installmentAmount,
                  status: 'pending'
                }))
                const { error: instError } = await supabase
                  .from('credit_installments')
                  .insert(installments)
                if (instError) throw new Error(instError.message)
              }
            } catch (e: any) {
              const msg = String(e?.message || e || '')
              const missingCreditsTables = msg.includes('relation \"customer_credits\" does not exist')
                || msg.includes('relation \"credit_installments\" does not exist')
              if (missingCreditsTables) {
                console.warn('Supabase: tablas de créditos no encontradas. Omitiendo creación de crédito.')
              } else {
                console.error('Error creando crédito desde POS:', msg)
              }
            }
          }

          // El stock ya es actualizado por el hook de inventario cuando existingSaleId está presente
          if (!existingSaleId) {
            for (const i of items) {
              const newStock = Math.max(0, (i.stock ?? 0) - i.quantity)
              const { error: updError } = await supabase
                .from('products')
                .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
                .eq('id', i.id)
                .select()
                .maybeSingle()
              if (updError) throw new Error(updError.message)
            }
          }

          // Vincular venta a reparaciones
          if (selectedRepairIds && selectedRepairIds.length > 0) {
            try {
              const { data: repairRows, error: repairGetError } = await supabase
                .from('repairs')
                .select('id, problem_description, status, final_cost')
                .in('id', selectedRepairIds)
              
              if (repairGetError) throw new Error(repairGetError.message)

              const saleSummary = items.map(i => `${i.name} x${i.quantity}`).join(', ')
              const linkLine = `\n\nVenta relacionada #${saleId} (${paymentMethodDb}) por ${totalValue}. Items: ${saleSummary}.`

              for (const r of (repairRows || [])) {
                const newNotes = `${(r.problem_description || '').trim()}${linkLine}`
                const updatePayload: any = { problem_description: newNotes, updated_at: new Date().toISOString() }
                
                if (markRepairDelivered) {
                  updatePayload.status = 'entregado'
                  updatePayload.delivered_at = new Date().toISOString()
                }
                
                if (finalCostFromSale) {
                  // Si hay múltiples reparaciones, dividimos el costo total equitativamente
                  // Si es solo una, asignamos el total
                  updatePayload.final_cost = selectedRepairIds.length > 1 
                    ? (totalValue / selectedRepairIds.length) 
                    : totalValue
                }

                const { error: repairUpdError } = await (supabase
                  .from('repairs')
                  .update(updatePayload)
                  .eq('id', r.id)
                  .select()
                  .maybeSingle())
                if (repairUpdError) throw new Error(repairUpdError.message)
              }
            } catch (e: any) {
              console.error('No se pudo vincular venta a reparaciones:', e?.message || e)
            }
          }
        }
      } catch (err: any) {
        const msg = String(err?.message || err || '')
        const missingSalesTable = msg.includes("Could not find the table 'public.sales'")
          || msg.includes('relation "sales" does not exist')
          || (msg.toLowerCase().includes('sales') && msg.toLowerCase().includes('schema cache'))

        if (missingSalesTable) {
          console.warn('Supabase: tabla sales no encontrada. Omitiendo persistencia y continuando.')
          try { (toast as any)?.warning?.('Supabase sin tabla sales: venta no persistida') } catch (e) {
            console.warn('Toast warning failed:', e)
          }
          // No lanzar para no romper el flujo de venta en modo sin esquema completo
          return
        }

        console.error('Error persistiendo venta:', msg)
        throw err
      }
    },
    [selectedCustomer, selectedRepairIds]
  )

  // Estados para búsqueda avanzada
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'category'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [priceRange, setPriceRange] = useState<{ min: number, max: number }>({ min: 0, max: 1000000 })
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(24) // 24 items por página por defecto

  // Resetear página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, selectedCategory, stockFilter, priceRange, showFeatured, sortOrder, sortBy])


  // Persistencia en localStorage: restaurar al cargar
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedCart = localStorage.getItem('pos.cart')
      const savedPrefs = localStorage.getItem('pos.prefs')
      if (savedCart) {
        const parsed = JSON.parse(savedCart)
        if (Array.isArray(parsed)) setCart(parsed)
      }
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs)
        if (prefs.selectedCategory) setSelectedCategory(prefs.selectedCategory)
        if (typeof prefs.showFeatured === 'boolean') setShowFeatured(prefs.showFeatured)
        if (prefs.viewMode) setViewMode(prefs.viewMode)
        if (prefs.sortBy) setSortBy(prefs.sortBy)
        if (prefs.sortOrder) setSortOrder(prefs.sortOrder)
        if (prefs.priceRange) setPriceRange(prefs.priceRange)
        if (prefs.stockFilter) setStockFilter(prefs.stockFilter)
        if (prefs.recentSearches) setRecentSearches(prefs.recentSearches)
        if (typeof prefs.sidebarCollapsed === 'boolean') setSidebarCollapsed(prefs.sidebarCollapsed)
        if (prefs.itemsPerPage) setItemsPerPage(prefs.itemsPerPage)
      }
    } catch (e) {
      console.warn('No se pudo restaurar localStorage POS', e)
    }
     
  }, [])

  // Guardar cambios significativos en localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('pos.cart', JSON.stringify(cart))
    } catch (e) {
      console.error('Error saving cart to localStorage:', e)
    }
  }, [cart])

  // Estados para autocompletado (using smart search suggestions)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Use smart search suggestions instead of local ones
  const searchSuggestions = smartSearchSuggestions.map(s => s.text)

  // Guardar cambios de preferencias (después de declarar recentSearches)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const prefs = {
        selectedCategory,
        showFeatured,
        viewMode,
        sortBy,
        sortOrder,
        priceRange,
        stockFilter,
        recentSearches,
        sidebarCollapsed,
        itemsPerPage,
      }
      localStorage.setItem('pos.prefs', JSON.stringify(prefs))
    } catch (e) {
      console.error('Error saving preferences to localStorage:', e)
    }
  }, [selectedCategory, showFeatured, viewMode, sortBy, sortOrder, priceRange, stockFilter, recentSearches, sidebarCollapsed, itemsPerPage])

  // Medidas del viewport para virtualización dinámica
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const [viewportHeight, setViewportHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 768)

  useEffect(() => {
    const updateViewport = () => {
      setViewportWidth(window.innerWidth)
      setViewportHeight(window.innerHeight)
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  const virtualizationThreshold = 100

  // Efecto de debouncing para búsqueda optimizada
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // 300ms de delay para evitar búsquedas excesivas

    return () => clearTimeout(timer)
  }, [searchTerm])



  // Helper para invocar handlers por ID de forma robusta
  const triggerHandlerById = useCallback((id: string) => {
    const el = document.getElementById(id) as HTMLElement | null
    if (!el) return
    // Intentar ejecutar handler directo si existiera como propiedad (poco común en React)
    const anyEl = el as any
    const handler = anyEl?.onclick
    if (typeof handler === 'function') {
      handler({})
      return
    }
    // Fallback confiable: disparar evento click nativo (compatibile con React Synthetic Events)
    el.click()
  }, [])

  // Categorías únicas (usar nombre de categoría)
  const categories = useMemo(() => {
    const names = inventoryProducts
      .map(p => (typeof p.category === 'object' ? p.category?.name : p.category))
      .filter((name): name is string => !!name && typeof name === 'string')
    return ['all', ...Array.from(new Set(names))]
  }, [inventoryProducts])

  // Rango de precios dinámico
  const priceRangeLimits = useMemo(() => {
    const prices = inventoryProducts.map(p => p.sale_price)
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    }
  }, [inventoryProducts])

  // Generar sugerencias de búsqueda (now using smart search)
  const generateSearchSuggestions = useCallback((term: string) => {
    // Smart search handles suggestions automatically
    // Just update the show state
    setShowSuggestions(term.length > 0)
  }, [])

  // Manejar cambios en búsqueda
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
    setSmartSearchQuery(value) // Update smart search query
    generateSearchSuggestions(value)
    setShowSuggestions(value.length > 0)
    setSelectedSuggestionIndex(-1)
  }, [generateSearchSuggestions, setSmartSearchQuery])

  // Seleccionar sugerencia
  const selectSuggestion = useCallback((suggestion: string) => {
    setSearchTerm(suggestion)
    setSmartSearchQuery(suggestion) // Update smart search query
    addToRecentSearches(suggestion) // Add to smart search recent searches
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)

    if (!recentSearches.includes(suggestion)) {
      setRecentSearches(prev => [suggestion, ...prev.slice(0, 4)])
    }
  }, [recentSearches])

  // Navegación por teclado en sugerencias
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || searchSuggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex(prev =>
          prev < searchSuggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex(prev =>
          prev > 0 ? prev - 1 : searchSuggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0) {
          selectSuggestion(searchSuggestions[selectedSuggestionIndex])
        } else if (searchTerm.trim()) {
          setShowSuggestions(false)
          if (!recentSearches.includes(searchTerm)) {
            setRecentSearches(prev => [searchTerm, ...prev.slice(0, 4)])
          }
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
        break
    }
  }, [showSuggestions, searchSuggestions, selectedSuggestionIndex, selectSuggestion, searchTerm, recentSearches])

  // Productos filtrados (optimizado con debouncing)
  const filteredList = useMemo(() => {
    const startTime = performance.now()
    const result = inventoryProducts.filter(product => {
      const searchLower = debouncedSearchTerm.toLowerCase()
      const categoryName = (typeof product.category === 'object' ? product.category?.name : product.category) || ''
      const matchesSearch = !debouncedSearchTerm ||
        product.name.toLowerCase().includes(searchLower) ||
        categoryName.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        (product.barcode && product.barcode.includes(debouncedSearchTerm))

      const matchesCategory = selectedCategory === 'all' || categoryName === selectedCategory
      const matchesFeatured = !showFeatured || (product as any).featured
      const matchesPrice = product.sale_price >= priceRange.min && product.sale_price <= priceRange.max

      let matchesStock = true
      switch (stockFilter) {
        case 'in_stock':
          matchesStock = product.stock_quantity > 5
          break
        case 'low_stock':
          matchesStock = product.stock_quantity <= 5 && product.stock_quantity > 0
          break
        case 'out_of_stock':
          matchesStock = product.stock_quantity === 0
          break
      }

      return matchesSearch && matchesCategory && matchesFeatured && matchesPrice && matchesStock
    })

    // Registrar métrica de búsqueda
    const endTime = performance.now()
    const searchTime = endTime - startTime
    if (searchTime > 0) {
      recordMetric('product-search', searchTime)
    }

    return result
  }, [inventoryProducts, debouncedSearchTerm, selectedCategory, showFeatured, priceRange, stockFilter])

  // Ordenar productos por separado para evitar recalcular filtrado
  const filteredProducts = useMemo(() => {
    const filtered = [...filteredList]
    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'price':
          comparison = a.sale_price - b.sale_price
          break
        case 'stock':
          comparison = a.stock_quantity - b.stock_quantity
          break
        case 'category':
          {
            const aName = (typeof a.category === 'object' ? a.category?.name : a.category) || ''
            const bName = (typeof b.category === 'object' ? b.category?.name : b.category) || ''
            comparison = aName.localeCompare(bName)
          }
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
    return filtered
  }, [filteredList, sortBy, sortOrder])

  // Productos paginados
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredProducts, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  // Funciones del carrito
  const addToCart = useCallback((product: Product) => {
    return measureCartOperation(() => {
      // Verificar si el producto tiene variantes
      const productWithVariants = getProductWithVariants(product.id)

      if (productWithVariants && productWithVariants.variants && productWithVariants.variants.length > 0) {
        // Abrir selector de variantes
        setSelectedProductForVariants(productWithVariants)
        setVariantSelectorOpen(true)
        return
      }

      // Verificar disponibilidad con el hook de Supabase
      const currentProduct = inventoryProducts.find(p => p.id === product.id)
      if (!currentProduct) {
        toast.error('Producto no encontrado')
        return
      }

      const existingItem = cart.find(item => item.id === product.id)
      const requestedQuantity = existingItem ? existingItem.quantity + 1 : 1

      if (!checkAvailability(product.id, requestedQuantity)) {
        toast.error(`Stock insuficiente. Disponible: ${currentProduct.stock_quantity}`)
        return
      }

      setCart(prev => {
        const existingItem = prev.find(item => item.id === product.id)
        if (existingItem) {
          return prev.map(item =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1, subtotal: item.price * (item.quantity + 1) }
              : item
          )
        } else {
          // Intentar tomar precio mayorista desde el producto si existe
          const inferredWholesale = product.wholesale_price
          return [...prev, {
            id: product.id,
            name: product.name,
            sku: product.sku,
            price: product.sale_price,
            quantity: 1,
            stock: currentProduct.stock_quantity,
            subtotal: product.sale_price * 1,
            image: product.image,
            wholesalePrice: inferredWholesale,
            originalPrice: product.sale_price,
          }]
        }
      })
      toast.success(
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">{product.name}</span>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Agregado al carrito</span>
            <span className="text-xs font-bold text-green-600 dark:text-green-400">
              {formatCurrency(product.price)}
            </span>
          </div>
        </div>
      )
    })
  }, [cart, inventoryProducts, checkAvailability, getProductWithVariants, measureCartOperation])

  // Función para agregar variante al carrito
  const addVariantToCart = useCallback((variant: ProductVariant, quantity: number) => {
    const cartItemWithVariant = convertVariantToCartItem(variant, quantity)

    if (!cartItemWithVariant) {
      toast.error('Error al procesar la variante')
      return
    }

    // Convertir CartItemWithVariant a CartItem
    const cartItem: CartItem = {
      id: cartItemWithVariant.id,
      name: cartItemWithVariant.product_name,
      sku: cartItemWithVariant.sku,
      price: cartItemWithVariant.price,
      quantity: cartItemWithVariant.quantity,
      stock: cartItemWithVariant.stock,
      subtotal: cartItemWithVariant.price * cartItemWithVariant.quantity
    }

    // Verificar stock de la variante
    if (variant.stock < quantity) {
      toast.error(`Stock insuficiente. Disponible: ${variant.stock}`)
      return
    }

    setCart(prev => {
      const existingItem = prev.find(item =>
        item.id === cartItem.id || (item.sku === variant.sku)
      )

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity
        if (variant.stock < newQuantity) {
          toast.error(`Stock insuficiente. Disponible: ${variant.stock}`)
          return prev
        }

        return prev.map(item =>
          (item.id === cartItem.id || item.sku === variant.sku)
            ? { ...item, quantity: newQuantity }
            : item
        )
      } else {
        return [...prev, cartItem]
      }
    })

    toast.success(
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-sm">{cartItem.name}</span>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Variante agregada</span>
          <span className="text-xs font-bold text-green-600 dark:text-green-400">
            {formatCurrency(cartItem.price)}
          </span>
        </div>
      </div>
    )
  }, [convertVariantToCartItem])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id))
      toast.info('Producto eliminado del carrito')
      return
    }

    // Verificar disponibilidad con el hook de Supabase
    if (!checkAvailability(id, quantity)) {
      const currentProduct = inventoryProducts.find(p => p.id === id)
      toast.error(`Stock insuficiente. Disponible: ${currentProduct?.stock_quantity || 0}`)
      return
    }

    setCart(prev => prev.map(item => {
      if (item.id === id) {
        // Aplicar descuentos automáticos por cantidad
        let autoDiscount = 0
        if (quantity >= 50) {
          autoDiscount = 15
        } else if (quantity >= 20) {
          autoDiscount = 10
        } else if (quantity >= 10) {
          autoDiscount = 5
        }

        // Mantener el descuento manual si es mayor al automático
        const finalDiscount = Math.max(autoDiscount, item.discount || 0)

        // Mostrar notificación si se aplicó descuento automático
        if (autoDiscount > (item.discount || 0)) {
          toast.success(`¡Descuento por cantidad aplicado: ${autoDiscount}%!`)
        }

        return {
          ...item,
          quantity,
          subtotal: item.price * quantity,
          discount: finalDiscount
        }
      }
      return item
    }))
  }, [checkAvailability, inventoryProducts])

  // Utilidad común para redondear a 2 decimales
  const roundToTwo = useCallback((num: number) => Math.round((num + Number.EPSILON) * 100) / 100, [])

  // Motor de cálculos optimizado
  const cartCalculations = useMemo(() => {
    // Usar utilidad común de redondeo
    const pricesIncludeTax = config.pricesIncludeTax

    // Cálculo del subtotal con descuentos por item
    // Integrando precio mayorista por ítem cuando está activado "Venta mayorista"
    const itemsCalculation = cart.map(item => {
      const itemDiscountRate = item.discount || 0
      const unitNonWholesale = item.price
      const unitWholesaleCandidate = item.wholesalePrice ?? roundToTwo(item.price * (1 - (WHOLESALE_DISCOUNT_RATE / 100)))
      const unitApplied = isWholesale ? unitWholesaleCandidate : unitNonWholesale

      const discountAmountPerUnit = unitApplied * (itemDiscountRate / 100)
      const unitAfterItemDiscount = unitApplied - discountAmountPerUnit
      const lineTotalApplied = unitAfterItemDiscount * item.quantity

      const unitAfterItemDiscountNonWholesale = unitNonWholesale * (1 - itemDiscountRate / 100)
      const lineTotalNonWholesale = unitAfterItemDiscountNonWholesale * item.quantity

      return {
        id: item.id,
        basePrice: roundToTwo(unitApplied),
        discountAmount: roundToTwo(discountAmountPerUnit),
        discountedPrice: roundToTwo(unitAfterItemDiscount),
        quantity: item.quantity,
        lineTotal: roundToTwo(lineTotalApplied),
        itemDiscount: itemDiscountRate,
        // Auxiliares para cálculo de ahorro mayorista
        lineTotalNonWholesale: roundToTwo(lineTotalNonWholesale),
      }
    })

    // Subtotales: aplicado vs referencia sin mayorista (ambos incluyen descuento por ítem)
    const subtotalApplied = roundToTwo(itemsCalculation.reduce((sum, it) => sum + it.lineTotal, 0))
    const subtotalNonWholesale = roundToTwo(itemsCalculation.reduce((sum, it) => sum + (it.lineTotalNonWholesale ?? it.lineTotal), 0))
    const subtotal = subtotalApplied

    // Descuento general aplicado al subtotal (aplicado)
    const generalDiscountRate = Math.max(0, Math.min(100, discount)) // Validar entre 0-100%
    const generalDiscountAmountApplied = roundToTwo(subtotalApplied * (generalDiscountRate / 100))
    const subtotalAfterDiscountApplied = roundToTwo(subtotalApplied - generalDiscountAmountApplied)

    // Para comparar ahorro mayorista, calcular el subtotal de referencia sin mayorista tras descuento general
    const generalDiscountAmountNonWholesale = roundToTwo(subtotalNonWholesale * (generalDiscountRate / 100))
    const subtotalAfterDiscountNonWholesale = roundToTwo(subtotalNonWholesale - generalDiscountAmountNonWholesale)

    // Ahorro mayorista: diferencia entre referencia sin mayorista y aplicado
    const wholesaleDiscountRate = isWholesale ? WHOLESALE_DISCOUNT_RATE : 0
    const wholesaleDiscountAmount = isWholesale
      ? roundToTwo(Math.max(0, subtotalAfterDiscountNonWholesale - subtotalAfterDiscountApplied))
      : 0
    const subtotalAfterAllDiscounts = subtotalAfterDiscountApplied

    // Costo de reparación vinculada con IVA incluido
    const repairCalculations = selectedRepairs.map(repair => {
      const laborCost = repair.final_cost || repair.estimated_cost || 0
      const partsCost = 0 // Las reparaciones en el POS no tienen partes separadas
      
      return calculateRepairTotal({
        laborCost,
        partsCost,
        taxRate: config.taxRate * 100, // Convertir a porcentaje
        pricesIncludeTax: true // Por defecto IVA incluido
      })
    })
    
    const repairCost = repairCalculations.reduce((sum, calc) => sum + calc.total, 0)
    const repairSubtotal = repairCalculations.reduce((sum, calc) => sum + calc.subtotal, 0)
    const repairTax = repairCalculations.reduce((sum, calc) => sum + calc.taxAmount, 0)

    // Cálculo de impuestos (según configuración)
    const taxRate = config.taxRate
    const productTaxAmount = pricesIncludeTax
      // IVA incluido: extraer componente de impuesto del subtotal bruto
      ? roundToTwo(subtotalAfterAllDiscounts * (taxRate / (1 + taxRate)))
      // IVA no incluido: calcular sobre base neta
      : roundToTwo(subtotalAfterAllDiscounts * taxRate)
    
    // IVA total = IVA de productos + IVA de reparaciones
    const taxAmount = roundToTwo(productTaxAmount + repairTax)

    // Total final
    const total = pricesIncludeTax
      ? roundToTwo(subtotalAfterAllDiscounts + repairCost)
      : roundToTwo(subtotalAfterAllDiscounts + productTaxAmount + repairCost)

    // Cálculo del cambio
    const change = roundToTwo(Math.max(0, cashReceived - total))

    // Monto restante a pagar (solo para pago simple en efectivo)
    const remaining = roundToTwo(Math.max(0, total - cashReceived))

    // Conteo de artículos
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
    const totalItemCount = itemCount + selectedRepairIds.length

    // Estadísticas adicionales
    const totalItemsDiscount = roundToTwo(itemsCalculation.reduce((sum, item) =>
      sum + (item.discountAmount * item.quantity), 0))
    const totalSavings = roundToTwo(totalItemsDiscount + generalDiscountAmountApplied + wholesaleDiscountAmount)
    const averageItemPrice = itemCount > 0 ? roundToTwo(subtotal / itemCount) : 0

    // Validaciones
    const isValidPayment = paymentMethod === 'cash' ? cashReceived >= total : true
    const hasDiscount = totalSavings > 0

    return {
      // Valores básicos
      subtotal,
      repairCost,
      repairSubtotal,
      repairTax,
      generalDiscount: generalDiscountAmountApplied,
      generalDiscountRate,
      wholesaleDiscount: wholesaleDiscountAmount,
      wholesaleDiscountRate,
      tax: taxAmount,
      taxRate,
      total,
      change,
      remaining,
      itemCount,
      totalItemCount,

      // Valores adicionales
      subtotalAfterDiscount: subtotalAfterDiscountApplied,
      subtotalAfterAllDiscounts,
      totalItemsDiscount,
      totalSavings,
      totalDiscount: totalSavings,
      averageItemPrice,
      itemsCalculation,

      // Estados
      isValidPayment,
      hasDiscount,

      // Métodos auxiliares
      formatters: {
        currency: (amount: number) => formatCurrency(amount),
        percentage: (rate: number) => `${rate.toFixed(1)}%`
      }
    }
  }, [cart, discount, cashReceived, paymentMethod, isWholesale, roundToTwo, config.pricesIncludeTax, config.taxRate, selectedRepairs, selectedRepairIds])

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }, [])

  const clearCart = useCallback((force?: boolean) => {
    if (!force && cart.length > 0) {
      const confirmed = window.confirm(
        `¿Estás seguro de que deseas vaciar el carrito?\n\n` +
        `Se eliminarán ${cart.length} producto${cart.length > 1 ? 's' : ''} por un total de ${formatCurrency(cartCalculations.total)}.\n\n` +
        `Esta acción no se puede deshacer.`
      )
      if (!confirmed) return
    }
    setCart([])
    toast.success('🗑️ Carrito vaciado correctamente')
  }, [cart, cartCalculations.total, formatCurrency])

  // Helper functions for payment calculations
  const getTotalPaid = useCallback(() => {
    return paymentSplit.reduce((total, split) => total + split.amount, 0)
  }, [paymentSplit])

  const getRemainingAmount = useCallback(() => {
    return roundToTwo(cartCalculations.total - getTotalPaid())
  }, [cartCalculations.total, getTotalPaid, roundToTwo])

  // Funciones auxiliares para descuentos y promociones
  const applyBulkDiscount = useCallback((productId: string, quantity: number) => {
    // Descuentos por cantidad
    const bulkDiscounts = [
      { minQty: 10, discount: 5 },   // 5% descuento por 10+ items
      { minQty: 20, discount: 10 },  // 10% descuento por 20+ items
      { minQty: 50, discount: 15 }   // 15% descuento por 50+ items
    ]

    const applicableDiscount = bulkDiscounts
      .filter(rule => quantity >= rule.minQty)
      .sort((a, b) => b.discount - a.discount)[0]

    if (applicableDiscount) {
      setCart(prev => prev.map(item =>
        item.id === productId
          ? { ...item, discount: applicableDiscount.discount }
          : item
      ))
      toast.success(`Descuento por cantidad aplicado: ${applicableDiscount.discount}%`)
    }
  }, [])

  const applyPromoCode = useCallback((code: string) => {
    const promoCodes: Record<string, { type: 'percentage' | 'fixed'; value: number; minAmount: number }> = {
      'DESCUENTO10': { type: 'percentage', value: 10, minAmount: 100 },
      'VERANO2024': { type: 'percentage', value: 15, minAmount: 200 },
      'CLIENTE_VIP': { type: 'percentage', value: 20, minAmount: 500 },
      'PRIMERA_COMPRA': { type: 'fixed', value: 50, minAmount: 150 }
    }

    const promo = promoCodes[code.toUpperCase()]
    if (!promo) {
      toast.error('Código promocional inválido')
      return false
    }

    if (cartCalculations.subtotal < promo.minAmount) {
      toast.error(`Monto mínimo requerido: ${formatCurrency(promo.minAmount)}`)
      return false
    }

    if (promo.type === 'percentage') {
      setDiscount(promo.value)
      toast.success(`Código aplicado: ${promo.value}% de descuento`)
    } else {
      // Para descuentos fijos, convertir a porcentaje basado en el subtotal
      const percentageEquivalent = (promo.value / cartCalculations.subtotal) * 100
      setDiscount(Math.min(percentageEquivalent, 100))
      toast.success(`Código aplicado: ${formatCurrency(promo.value)} de descuento`)
    }

    return true
  }, [cartCalculations.subtotal])

  const calculateLoyaltyPoints = useCallback((total: number) => {
    // 1 punto por cada $10 gastados
    const basePoints = Math.floor(total / 10)

    // Bonificación por monto alto
    const bonusMultiplier = total >= 500 ? 2 : total >= 200 ? 1.5 : 1

    return Math.floor(basePoints * bonusMultiplier)
  }, [])

  // Procesar venta
  const processSale = useCallback(async () => {
    return measureSaleProcessing(async () => {
      if (!getCurrentRegister.isOpen) {
        toast.error('La caja está cerrada. No se pueden procesar ventas.')
        return
      }

      if (cart.length === 0 && selectedRepairIds.length === 0) {
        const msg = 'El carrito está vacío y no hay reparaciones seleccionadas'
        toast.error(msg)
        setPaymentStatus('failed')
        setPaymentError(msg)
        addPaymentAttempt({ status: 'failed', method: 'single', amount: (cartCalculations as any).total, message: msg })
        return
      }

      // Evaluar promociones antes de procesar la venta
      try {
        const cartItems = cart.map(item => ({
          id: item.id,
          product_id: item.id,
          variant_id: undefined,
          sku: item.sku || item.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          category_id: item.category,
          total_price: item.price * item.quantity
        }))
        const result = calculateCartSummary(cartItems, [], [])
        if (result.applied_promotions.length > 0) {
          console.log('Promociones aplicadas:', result.applied_promotions)
          console.log('Descuento total calculado:', result.discount_amount)
        }
      } catch (error) {
        console.error('Error evaluando promociones:', error)
      }

      if (!paymentMethod) {
        const msg = 'Seleccione un método de pago'
        toast.error(msg)
        setPaymentStatus('failed')
        setPaymentError(msg)
        addPaymentAttempt({ status: 'failed', method: 'single', amount: (cartCalculations as any).total, message: msg })
        return
      }

      if (paymentMethod === 'cash' && cashReceived < cartCalculations.total) {
        const msg = 'Efectivo insuficiente'
        toast.error(msg)
        setPaymentStatus('failed')
        setPaymentError(msg)
        addPaymentAttempt({ status: 'failed', method: 'single', amount: (cartCalculations as any).total, message: msg })
        return
      }

      // Crear datos del ticket
      const customer = selectedCustomer ? customers.find(c => c.id === selectedCustomer) : undefined
      const payments = [{
        id: '1',
        method: paymentMethod as any,
        amount: cartCalculations.total,
        reference: paymentMethod === 'transfer' ? transferReference : undefined,
        cardLast4: paymentMethod === 'card' && cardNumber ? cardNumber.slice(-4) : undefined
      }]

      const receiptData = createReceiptData(
        cart,
        cartCalculations,
        payments,
        customer,
        'Cajero Principal'
      )

      // Guardar datos de la última venta
      setLastSaleData(receiptData)
      setCurrentReceipt(receiptData)

      // Procesar venta en el inventario usando el hook de Supabase
      setPaymentStatus('processing')
      setPaymentError('')
      addPaymentAttempt({ status: 'processing', method: 'single', amount: (cartCalculations as any).total, message: 'Procesando pago simple' })
      try {
        // Usar el hook de Supabase para procesar la venta solo si hay items
        let saleResult = null
        if (cart.length > 0) {
          saleResult = await processInventorySale({
            items: cart.map(item => ({
              id: item.id,
              name: item.name,
              sku: item.sku,
              price: item.price,
              quantity: item.quantity,
              stock: item.stock,
              subtotal: item.price * item.quantity
            })),
            total: (cartCalculations as any).total,
            payment_method: paymentMethod as 'cash' | 'card' | 'transfer'
          })
        }

        // Persistir en Supabase (venta, items y stock)
        await persistSaleToSupabase(
          cart,
          paymentMethod,
          (cartCalculations as any).discount ?? 0,
          (cartCalculations as any).tax ?? 0,
          (cartCalculations as any).total,
          (saleResult && (saleResult as any).saleId) ? (saleResult as any).saleId : undefined
        )
        setPaymentStatus('success')
        toast.success('Venta procesada exitosamente')
        addPaymentAttempt({ status: 'success', method: 'single', amount: (cartCalculations as any).total, message: 'Pago exitoso' })
      } catch (error) {
        const msg = normalizePaymentError(error)
        setPaymentStatus('failed')
        setPaymentError(msg)
        toast.error('Error al procesar la venta: ' + msg)
        addPaymentAttempt({ status: 'failed', method: 'single', amount: (cartCalculations as any).total, message: msg })
        return
      }
      // Registrar caja: pago simple en efectivo
      if (paymentMethod === 'cash') {
        addMovement('sale', (cartCalculations as any).total, 'Venta POS')
      }

      // Mostrar modal de ticket
      setShowReceiptModal(true)

      // Limpiar formulario
      clearCart(true)
      setSelectedCustomer('')
      setSelectedRepairIds([])
      resetCheckoutState()
      
      // Cerrar luego de una breve confirmación visual
      setTimeout(() => {
        setIsCheckoutOpen(false)
        setPaymentStatus('idle')
      }, 600)
    })
  }, [cart, paymentMethod, cashReceived, cartCalculations, clearCart, persistSaleToSupabase, processInventorySale, calculateCartSummary, selectedCustomer, isWholesale, measureSaleProcessing])



  const processMixedPayment = useCallback(async () => {
    if (!getCurrentRegister.isOpen) {
      toast.error('La caja está cerrada. No se pueden procesar ventas.')
      return
    }
    const totalPaid = getTotalPaid()
    const remaining = getRemainingAmount()
    if (remaining > 0.01) {
      const msg = `Faltan ${formatCurrency(remaining)} para completar el pago`
      toast.error(msg)
      setPaymentStatus('failed')
      setPaymentError(msg)
      addPaymentAttempt({ status: 'failed', method: 'mixed', amount: (cartCalculations as any).total, message: msg })
      return
    }

    // Validar cada split: monto positivo y detalles requeridos
    for (const split of paymentSplit) {
      if (split.amount <= 0) {
        const msg = 'Cada pago debe tener un monto positivo'
        toast.error(msg)
        setPaymentStatus('failed')
        setPaymentError(msg)
        addPaymentAttempt({ status: 'failed', method: 'mixed', amount: (cartCalculations as any).total, message: msg })
        return
      }
      if (split.method === 'card' && (!split.cardLast4 || split.cardLast4.length < 4)) {
        const msg = 'Ingrese los últimos 4 dígitos de la tarjeta'
        toast.error(msg)
        setPaymentStatus('failed')
        setPaymentError(msg)
        addPaymentAttempt({ status: 'failed', method: 'mixed', amount: (cartCalculations as any).total, message: msg })
        return
      }
      if (split.method === 'transfer' && !split.reference) {
        const msg = 'Ingrese la referencia de la transferencia'
        toast.error(msg)
        setPaymentStatus('failed')
        setPaymentError(msg)
        addPaymentAttempt({ status: 'failed', method: 'mixed', amount: (cartCalculations as any).total, message: msg })
        return
      }
    }

    if (remaining > 0.01) {
      const msg = `Faltan ${formatCurrency(remaining)} por pagar`
      toast.error(msg)
      setPaymentStatus('failed')
      setPaymentError(msg)
      addPaymentAttempt({ status: 'failed', method: 'mixed', amount: (cartCalculations as any).total, message: msg })
      return
    }

    if (remaining < -0.01) {
      const msg = `Exceso de pago: ${formatCurrency(Math.abs(remaining))}`
      toast.error(msg)
      setPaymentStatus('failed')
      setPaymentError(msg)
      addPaymentAttempt({ status: 'failed', method: 'mixed', amount: (cartCalculations as any).total, message: msg })
      return
    }

    // Crear datos del ticket para pago mixto
    const customer = selectedCustomer ? customers.find(c => c.id === selectedCustomer) : undefined

    const receiptData = createReceiptData(
      cart,
      cartCalculations,
      paymentSplit,
      customer,
      'Cajero Principal'
    )

    // Guardar datos de la última venta
    setLastSaleData(receiptData)
    setCurrentReceipt(receiptData)

    // Procesar venta en el inventario usando el hook de Supabase
    setPaymentStatus('processing')
    setPaymentError('')
    addPaymentAttempt({ status: 'processing', method: 'mixed', amount: (cartCalculations as any).total, message: 'Procesando pago mixto' })
    try {
      // Usar el hook de Supabase para procesar la venta
      const saleResult = await processInventorySale({
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          price: item.price,
          quantity: item.quantity,
          stock: item.stock,
          subtotal: item.price * item.quantity
        })),
        total: (cartCalculations as any).total,
        payment_method: (paymentSplit && paymentSplit.length > 0 ? paymentSplit[0].method : 'cash') as 'cash' | 'card' | 'transfer'
      })
      // Persistir en Supabase como pago mixto
      await persistSaleToSupabase(
        cart,
        'mixed',
        (cartCalculations as any).discount ?? 0,
        (cartCalculations as any).tax ?? 0,
        (cartCalculations as any).total,
        (saleResult && (saleResult as any).saleId) ? (saleResult as any).saleId : undefined
      )
      setPaymentStatus('success')
      toast.success('Venta procesada con múltiples métodos de pago')
      addPaymentAttempt({ status: 'success', method: 'mixed', amount: (cartCalculations as any).total, message: 'Pago exitoso' })
    } catch (error) {
      const msg = normalizePaymentError(error)
      setPaymentStatus('failed')
      setPaymentError(msg)
      toast.error('Error al procesar la venta: ' + msg)
      addPaymentAttempt({ status: 'failed', method: 'mixed', amount: (cartCalculations as any).total, message: msg })
      return
    }

    // Registrar caja: pago mixto (solo efectivo)
    const cashPaid = paymentSplit
      .filter(split => split.method === 'cash')
      .reduce((sum, split) => sum + split.amount, 0)
    if (cashPaid > 0) {
      addMovement('sale', cashPaid, 'Venta POS (mixta)')
    }

    // Mostrar modal de ticket
    setShowReceiptModal(true)

    // Limpiar todo
    clearCart(true)
    setSelectedCustomer('')
    setPaymentMethod('')
    setPaymentSplit([])
    setIsMixedPayment(false)
    setDiscount(0)
    setNotes('')
    setCashReceived(0)
    // Cerrar luego de una breve confirmación visual
    setTimeout(() => {
      setIsCheckoutOpen(false)
      setPaymentStatus('idle')
    }, 600)
  }, [getTotalPaid, getRemainingAmount, formatCurrency, clearCart, persistSaleToSupabase, cartCalculations, processInventorySale])


  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const searchContainer = document.getElementById('search-container')
      if (searchContainer && !searchContainer.contains(event.target as Node)) {
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Atajos de teclado mejorados
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Evitar atajos cuando se está escribiendo en inputs
      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        (activeElement instanceof HTMLElement && activeElement.contentEditable === 'true')

      // Atajos con Ctrl/Cmd
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault()
            document.getElementById('search-input')?.focus()
            toast.info('🔍 Campo de búsqueda enfocado')
            break
          case 'Enter':
            e.preventDefault()
            if (cart.length > 0 || selectedRepairIds.length > 0) {
              setIsCheckoutOpen(true)
              toast.info('💳 Abriendo checkout')
            } else {
              toast.error('Carrito vacío y sin reparaciones')
            }
            break
          case 'Backspace':
            e.preventDefault()
            if (cart.length > 0) {
              clearCart()
              toast.success('🗑️ Carrito vaciado correctamente')
            }
            break
          case 'n':
            e.preventDefault()
            clearCart()
            setSelectedCustomer('')
            toast.success('🆕 Nueva venta iniciada')
            break
          case 'p':
            e.preventDefault()
            if (cart.length > 0 || selectedRepairIds.length > 0) {
              setIsCheckoutOpen(true)
              toast.info('💳 Procesando pago')
            }
            break
          case 'g':
            e.preventDefault()
            setViewMode(viewMode === 'grid' ? 'list' : 'grid')
            toast.info(`📋 Vista cambiada a ${viewMode === 'grid' ? 'lista' : 'grilla'}`)
            break
          case 'h':
            e.preventDefault()
            setShowKeyboardShortcuts(true)
            break
        }
      }

      // Atajos sin modificadores (solo si no hay input enfocado)
      if (!isInputFocused) {
        switch (e.key) {
          case 'F1':
            e.preventDefault()
            setShowKeyboardShortcuts(true)
            break
          case 'F2':
            e.preventDefault()
            setShowAdvancedFilters(!showAdvancedFilters)
            toast.info(`🔧 Filtros ${showAdvancedFilters ? 'ocultos' : 'mostrados'}`)
            break
          case 'F3':
            e.preventDefault()
            setShowAccessibilitySettings(true)
            toast.info('♿ Configuración de accesibilidad abierta')
            break
          case 'F5':
            e.preventDefault()
            setShowFeatured(!showFeatured)
            toast.info(`⭐ ${showFeatured ? 'Todos los productos' : 'Solo destacados'}`)
            break
          case 'F4':
            e.preventDefault()
            setIsFullscreen(!isFullscreen)
            toast.info(`📺 Modo ${isFullscreen ? 'ventana' : 'pantalla completa'}`)
            break
          case 'Escape':
            e.preventDefault()
            if (isCheckoutOpen) {
              setIsCheckoutOpen(false)
              toast.info('❌ Checkout cancelado')
            } else if (showKeyboardShortcuts) {
              setShowKeyboardShortcuts(false)
            } else if (showAccessibilitySettings) {
              setShowAccessibilitySettings(false)
            } else if (showAdvancedFilters) {
              setShowAdvancedFilters(false)
            }
            break
          case '/':
            e.preventDefault()
            document.getElementById('search-input')?.focus()
            break
          case '+':
            e.preventDefault()
            if (filteredProducts.length > 0) {
              addToCart(filteredProducts[0])
              toast.success(`➕ ${filteredProducts[0].name} agregado`)
            }
            break
        }
      }

      // Navegación por números (1-9 para agregar productos rápidamente)
      if (!isInputFocused && /^[1-9]$/.test(e.key)) {
        const index = parseInt(e.key) - 1
        if (filteredProducts[index]) {
          addToCart(filteredProducts[index])
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [cart.length, clearCart, viewMode, showAdvancedFilters, showFeatured, isFullscreen, isCheckoutOpen, showKeyboardShortcuts, showAccessibilitySettings, filteredProducts, addToCart])

  // Búsqueda por código de barras
  useEffect(() => {
    const normalized = normalizeBarcode(barcodeInput)
    if (normalized.length === 8 || normalized.length === 13) {
      const valid = isValidEan(normalized)
      if (!valid) {
        toast.error('Código de barras inválido')
        setBarcodeInput('')
        return
      }

      const product = inventoryProducts.find(
        (p) => p.barcode === normalized || p.barcode === barcodeInput
      )

      if (product) {
        addToCart(product)
        setBarcodeInput('')
        toast.success(`${product.name} agregado al carrito`)
      } else {
        toast.error('Producto no encontrado')
        setBarcodeInput('')
      }
    }
  }, [barcodeInput, addToCart, inventoryProducts])

  return (
    <div className={`h-screen flex flex-col bg-background ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header móvil compactado */}
      <div className="lg:hidden pos-header-gradient shadow-sm border-b shrink-0">
        {/* Header principal */}
        <div className="p-2 sm:p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">4G POS</h1>
              <p className="text-xs text-muted-foreground truncate">Sistema de punto de venta avanzado</p>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <ThemeToggleSimple />
              <Link href="/dashboard/pos/dashboard">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9 px-2 sm:px-3"
                  aria-label="Ir al dashboard"
                >
                  <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 px-2 sm:px-3"
                onClick={() => setIsFullscreen(!isFullscreen)}
                aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              >
                {isFullscreen ? <Minimize className="h-3 w-3 sm:h-4 sm:w-4" /> : <Maximize className="h-3 w-3 sm:h-4 sm:w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 px-2 sm:px-3"
                onClick={() => setShowKeyboardShortcuts(true)}
                aria-label="Mostrar atajos de teclado"
              >
                <Keyboard className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 px-2 sm:px-3"
                onClick={() => setShowAccessibilitySettings(true)}
                aria-label="Configuración de accesibilidad"
              >
                <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>

          {/* Alertas de inventario móvil */}
          <div className="mb-3">
            <InventoryAlerts />
          </div>

          {/* Resumen del carrito móvil mejorado */}
          <div className="bg-secondary rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="bg-accent rounded-full p-1.5">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {cartCalculations.totalItemCount} {cartCalculations.totalItemCount === 1 ? 'artículo' : 'artículos'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {cart.length > 0 ? `Promedio: ${formatCurrency(cartCalculations.averageItemPrice)}` : (selectedRepairIds.length > 0 ? 'Reparación vinculada' : 'Carrito vacío')}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="text-lg font-bold text-primary">{formatCurrency(cartCalculations.total)}</p>
                <Button
                  size="sm"
                  onClick={() => setIsCheckoutOpen(true)}
                  className="pos-button-primary h-7 px-3 text-xs mt-1"
                  aria-label={`Procesar pago por ${formatCurrency(cartCalculations.total)}`}
                >
                  Procesar
                </Button>
              </div>
            </div>

            {/* Indicador de descuentos en móvil */}
            {cartCalculations.hasDiscount && (
              <div className="mt-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="pos-savings-chip text-primary font-medium">💰 Ahorros:</span>
                  <span className="pos-savings-chip text-primary font-bold">{formatCurrency(cartCalculations.totalSavings)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Barra de acciones rápidas móvil */}
        <div className="bg-muted border-t border-border px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="h-7 px-2 text-xs"
                aria-label={`Cambiar a vista ${viewMode === 'grid' ? 'lista' : 'grilla'}`}
              >
                {viewMode === 'grid' ? <List className="h-3 w-3" /> : <Grid className="h-3 w-3" />}
              </Button>
              <Button
                variant={showFeatured ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFeatured(!showFeatured)}
                className="h-7 px-2 text-xs"
                aria-label={showFeatured ? "Mostrar todos los productos" : "Mostrar solo destacados"}
              >
                <Star className="h-3 w-3" />
              </Button>
              <Button
                variant={showAdvancedFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="h-7 px-2 text-xs"
                aria-label={showAdvancedFilters ? "Ocultar filtros" : "Mostrar filtros"}
              >
                <Filter className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {filteredProducts.length} productos
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs">Mayorista</span>
                <Switch
                  checked={isWholesale}
                  onCheckedChange={setIsWholesale}
                  aria-label="Ver precio mayorista"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Contenido principal */}
        <div className={`flex-1 flex flex-col ${sidebarCollapsed ? 'lg:ml-0' : 'lg:ml-0'}`}>
          {/* Header desktop optimizado */}
          <div className="hidden lg:flex items-center justify-between bg-card/50 backdrop-blur-md border-b border-border/60 px-6 py-2 sticky top-0 z-20">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <div className="font-bold text-xl text-primary tracking-tight">4G</div>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground leading-none">Punto de Venta</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 h-4 border-muted-foreground/30 text-muted-foreground font-normal">
                      v4.0
                    </Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${registerState[activeRegisterId]?.isOpen ? 'bg-green-500' : 'bg-red-500'}`} />
                      {registerState[activeRegisterId]?.isOpen ? 'Caja Abierta' : 'Caja Cerrada'}
                    </span>
                    <div className="w-px h-3 bg-border/40 mx-1" />
                    <SupabaseStatus mode="compact" />
                  </div>
                </div>
              </div>

              <div className="h-8 w-px bg-border/60 mx-2" />

              {/* Selector de caja simplificado */}
              <div className="flex items-center gap-2">
                <Select value={activeRegisterId} onValueChange={(val) => setActiveRegisterId(val)}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-background border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 truncate">
                      <CreditCard className="h-3 w-3 text-muted-foreground" />
                      <SelectValue placeholder="Caja" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {registers.map(reg => (
                      <SelectItem key={reg.id} value={reg.id} className="text-xs">
                        {reg.name || `Caja ${reg.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => setIsRegisterManagerOpen(true)}
                  title="Gestionar cajas"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted/30 rounded-lg p-1 border border-border/40 mr-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-3 text-xs font-medium hover:bg-background shadow-none"
                  onClick={() => {
                    setMovementType('out')
                    setMovementAmount('')
                    setMovementNote('')
                    setIsMovementDialogOpen(true)
                  }}
                >
                  <GSIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Movimientos
                </Button>
                <div className="w-px h-4 bg-border/40 mx-1" />
                <Link href="/dashboard/pos/caja">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-xs font-medium hover:bg-background shadow-none"
                  >
                    <FileText className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    Detalles de Caja
                  </Button>
                </Link>
                <div className="w-px h-4 bg-border/40 mx-1" />
                <Link href="/dashboard/pos/dashboard">
                  <Button variant="ghost" size="sm" className="h-7 px-3 text-xs font-medium hover:bg-background shadow-none">
                    <BarChart3 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    Reportes
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>



          {/* Alertas de inventario desktop */}
          <div className="hidden lg:block px-6 pt-4">
            <InventoryAlerts />
          </div>

          {/* Barra de búsqueda y filtros */}
          <div className="bg-card border-b border-border p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Búsqueda con autocompletado */}
              <div className="flex-1 relative" id="search-container">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="search-input"
                    placeholder="Buscar productos por nombre, SKU o código de barras..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-10 pr-4"
                  />
                </div>

                {/* Sugerencias de autocompletado */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-popover border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                    {searchSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion}
                        className={`px-4 py-2 cursor-pointer hover:bg-muted ${index === selectedSuggestionIndex ? 'bg-accent text-accent-foreground' : ''
                          }`}
                        onClick={() => selectSuggestion(suggestion)}
                      >
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <span>{suggestion}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Filtros rápidos */}
              <div className="flex flex-wrap gap-2">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category === 'all' ? 'Todas las categorías' : category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant={showFeatured ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFeatured(!showFeatured)}
                >
                  <Star className="h-4 w-4 mr-2" />
                  Destacados
                </Button>

                <Button
                  variant={viewMode === 'grid' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                >
                  {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                </Button>

                <Button
                  variant={showAdvancedFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  {showAdvancedFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>

            {/* Filtros avanzados */}
            {showAdvancedFilters && (
              <Card className="mt-4">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Ordenar por</label>
                      <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Nombre</SelectItem>
                          <SelectItem value="price">Precio</SelectItem>
                          <SelectItem value="stock">Stock</SelectItem>
                          <SelectItem value="category">Categoría</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Orden</label>
                      <div className="flex gap-2">
                        <Button
                          variant={sortOrder === 'asc' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSortOrder('asc')}
                        >
                          A-Z
                        </Button>
                        <Button
                          variant={sortOrder === 'desc' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSortOrder('desc')}
                        >
                          Z-A
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Stock</label>
                      <Select value={stockFilter} onValueChange={(value: any) => setStockFilter(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="in_stock">En stock</SelectItem>
                          <SelectItem value="low_stock">Stock bajo</SelectItem>
                          <SelectItem value="out_of_stock">Sin stock</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Acciones</label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchTerm('')
                          setSelectedCategory('all')
                          setShowFeatured(false)
                          setSortBy('name')
                          setSortOrder('asc')
                          setStockFilter('all')
                        }}
                      >
                        Limpiar filtros
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Contenido principal con productos y carrito */}
          <div className="flex-1 flex overflow-hidden bg-muted/5">
            {/* Lista de productos */}
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto pb-24 md:pb-4" role="main" aria-label="Lista de productos">
              <div className="mb-4 space-y-4">
                <div className="flex items-center justify-between bg-card p-3 rounded-lg border border-border/60 shadow-sm">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2" id="products-heading">
                    <Package className="h-5 w-5 text-primary" />
                    Productos <span className="text-muted-foreground font-normal text-sm">({filteredProducts.length})</span>
                  </h2>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Mayorista</span>
                      <Switch
                        checked={isWholesale}
                        onCheckedChange={setIsWholesale}
                        aria-label="Ver precio mayorista"
                        className="scale-75 origin-right"
                      />
                    </div>
                  </div>
                </div>

                {/* Escáner de códigos de barras integrado */}
                <POSBarcodeScanner
                  onProductFound={async (barcode) => {
                    const normalized = normalizeBarcode(barcode)
                    const localProduct = inventoryProducts.find(
                      (p) => p.barcode === barcode || p.barcode === normalized
                    )
                    if (localProduct) {
                      addToCart(localProduct)
                      toast.success(`${localProduct.name} agregado al carrito`)
                      return
                    }
                    const remoteProduct = await findProductByBarcode(normalized)
                    if (remoteProduct) {
                      addToCart(remoteProduct)
                      toast.success(`${remoteProduct.name} agregado al carrito`)
                    } else {
                      toast.error('Producto no encontrado')
                    }
                  }}
                  className="w-full shadow-sm"
                />
              </div>

              {/* Estados de carga y error */}
              {productsLoading && (
                <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border shadow-sm">
                  <div className="bg-muted/30 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="h-10 w-10 text-muted-foreground/50 animate-spin" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">Cargando productos...</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">Obteniendo productos desde la base de datos</p>
                </div>
              )}

              {productsError && !productsLoading && (
                <div className="text-center py-16 bg-card rounded-xl border border-dashed border-red-200 shadow-sm">
                  <div className="bg-red-50 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <XCircle className="h-10 w-10 text-red-500" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">Error al cargar productos</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-4">{productsError}</p>
                  <Button 
                    onClick={() => window.location.reload()} 
                    variant="outline" 
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Reintentar
                  </Button>
                </div>
              )}

              {!productsLoading && !productsError && inventoryProducts.length === 0 && (
                <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border shadow-sm">
                  <div className="bg-muted/30 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">No hay productos</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-4">No se encontraron productos en la base de datos</p>
                  <Link href="/dashboard/products">
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar productos
                    </Button>
                  </Link>
                </div>
              )}

              {!productsLoading && !productsError && inventoryProducts.length > 0 && paginatedProducts.length > virtualizationThreshold ? (
                <div className="rounded-xl overflow-hidden border border-border/50 shadow-sm bg-card">
                  <VirtualizedProductGrid
                    products={paginatedProducts}
                    viewMode={viewMode}
                    height={viewportHeight - 200}
                    onAddToCart={addToCart}
                    getCartQuantity={(id: string) => cart.find(item => item.id === id)?.quantity || 0}
                    inventoryManager={inventoryManager}
                    isWholesale={isWholesale}
                    wholesaleDiscountRate={WHOLESALE_DISCOUNT_RATE}
                    showStock={true}
                    showBarcode={true}
                  />
                </div>
              ) : !productsLoading && !productsError && inventoryProducts.length > 0 ? (
                <div
                  className={`grid gap-3 ${viewMode === 'grid'
                      ? 'product-grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                      : 'grid-cols-1 max-w-4xl mx-auto'
                    }`}
                  role="grid"
                  aria-labelledby="products-heading"
                  aria-live="polite"
                  aria-atomic="false"
                >
                  {paginatedProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      viewMode={viewMode}
                      addToCart={addToCart}
                      formatCurrency={formatCurrency}
                      inventoryManager={inventoryManager}
                      isWholesale={isWholesale}
                      wholesaleDiscountRate={WHOLESALE_DISCOUNT_RATE}
                    />
                  ))}
                </div>
              ) : null}

              {!productsLoading && !productsError && inventoryProducts.length > 0 && filteredProducts.length === 0 && (
                <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border shadow-sm">
                  <div className="bg-muted/30 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">No se encontraron productos</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">Intenta ajustar los términos de búsqueda o los filtros seleccionados</p>
                </div>
              )}

              {/* Controles de paginación */}
              {!productsLoading && !productsError && filteredProducts.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 py-4 border-t border-border/50">
                  <div className="flex items-center gap-2 order-2 sm:order-1">
                    <span className="text-sm text-muted-foreground">Mostrar:</span>
                    <Select
                      value={String(itemsPerPage)}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value))
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="h-8 w-[80px] text-xs">
                        <SelectValue placeholder="12" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="24">24</SelectItem>
                        <SelectItem value="48">48</SelectItem>
                        <SelectItem value="96">96</SelectItem>
                        <SelectItem value="1000">Todos</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground ml-2">
                      Total: {filteredProducts.length}
                    </span>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-2 order-1 sm:order-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-2 shadow-sm"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                      </Button>
                      <span className="text-sm font-medium bg-muted/30 px-3 py-1 rounded-md border shadow-sm min-w-[80px] text-center">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2 shadow-sm"
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Carrito lateral mejorado - responsive */}
            <div className="hidden md:flex flex-col w-[22rem] lg:w-96 xl:w-[26rem] bg-card border-l shadow-[rgb(0_0_0_/_0.1)_0px_0px_15px_-3px] h-full transition-all duration-300 z-20">
              {/* Header del carrito */}
              <div className="p-3 border-b border-border bg-muted/20 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 p-1.5 rounded-md">
                      <ShoppingCart className="h-4 w-4 text-primary" />
                    </div>
                    <h2 className="text-base font-semibold text-foreground">Carrito</h2>
                  </div>
                  <Badge variant="secondary" className="text-xs font-normal bg-background border shadow-sm">
                    {cartCalculations.totalItemCount} items
                  </Badge>
                </div>

                {/* Resumen rápido */}
                {(cart.length > 0 || selectedRepairIds.length > 0) && (
                  <div className="bg-background rounded-lg p-3 border border-border/60 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                      <CreditCard className="h-12 w-12 text-primary" />
                    </div>
                    <div className="flex justify-between items-baseline relative z-10">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Estimado</span>
                      <span className="font-bold text-xl text-primary tracking-tight">
                        {formatCurrency(cartCalculations.total)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista de productos */}
              <div className="flex-1 overflow-y-auto p-3 min-h-0 space-y-2 bg-muted/5 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
                    <div className="bg-muted/50 rounded-full p-5 mb-3">
                      {selectedRepairIds.length > 0 ? (
                        <Wrench className="h-10 w-10 text-primary" />
                      ) : (
                        <ShoppingCart className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="text-base font-medium text-foreground mb-1">
                      {selectedRepairIds.length > 0 ? 'Reparación Seleccionada' : 'Carrito vacío'}
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-[180px]">
                      {selectedRepairIds.length > 0 
                        ? 'Puede proceder al cobro o agregar productos adicionales'
                        : 'Escanea o selecciona productos para comenzar'}
                    </p>
                  </div>
                ) : (
                  <>
                    {cart.map((item, index) => (
                      <div key={item.id} className="group relative bg-card rounded-lg border border-border/60 hover:border-primary/30 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                        <div className="p-2.5 flex gap-2.5">
                          {/* Imagen del producto */}
                          <div className="h-12 w-12 bg-muted/30 rounded-md flex items-center justify-center text-lg flex-shrink-0 border border-border/30 self-center">
                            {item.image}
                          </div>

                          {/* Información del producto */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            <div className="flex justify-between items-start gap-1">
                              <h4 className="text-xs font-semibold text-foreground/90 truncate leading-tight pr-5">{item.name}</h4>
                              <button 
                                onClick={() => removeFromCart(item.id)}
                                className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded transition-all absolute top-1.5 right-1.5 p-1"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            
                            <div className="flex items-end justify-between mt-1.5">
                              <div className="flex flex-col leading-none gap-0.5">
                                <span className="text-xs font-bold text-primary">
                                  {formatCurrency(item.price)}
                                </span>
                                {item.stock - item.quantity <= 3 && (
                                  <span className={`text-[9px] font-medium ${
                                    item.stock - item.quantity === 0 
                                      ? 'text-destructive' 
                                      : 'text-yellow-600'
                                  }`}>
                                    {item.stock - item.quantity === 0 ? 'Sin Stock' : `Queda ${item.stock - item.quantity}`}
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center bg-muted/30 rounded-md border border-border/40 h-6">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-full w-6 p-0 hover:bg-background hover:text-destructive rounded-l-md"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-2.5 w-2.5" />
                                </Button>
                                <span className="w-6 text-center text-xs font-semibold tabular-nums leading-none">{item.quantity}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-full w-6 p-0 hover:bg-background hover:text-primary rounded-r-md"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= item.stock}
                                >
                                  <Plus className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Subtotal footer - sutil */}
                        {item.quantity > 1 && (
                          <div className="bg-muted/20 px-2.5 py-1 flex justify-between items-center border-t border-border/30">
                            <span className="text-[9px] text-muted-foreground font-medium">Subtotal</span>
                            <span className="text-xs font-bold text-foreground/80">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Resumen y acciones */}
              {(cart.length > 0 || selectedRepairIds.length > 0) && (
                <div className="border-t border-border bg-card p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30">
                  {/* Desglose de costos mejorado */}
                  <div className="space-y-2 mb-3">
                    {/* Toggle de venta mayorista */}
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-border/50">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">Precio Mayorista</span>
                        {isWholesale && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                            -{cartCalculations.wholesaleDiscountRate}%
                          </span>
                        )}
                      </div>
                      <Switch
                        checked={isWholesale}
                        onCheckedChange={setIsWholesale}
                        className="scale-75 origin-right"
                      />
                    </div>

                    <div className="space-y-1 px-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium text-foreground">{formatCurrency(cartCalculations.subtotal)}</span>
                      </div>

                      {/* Costo de reparación vinculada */}
                      {cartCalculations.repairCost > 0 && (
                        <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                          <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> Reparación</span>
                          <span className="font-medium">+{formatCurrency(cartCalculations.repairCost)}</span>
                        </div>
                      )}

                      {/* Ahorros */}
                      {cartCalculations.hasDiscount && (
                        <div className="flex justify-between text-xs text-green-600 dark:text-green-400">
                          <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Descuentos</span>
                          <span className="font-medium">-{formatCurrency(cartCalculations.totalSavings)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Impuestos (IVA)</span>
                        <span className="font-medium text-foreground">{formatCurrency(cartCalculations.tax)}</span>
                      </div>

                      <Separator className="my-1.5" />

                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">Total a Pagar</span>
                          {selectedCustomer && (
                            <span className="text-[10px] text-primary flex items-center gap-1">
                              <Award className="h-3 w-3" /> +{calculateLoyaltyPoints(cartCalculations.total)} pts
                            </span>
                          )}
                        </div>
                        <span className="text-2xl font-bold text-primary leading-none">
                          {formatCurrency(cartCalculations.total)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      variant="outline"
                      className="col-span-1 h-11 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 sm:flex hidden"
                      onClick={(e) => clearCart()}
                      disabled={cart.length === 0}
                      title="Limpiar Carrito"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                    
                    {/* Botón de limpiar carrito visible en móvil */}
                    <Button
                      variant="outline"
                      className="col-span-1 h-11 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 sm:hidden flex items-center justify-center"
                      onClick={(e) => clearCart()}
                      disabled={cart.length === 0}
                      title="Limpiar Carrito"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Limpiar</span>
                    </Button>
                    
                    <Button
                      className="col-span-3 h-11 text-base font-bold shadow-md hover:shadow-lg transition-all"
                      onClick={() => setIsCheckoutOpen(true)}
                    >
                      Cobrar <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Cart Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t p-4 shadow-lg z-50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
             <span className="text-xs text-muted-foreground">{cartCalculations.totalItemCount} items</span>
             <span className="font-bold text-lg">{formatCurrency(cartCalculations.total)}</span>
          </div>
          
          {/* Botón de limpiar carrito en móvil */}
          {cart.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 px-3"
              onClick={() => clearCart()}
              title="Limpiar Carrito"
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-1 text-xs">Limpiar</span>
            </Button>
          )}
          
          <Button 
            className="flex-1 h-12 text-lg"
            onClick={() => setIsCheckoutOpen(true)}
            disabled={cart.length === 0 && selectedRepairIds.length === 0}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Pagar
          </Button>
        </div>
      </div>

      {/* Modal de checkout */}
      <CheckoutModal
        selectedRepairIds={selectedRepairIds}
        setSelectedRepairIds={setSelectedRepairIds}
        customerRepairs={customerRepairs}
        markRepairDelivered={markRepairDelivered}
        setMarkRepairDelivered={setMarkRepairDelivered}
        finalCostFromSale={finalCostFromSale}
        setFinalCostFromSale={setFinalCostFromSale}
        selectedRepairs={selectedRepairs}
        supabaseStatusToLabel={supabaseStatusToLabel}
        cart={cart}
        cartCalculations={cartCalculations}
        isWholesale={isWholesale}
        WHOLESALE_DISCOUNT_RATE={WHOLESALE_DISCOUNT_RATE}
        processSale={processSale}
        processMixedPayment={processMixedPayment}
        formatCurrency={formatCurrency}
        isRegisterOpen={getCurrentRegister.isOpen}
        onOpenRegister={() => setIsOpenRegisterDialogOpen(true)}
        onCancel={() => {
          setIsCheckoutOpen(false)
          resetCheckoutState()
          setPaymentAttempts([])
        }}
      />

      {/* Diálogo para abrir caja */}
      <Dialog open={isOpenRegisterDialogOpen} onOpenChange={setIsOpenRegisterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
            <DialogDescription>
              Ingrese el monto inicial en caja para comenzar el turno.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Monto Inicial</Label>
              <Input
                id="amount"
                type="number"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Nota (Opcional)</Label>
              <Input
                id="note"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                placeholder="Ej. Turno mañana"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpenRegisterDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              const amount = parseFloat(openingAmount) || 0
              openRegister(amount, openingNote)
              setIsOpenRegisterDialogOpen(false)
              setOpeningAmount('0')
              setOpeningNote('')
            }}>Abrir Caja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Gestión de Cajas */}
      <Dialog open={isRegisterManagerOpen} onOpenChange={setIsRegisterManagerOpen}>
        <DialogContent className="max-w-xl dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              Gestionar cajas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-3">Cajas actuales</h3>
              {registers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay cajas. Cree una nueva abajo.</p>
              ) : (
                <div className="space-y-3">
                  {registers.map((reg) => (
                    <div key={reg.id} className="flex items-center justify-between gap-3 border rounded-md p-3 bg-card">
                      <div className="flex-1">
                        {renameRegisterId === reg.id ? (
                          <Input
                            value={renameRegisterName}
                            onChange={(e) => setRenameRegisterName(e.target.value)}
                            placeholder="Nombre de la caja"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{reg.name || `Caja ${reg.id}`}</span>
                            <Badge className={(registerState[reg.id]?.isOpen) ? 'bg-green-600' : 'bg-gray-500'}>
                              {(registerState[reg.id]?.isOpen) ? 'Abierta' : 'Cerrada'}
                            </Badge>
                            {activeRegisterId === reg.id && (
                              <Badge variant="outline">Actual</Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {renameRegisterId === reg.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={async () => {
                                const name = renameRegisterName.trim()
                                if (name.length < 2) { toast.error('Nombre demasiado corto'); return }
                                setRegisters(registers.map(r => r.id === reg.id ? { ...r, name } : r))
                                if (config.supabase.isConfigured) {
                                  try {
                                    const supabase = createSupabaseClient()
                                    const { error } = await (supabase
                                      .from('cash_registers')
                                      .update({ name })
                                      .eq('id', reg.id)
                                      .select()
                                      .maybeSingle())
                                    if (error) toast.error('Error al sincronizar nombre en Supabase')
                                  } catch (e) {
                                    console.error('Error syncing register name:', e)
                                  }
                                }
                                setRenameRegisterId(null)
                                setRenameRegisterName('')
                                toast.success('Caja renombrada')
                              }}
                            >
                              Guardar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setRenameRegisterId(null); setRenameRegisterName('') }}
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setRenameRegisterId(reg.id); setRenameRegisterName(reg.name || '') }}
                            >
                              Renombrar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                const nextRegs = registers.filter(r => r.id !== reg.id)
                                setRegisters(nextRegs.length ? nextRegs : [{ id: 'principal', name: 'Caja Principal' }])
                                setRegisterState(prev => {
                                  const { [reg.id]: _removed, ...rest } = prev
                                  return nextRegs.length ? rest : { principal: { isOpen: false, balance: 0, movements: [] } }
                                })
                                if (activeRegisterId === reg.id) {
                                  setActiveRegisterId(nextRegs.length ? nextRegs[0].id : 'principal')
                                }
                                if (config.supabase.isConfigured) {
                                  try {
                                    const supabase = createSupabaseClient()
                                    const { error } = await supabase
                                      .from('cash_registers')
                                      .delete()
                                      .eq('id', reg.id)
                                    if (error) toast.error('Error al eliminar caja en Supabase')
                                  } catch (e) {
                                    console.error('Error deleting register:', e)
                                  }
                                }
                                toast.success('Caja eliminada')
                              }}
                            >
                              Eliminar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Nueva caja</label>
                <Input
                  value={newRegisterName}
                  onChange={(e) => setNewRegisterName(e.target.value)}
                  placeholder="Nombre de la nueva caja"
                />
              </div>
              <div className="md:col-span-1">
                <Button
                  className="w-full"
                  onClick={async () => {
                    const name = newRegisterName.trim()
                    if (name.length < 2) { toast.error('Nombre demasiado corto'); return }
                    let newId = `reg-${Date.now()}`
                    if (config.supabase.isConfigured) {
                      try {
                        const supabase = createSupabaseClient()
                        const { data, error } = await supabase
                          .from('cash_registers')
                          .insert({ name, is_open: false, balance: 0 })
                          .select('id')
                          .single()
                        if (error) {
                          toast.error('Error al crear caja en Supabase')
                        } else {
                          const insertedId = (data as { id?: string } | null)?.id
                          if (insertedId) {
                            newId = insertedId as string
                          }
                        }
                      } catch (e) {
                        console.error('Error creating register in Supabase:', e)
                      }
                    }
                    setRegisters([...registers, { id: newId, name }])
                    setRegisterState(prev => ({
                      ...prev,
                      [newId]: { isOpen: false, balance: 0, movements: [] }
                    }))
                    setNewRegisterName('')
                    toast.success('Caja creada')
                  }}
                >
                  Crear caja
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de atajos de teclado */}
      <Dialog open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atajos de Teclado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Ctrl + F</strong>
                <p className="text-muted-foreground">Buscar productos</p>
              </div>
              <div>
                <strong>Ctrl + Enter</strong>
                <p className="text-muted-foreground">Abrir checkout</p>
              </div>
              <div>
                <strong>Ctrl + Backspace</strong>
                <p className="text-muted-foreground">Vaciar carrito completo</p>
              </div>
              <div>
                <strong>F1</strong>
                <p className="text-muted-foreground">Mostrar atajos</p>
              </div>
              <div>
                <strong>F2</strong>
                <p className="text-muted-foreground">Filtros avanzados</p>
              </div>
              <div>
                <strong>F3</strong>
                <p className="text-muted-foreground">Configuración de accesibilidad</p>
              </div>
              <div>
                <strong>F4</strong>
                <p className="text-muted-foreground">Pantalla completa</p>
              </div>
              <div>
                <strong>F5</strong>
                <p className="text-muted-foreground">Productos destacados</p>
              </div>
              <div>
                <strong>Ctrl + V</strong>
                <p className="text-muted-foreground">Cambiar vista</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Ticket/Receipt */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Ticket de Venta
            </DialogTitle>
          </DialogHeader>

          {currentReceipt && (
            <div className="space-y-4">
              <ReceiptGenerator
                receiptData={currentReceipt}
                formatCurrency={formatCurrency}
                onPrint={() => printReceipt(currentReceipt)}
                onDownload={() => downloadReceipt(currentReceipt)}
                onShare={() => shareReceipt(currentReceipt)}
              />

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => printReceipt(currentReceipt)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => downloadReceipt(currentReceipt)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => shareReceipt(currentReceipt)}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartir
                </Button>
              </div>

              <Button
                className="w-full"
                onClick={() => setShowReceiptModal(false)}
              >
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Diálogo de configuración de accesibilidad */}
      <AccessibilitySettings isOpen={showAccessibilitySettings} onClose={() => setShowAccessibilitySettings(false)} />

      {/* Selector de variantes */}
      {selectedProductForVariants && (
        <VariantSelector
          product={selectedProductForVariants}
          isOpen={variantSelectorOpen}
          onClose={() => {
            setVariantSelectorOpen(false)
            setSelectedProductForVariants(null)
          }}
          onAddToCart={addVariantToCart}
        />
      )}

      {/* Diálogo de Registro de Movimiento */}
      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
            <DialogDescription>
              Seleccione el tipo de movimiento e ingrese los detalles.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex justify-center gap-4 mb-2">
              <Button
                type="button"
                variant={movementType === 'in' ? 'default' : 'outline'}
                className={movementType === 'in' ? 'bg-green-600 hover:bg-green-700' : 'text-green-600 border-green-200'}
                onClick={() => setMovementType('in')}
              >
                <ArrowUpCircle className="mr-2 h-4 w-4" />
                Ingreso
              </Button>
              <Button
                type="button"
                variant={movementType === 'out' ? 'default' : 'outline'}
                className={movementType === 'out' ? 'bg-red-600 hover:bg-red-700' : 'text-red-600 border-red-200'}
                onClick={() => setMovementType('out')}
              >
                <ArrowDownCircle className="mr-2 h-4 w-4" />
                Egreso
              </Button>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="mov-amount">Monto</Label>
              <Input
                id="mov-amount"
                type="number"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mov-note">Motivo / Nota</Label>
              <Input
                id="mov-note"
                value={movementNote}
                onChange={(e) => setMovementNote(e.target.value)}
                placeholder={movementType === 'in' ? "Ej. Cambio inicial" : "Ej. Pago a proveedor"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovementDialogOpen(false)}>Cancelar</Button>
            <Button 
              variant={movementType === 'out' ? "destructive" : "default"}
              className={movementType === 'in' ? "bg-green-600 hover:bg-green-700" : ""}
              onClick={() => {
                const amount = parseFloat(movementAmount)
                if (!amount || amount <= 0) {
                  toast.error('Ingrese un monto válido')
                  return
                }
                addMovement(movementType, amount, movementNote)
                setIsMovementDialogOpen(false)
                toast.success('Movimiento registrado')
              }}
            >
              {movementType === 'in' ? 'Registrar Ingreso' : 'Registrar Egreso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

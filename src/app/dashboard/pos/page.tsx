'use client'

import React, { useState, useMemo, useCallback, useEffect, memo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, FileText,
  Users, Package, Star, Filter, Grid, List,
  Keyboard, Maximize, Minimize, BarChart3,
  Clock, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Save,
  Printer, Download, Share2, Settings, AlertTriangle,
  Loader2, CheckCircle2, XCircle, Tag, Sparkles, Award, ArrowRight, Wrench,
  ArrowUpCircle, ArrowDownCircle, MoreHorizontal, Info,
  UserPlus, DollarSign, RotateCcw, SlidersHorizontal, BookOpen
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { useCashRegisterContext } from './contexts/CashRegisterContext'
import { Button } from '@/components/ui/button'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { toast } from 'sonner'
import { showAddToCartToast } from '@/lib/pos-toasts'
import { ReceiptGenerator } from '@/components/pos/ReceiptGenerator'
import { createReceiptData, printReceipt, downloadReceipt, shareReceipt } from '@/lib/receipt-utils'
// Limpieza: se retiran componentes de debug/diagnóstico del POS
import { VirtualizedProductGrid } from './components/VirtualizedProductList'
import { formatStockStatus } from '@/lib/inventory-manager'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { config, isDemoNoDb, getFeatureFlag } from '@/lib/config'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { SupabaseStatus } from '@/components/supabase-status'
import { formatCurrency as formatCurrencyBase } from '@/lib/currency'
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
import { usePromotions } from '@/hooks/use-promotions'
import { ProductWithVariants, ProductVariant } from '@/types/product-variants'
import { usePerformanceMonitor, useRenderTimeMonitor } from './hooks/usePerformanceMonitor'
import { recordMetric } from './utils/performance-monitor'
import { useErrorHandler } from './hooks/useErrorHandler'
import { ErrorMonitor } from './components/ErrorMonitor'
import { PerformanceDashboard } from './components/PerformanceDashboard'
import { ProductCard } from './components/ProductCard'
import { POSHeader } from './components/POSHeader'
import { POSCart } from './components/POSCart'
import { CheckoutModal } from './components/CheckoutModal'
import { getCartProductCreditPlans } from './lib/cart-credit-plans'
import { OpenCashRegisterDialog } from './components/OpenCashRegisterDialog'
import { useOptimizedCart } from './hooks/useOptimizedCart'
import { useCheckout } from './contexts/CheckoutContext'
import { usePOSCustomer } from './contexts/POSCustomerContext'
import { useBranch } from '@/contexts/branch-context'
import { useAuth } from '@/contexts/auth-context'
import { CartItem, PaymentMethodOption } from './types'
import type { Product } from '@/types/product-unified'
import { branchHeaders } from '@/lib/branches/client'
import { buildQuickItemPayload, getQuickItemApiError, getQuickItemMargin } from './lib/quick-item'
import { useCanViewCost } from '@/hooks/use-can-view-cost'
import { useHeldSales, HeldSale } from './hooks/useHeldSales'
import { HeldSalesModal } from './components/HeldSalesModal'
import { POSShortcutsBar } from './components/POSShortcutsBar'
import { POSRepairChargeModal } from './components/POSRepairChargeModal'
import { CustomerQuickCreateDialog } from '@/components/dashboard/repairs/CustomerQuickCreateDialog'
import { POSProductDetailDialog } from './components/POSProductDetailDialog'
import { POSCashMovementDialog } from './components/POSCashMovementDialog'
import { buildPosCreditSummary } from '@/lib/credits/pos-credit-summary'
import { getMixedPaymentValidation } from './lib/payment-validation'
import { getRepairBalanceDue, type ChargeableRepair } from './lib/repair-charge'
import { hasProductCredit } from './lib/product-credit'
import {
  applyProductCreditFilter,
  type ProductCreditSort,
} from './lib/product-credit-filter'
// Hooks extraídos por la refactorización de page.tsx
import { usePOSRepairs, type PosCartRepair } from './hooks/usePOSRepairs'
import { usePOSSearch } from './hooks/usePOSSearch'
import { usePOSSaleProcessor } from './hooks/usePOSSaleProcessor'

/** Lo minimo que necesita el carrito para armar la linea de una reparacion.
 * @deprecated Usa PosCartRepair desde './hooks/usePOSRepairs'
 */
type _PosCartRepair = PosCartRepair

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
  return (
    <React.Suspense fallback={null}>
      <POSPageContent />
    </React.Suspense>
  )
}

function POSPageContent() {
  const { settings } = useSharedSettings()
  const taxPercentage = Number.isFinite(settings.taxRate) ? settings.taxRate : 10
  const taxRate = taxPercentage / 100
  const formatCurrency = useCallback(
    (amount: number) => formatCurrencyBase(amount, {
      currency: settings.currency || 'PYG',
      minimumFractionDigits: settings.currency === 'PYG' ? 0 : 2,
      maximumFractionDigits: settings.currency === 'PYG' ? 0 : 2,
    }),
    [settings.currency]
  )
  
  const companyInfo = useMemo(() => ({
    name: settings.companyName || config.company.name,
    address: settings.companyAddress || config.company.address,
    phone: settings.companyPhone || config.company.phone,
    email: settings.companyEmail || config.company.email,
    ruc: settings.companyRuc
  }), [settings])

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

  // Estados principales — búsqueda gestionada por usePOSSearch (ver abajo)
  // Cart state managed by useOptimizedCart hook

  // Use centralized customer state
  const { 
    selectedCustomer, 
    setSelectedCustomer, 
    activeCustomer,
    customers, 
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
    electronicProvider,
    electronicInstitution,
    electronicChannel,
    terminalId,
    splitAmount,
    setSplitAmount,
    notes,
    setNotes,
    creditTerms,
    applyProductCreditSuggestion,
    paymentSplit,
    setPaymentSplit,
    addPaymentSplit,
    removePaymentSplit,
    resetCheckoutState,
    storeCreditApplied,
  } = useCheckout()
  


  // ── Reparaciones (extraído a usePOSRepairs) ──────────────────────────────
  const {
    customerRepairs,
    setCustomerRepairs,
    manualRepairs,
    setManualRepairs,
    selectedRepairIds,
    setSelectedRepairIds,
    selectedRepairs,
    markRepairDelivered,
    setMarkRepairDelivered,
    deliveryOutcome,
    setDeliveryOutcome,
    repairTotals,
    addRepairToCart: handleAddRepairToCart,
    removeRepair: removeRepairById,
    clearRepairs,
  } = usePOSRepairs({
    selectedCustomer,
    isCheckoutOpen,
    taxPercentage,
  })

  const { heldSales, heldSalesCount, parkSale, deleteSale, clearAllSales } = useHeldSales()
  const [isHeldSalesModalOpen, setIsHeldSalesModalOpen] = useState(false)
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false)
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [detailDialogScrollToCredit, setDetailDialogScrollToCredit] = useState(false)

  // Pre-load customer and repair from URL params (e.g. coming from /dashboard/repairs)
  const searchParams = useSearchParams()
  useEffect(() => {
    const cid = searchParams.get('customerId')
    const rid = searchParams.get('repairId')
    if (cid) setSelectedCustomer(cid)
    if (rid) setSelectedRepairIds([rid])
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Procesador de ventas (extraído a usePOSSaleProcessor) ─────────────────
  const {
    paymentAttempts,
    addPaymentAttempt,
    clearPaymentAttempts,
    normalizePaymentError,
    processSale: processSaleBase,
    processMixedPayment: processMixedPaymentBase,
  } = usePOSSaleProcessor()

  // Reiniciar estado de pago al abrir el modal
  useEffect(() => {
    if (isCheckoutOpen) {
      setPaymentStatus('idle')
      setPaymentError('')
    }
  }, [isCheckoutOpen, setPaymentError, setPaymentStatus])
  const [showPosGuide, setShowPosGuide] = useState(true)

  useEffect(() => {
    try {
      if (localStorage.getItem('pos_guide_hidden') === 'true') {
        setShowPosGuide(false)
      }
    } catch {
      // ignore
    }
  }, [])

  const handleHidePosGuide = () => {
    setShowPosGuide(false)
    try {
      localStorage.setItem('pos_guide_hidden', 'true')
    } catch {
      // ignore
    }
  }

  const handleShowPosGuide = () => {
    setShowPosGuide(true)
    try {
      localStorage.removeItem('pos_guide_hidden')
    } catch {
      // ignore
    }
  }

  const [barcodeInput, setBarcodeInput] = useState('')
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [showAccessibilitySettings, setShowAccessibilitySettings] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const supabaseStatusToLabel: Record<string, string> = {
    recibido: 'Recibido',
    diagnostico: 'En diagnóstico',
    reparacion: 'En reparación',
    listo: 'Listo para entrega',
    entregado: 'Entregado',
  }
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showCartDialog, setShowCartDialog] = useState(false)
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [isQuickItemDialogOpen, setIsQuickItemDialogOpen] = useState(false)
  // El costo se oculta a quien no tiene permiso, igual que en el resto del sistema.
  const canViewCost = useCanViewCost()
  const [quickItemName, setQuickItemName] = useState('')
  const [quickItemPrice, setQuickItemPrice] = useState('')
  const [quickItemQty, setQuickItemQty] = useState('1')
  const [quickItemPurchasePrice, setQuickItemPurchasePrice] = useState('')
  const [quickItemWholesalePrice, setQuickItemWholesalePrice] = useState('')
  const [quickItemSku, setQuickItemSku] = useState('')
  const [quickItemPublishToCatalog, setQuickItemPublishToCatalog] = useState(false)
  const quickItemMargin = getQuickItemMargin(
    Number(quickItemPurchasePrice) || 0,
    Number(quickItemPrice) || 0,
  )
  // El costo se captura al vender y queda inmutable: si se crea el item sin
  // costo, esa venta queda para siempre sin ganancia calculable en Finanzas.
  const quickItemMissingCost = canViewCost && !(Number(quickItemPurchasePrice) > 0)
  const [quickItemError, setQuickItemError] = useState('')
  const [quickItemSaving, setQuickItemSaving] = useState(false)

  // Estados para variantes y promociones
  const [variantSelectorOpen, setVariantSelectorOpen] = useState(false)
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<ProductWithVariants | null>(null)

  // Hooks para variantes y promociones
  const { getProductWithVariants, convertVariantToCartItem } = useProductVariants()
  const { applyPromotionByCode, calculateCartSummary } = usePromotionEngine()
  const { allPromotions } = usePromotions()

  // Descuento automático para clientes VIP
  const VIP_DISCOUNT_RATE = 10
  const [vipAutoApplied, setVipAutoApplied] = useState(false)



  // Contexto de caja
  const { 
    registers, 
    setRegisters,
    refreshRegisters,
    activeRegisterId, 
    currentSessionId,
    setActiveRegisterId, 
    getCurrentRegister,
    registerState,
    addMovement,
    openRegister
  } = useCashRegisterContext()
  const { selectedBranchId } = useBranch()
  const { user } = useAuth()
  const cashierName = user?.profile?.name || user?.email || 'Cajero'
  const canManageRegisters = user?.role === 'admin' || user?.role === 'super_admin'

  const handleRegisterChange = useCallback((id: string) => {
    if (!id || activeRegisterId === id) return
    
    // Ensure the register exists
    const registerExists = registers.find(r => r.id === id)
    if (!registerExists) {
      console.warn(`Register ${id} not found, using first available register`)
      const firstRegister = registers[0]
      if (firstRegister && firstRegister.id !== activeRegisterId) {
        React.startTransition(() => {
          setActiveRegisterId(firstRegister.id)
        })
      }
      return
    }
    
    React.startTransition(() => {
      setActiveRegisterId(id)
    })
  }, [activeRegisterId, setActiveRegisterId, registers])

  // Gestor de cajas: crear, renombrar, eliminar
  const [isOpenRegisterDialogOpen, setIsOpenRegisterDialogOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingNote, setOpeningNote] = useState('')
  const [isOpeningRegister, setIsOpeningRegister] = useState(false)
  const [isRegisterManagerOpen, setIsRegisterManagerOpen] = useState(false)
  const [newRegisterName, setNewRegisterName] = useState('')
  const [renameRegisterId, setRenameRegisterId] = useState<string | null>(null)
  const [renameRegisterName, setRenameRegisterName] = useState('')
  const [registerOpenStatus, setRegisterOpenStatus] = useState<Record<string, boolean>>({})
  const [registerManagerBusy, setRegisterManagerBusy] = useState(false)

  const refreshRegisterOpenStatus = useCallback(async () => {
    if (!isRegisterManagerOpen || registers.length === 0) {
      setRegisterOpenStatus({})
      return
    }

    const fallbackStatus = Object.fromEntries(
      registers.map((register) => [
        register.id,
        register.id === activeRegisterId && Boolean(registerState[activeRegisterId]?.isOpen),
      ])
    )

    if (!config.supabase.isConfigured) {
      setRegisterOpenStatus(fallbackStatus)
      return
    }

    try {
      const supabase = createSupabaseClient()
      let query = supabase
        .from('cash_closures')
        .select('register_id')
        .in('register_id', registers.map((register) => register.id))
        .is('date', null)

      if (selectedBranchId && selectedBranchId !== 'all') {
        query = query.eq('branch_id', selectedBranchId)
      }

      const { data, error } = await query

      if (error) {
        setRegisterOpenStatus(fallbackStatus)
        return
      }

      const openIds = new Set((data || []).map((session) => String(session.register_id)))
      setRegisterOpenStatus(
        Object.fromEntries(registers.map((register) => [register.id, openIds.has(register.id)]))
      )
    } catch {
      setRegisterOpenStatus(fallbackStatus)
    }
  }, [activeRegisterId, isRegisterManagerOpen, registerState, registers, selectedBranchId])

  useEffect(() => {
    if (!canManageRegisters && isRegisterManagerOpen) {
      setIsRegisterManagerOpen(false)
      return
    }
    refreshRegisterOpenStatus()
  }, [canManageRegisters, isRegisterManagerOpen, refreshRegisterOpenStatus])

  // Movement Dialog State
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false)
  const [movementType, setMovementType] = useState<'in' | 'out'>('out')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementNote, setMovementNote] = useState('')
  const [movementSaving, setMovementSaving] = useState(false)

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
    findProductByBarcode,
    syncProduct
  } = usePOSProducts()

  // Optimized Cart Hook
  const {
    cart,
    isWholesale,
    setIsWholesale,
    discount: generalDiscount,
    setDiscount: setGeneralDiscount,
    cartTotal,
    cartSubtotal,
    cartTax,
    cartItemCount,
    subtotalApplied,
    subtotalNonWholesale,
    generalDiscountAmount,
    wholesaleDiscountAmount,
    totalSavings,
    addToCart: addToCartHook,
    addVariantToCart: addVariantToCartHook,
    removeFromCart,
    updateQuantity,
    updateItemDiscount,
    updateItemPromoCode,
    clearCart,
    replaceCart,
    checkAvailability: checkCartAvailability
  } = useOptimizedCart(inventoryProducts, {
    taxRate,
    pricesIncludeTax: config.pricesIncludeTax
  })

  const handleWholesaleToggle = useCallback((value: boolean) => {
    if (isWholesale === value) return
    React.startTransition(() => {
      setIsWholesale(value)
    })
  }, [isWholesale, setIsWholesale])
  
  const WHOLESALE_DISCOUNT_RATE = 10

  // Función para verificar disponibilidad de stock
  const checkAvailability = useCallback((productId: string, quantity: number) => {
    const product = inventoryProducts.find(p => p.id === productId)
    return product ? product.stock_quantity >= quantity : false
  }, [inventoryProducts])

  // Smart search integration (after inventoryProducts is available)
  // NOTA: useSmartSearch y todo el estado de búsqueda/filtros/paginación
  // están ahora encapsulados en usePOSSearch.
  const posSearch = usePOSSearch({ products: inventoryProducts as Product[] })
  const {
    searchTerm, setSearchTerm, handleSearchChange, handleSearchKeyDown,
    debouncedSearchTerm,
    showSuggestions, setShowSuggestions, searchSuggestions,
    selectedSuggestionIndex, setSelectedSuggestionIndex, selectSuggestion, recentSearches,
    selectedCategory, setSelectedCategory,
    showFeatured, setShowFeatured,
    sortBy, setSortBy, sortOrder, setSortOrder,
    priceRange, setPriceRange,
    stockFilter, setStockFilter,
    creditOnly, setCreditOnly,
    minimumInstallments, setMinimumInstallments,
    creditSort, setCreditSort,
    activeFiltersCount, handleResetFilters,
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages,
    categories, priceRangeLimits, financedProductsCount,
    filteredProducts, paginatedProducts,
    viewportWidth, viewportHeight, virtualizationThreshold,
    smartSearchResults, isSmartSearching,
  } = posSearch

  // Mantener compatibilidad con el inventoryManager existente
  const inventoryManager = useMemo(() => ({
    getProducts: () => inventoryProducts,
    subscribe: (_callback: (products: any[]) => void) => () => {},
    importData: (_data: { products: any[] }) => {
      console.log('Modo Supabase: importData no necesario')
    },
  }), [inventoryProducts])

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
      
      // Usar hook optimizado
      addToCartHook(product)
      showAddToCartToast({ name: product.name })
    })
  }, [getProductWithVariants, measureCartOperation, addToCartHook])

  // Función para agregar variante al carrito
  const addVariantToCart = useCallback((variant: ProductVariant, quantity: number) => {
    const cartItemWithVariant = convertVariantToCartItem(variant, quantity)

    if (!cartItemWithVariant) {
      toast.error('Error al procesar la variante')
      return
    }
    
    addVariantToCartHook(cartItemWithVariant)
    showAddToCartToast({
      name: cartItemWithVariant.product_name || variant.name,
      quantity
    })
    
  }, [convertVariantToCartItem, addVariantToCartHook])

  // updateQuantity is now provided by useOptimizedCart

  // Utilidad común para redondear a 2 decimales
  const roundToTwo = useCallback((num: number) => Math.round((num + Number.EPSILON) * 100) / 100, [])

  // Unified Cart + Repairs Calculations
  // Los totales de reparaciones los provee usePOSRepairs; aquí solo combinamos.
  const unifiedCalculations = useMemo(() => {
    const { total: repairTotal, subtotal: repairSubtotal, tax: repairTax } = repairTotals

    // Combine with Product Cart (from useOptimizedCart hook)
    const finalTotal = roundToTwo(cartTotal + repairTotal)
    const finalTax = roundToTwo(cartTax + repairTax)
    const finalSubtotalApplied = roundToTwo(subtotalApplied + repairSubtotal)
    const finalSubtotalNonWholesale = roundToTwo(subtotalNonWholesale + repairSubtotal)

    const totalItemCount = cartItemCount + selectedRepairIds.length

    return {
      total: finalTotal,
      tax: finalTax,
      subtotal: finalSubtotalApplied,
      subtotalApplied: finalSubtotalApplied,
      subtotalNonWholesale: finalSubtotalNonWholesale,
      repairCost: repairTotal,
      repairSubtotal,
      repairTax,
      generalDiscountAmount,
      wholesaleDiscountAmount,
      totalSavings,
      totalItemCount,
      hasDiscount: totalSavings > 0,
      isValidPayment: paymentMethod === 'cash' ? cashReceived >= finalTotal : true,
      totalDiscount: totalSavings,
      averageItemPrice: totalItemCount > 0 ? subtotalApplied / totalItemCount : 0
    }
  }, [
    repairTotals,
    cartTotal,
    cartTax,
    subtotalApplied,
    subtotalNonWholesale,
    cartItemCount,
    selectedRepairIds.length,
    generalDiscountAmount,
    wholesaleDiscountAmount,
    totalSavings,
    paymentMethod,
    cashReceived,
    roundToTwo,
  ])

  const getTotalPaid = useCallback(() => {
    return paymentSplit.reduce((total, split) => total + split.amount, 0)
  }, [paymentSplit])

  // Adapter for backward compatibility and unified usage
  const cartCalculations = useMemo(() => ({
    subtotal: unifiedCalculations.subtotalNonWholesale,
    subtotalAfterAllDiscounts: unifiedCalculations.subtotalApplied,
    generalDiscount: generalDiscount,
    wholesaleDiscount: unifiedCalculations.wholesaleDiscountAmount,
    wholesaleDiscountRate: WHOLESALE_DISCOUNT_RATE,
    tax: unifiedCalculations.tax,
    total: unifiedCalculations.total,
    change: cashReceived - unifiedCalculations.total,
    remaining: roundToTwo(unifiedCalculations.total - getTotalPaid()),
    discount: unifiedCalculations.totalSavings,
    totalDiscount: unifiedCalculations.totalSavings,
    hasDiscount: unifiedCalculations.totalSavings > 0,
    totalSavings: unifiedCalculations.totalSavings,
    averageItemPrice: (unifiedCalculations as any).averageItemPrice,
    repairCost: unifiedCalculations.repairCost,
    repairSubtotal: unifiedCalculations.repairSubtotal,
    repairTax: unifiedCalculations.repairTax,
    totalItemCount: unifiedCalculations.totalItemCount
  }), [unifiedCalculations, generalDiscount, cashReceived, getTotalPaid])

  // Aplicación automática de descuento VIP después de cálculos del carrito
  useEffect(() => {
    try {
      const activeCustomer = customers.find(c => c.id === selectedCustomer)
      const isVip = activeCustomer && (
        String(activeCustomer.type || '').toLowerCase() === 'vip' ||
        String((activeCustomer as any).priority || '').toLowerCase() === 'vip'
      )

      if (isVip && generalDiscount === 0 && unifiedCalculations.subtotal > 0 && !vipAutoApplied) {
        setGeneralDiscount(VIP_DISCOUNT_RATE)
        setVipAutoApplied(true)
        toast.success(`Descuento VIP aplicado (${VIP_DISCOUNT_RATE}%)`)
      }

      if (!isVip && vipAutoApplied) {
        setGeneralDiscount(0)
        setVipAutoApplied(false)
        toast.info('Descuento VIP removido por cambio de cliente')
      }
    } catch {}
  }, [customers, selectedCustomer, unifiedCalculations.subtotal, generalDiscount, vipAutoApplied])

  // Adapter for POSCart items
  //
  // Precio = costo bruto (final_cost / estimated_cost), no el saldo pendiente:
  // el RPC del servidor cobra el total bruto de la reparación sin restar lo
  // ya pagado (ver nota en unifiedCalculations más abajo). Mostrar acá un
  // saldo menor generaría un monto que el checkout rechaza por no calzar.
  const combinedCartItems = useMemo(() => {
    const repairItems: CartItem[] = selectedRepairs.map(repair => {
      // Saldo pendiente: idem unifiedCalculations, para que el precio mostrado
      // en el carrito coincida con lo que realmente se cobra.
      const balanceDue = getRepairBalanceDue(repair)
      const hasPriorPayment = (repair.paid_amount || 0) > 0
      return {
        id: repair.id,
        name: hasPriorPayment
          ? `Reparación (saldo): ${repair.device_model || 'Dispositivo'} (${repair.device_brand || ''})`
          : `Reparación: ${repair.device_model || 'Dispositivo'} (${repair.device_brand || ''})`,
        price: balanceDue,
        quantity: 1,
        isService: true,
        // Add required fields for CartItem type safety
        stock: 0,
        subtotal: balanceDue,
        category: 'service',
        // Prevent wholesale discount application in SaleSummary by setting wholesalePrice = price
        wholesalePrice: balanceDue,
        sku: 'SERVICE'
      }
    })

    const catalogById = new Map(inventoryProducts.map(product => [product.id, product]))
    const enrichedCart = cart.map(item => {
      const product = catalogById.get(item.id)
      return { ...item, categoryName: product?.category?.name || item.categoryName, brand: product?.brand || item.brand, image: item.image || product?.image || product?.image_url || product?.images?.[0] || undefined }
    })
    return [...enrichedCart, ...repairItems]
  }, [cart, selectedRepairs, inventoryProducts])
  const canCheckout = combinedCartItems.length > 0
  const checkoutProductCreditPlans = useMemo(() => getCartProductCreditPlans(
    combinedCartItems.map(item => {
      const retailUnitPrice = Number(item.price || 0)
      const wholesaleUnitPrice = item.isService
        ? retailUnitPrice
        : Number(item.wholesalePrice ?? (retailUnitPrice * (1 - (WHOLESALE_DISCOUNT_RATE / 100))))
      const unitPrice = isWholesale ? wholesaleUnitPrice : retailUnitPrice
      const itemDiscountRate = Math.min(100, Math.max(0, Number(item.discount || 0)))
      return {
        ...item,
        price: unitPrice * (1 - (itemDiscountRate / 100)),
      }
    }),
    inventoryProducts.map(product => ({
      id: product.id,
      name: product.name,
      price: product.sale_price,
      quantity: 1,
      installmentsEnabled: Boolean(product.installments_enabled),
      installmentsPlans: Array.isArray(product.installments_plans) ? product.installments_plans : [],
    })),
  ), [combinedCartItems, inventoryProducts, isWholesale])
  const checkoutDisabledReason = canCheckout ? undefined : 'Agrega productos o vincula una reparacion para cobrar.'

  // Unified Remove Handler
  const handleRemoveItem = useCallback((id: string) => {
    const rawRepairId = id.startsWith('repair_') ? id.replace('repair_', '') : id
    if (selectedRepairIds.includes(rawRepairId) || selectedRepairIds.includes(id)) {
      removeRepairById(id)
      toast.info('Reparación removida del cobro')
    }
    removeFromCart(id)
  }, [selectedRepairIds, removeFromCart, removeRepairById])

  // Hold / Park sale handler
  const handleParkCurrentSale = useCallback(() => {
    if (combinedCartItems.length === 0) {
      toast.error('El carrito está vacío')
      return
    }
    const currentCustName = customers.find(c => c.id === selectedCustomer)?.name || null
    const success = parkSale(
      combinedCartItems,
      isWholesale,
      generalDiscount,
      unifiedCalculations.total,
      currentCustName,
      selectedCustomer,
      selectedRepairIds
    )
    if (success) {
      clearCart(true)
      clearRepairs()
    }
  }, [combinedCartItems, isWholesale, generalDiscount, unifiedCalculations.total, customers, selectedCustomer, selectedRepairIds, parkSale, clearCart, clearRepairs])

  // Restore parked sale
  const handleRestoreHeldSale = useCallback((sale: HeldSale) => {
    clearCart(true)
    const saleItems = sale.cart || sale.items || []
    saleItems.forEach(item => {
      addToCartHook(item as any, item.quantity)
    })
    if (Array.isArray(sale.selectedRepairIds) && sale.selectedRepairIds.length > 0) {
      setSelectedRepairIds(sale.selectedRepairIds)
    }
    setIsWholesale(Boolean(sale.isWholesale))
    setGeneralDiscount(Number(sale.discount || 0))
    const saleCustId = sale.selectedCustomer || sale.customerId
    if (saleCustId) {
      setSelectedCustomer(saleCustId)
    }
    toast.success('Venta recuperada al carrito', {
      description: `${saleItems.length} producto${saleItems.length !== 1 ? 's' : ''} cargados.`
    })
  }, [clearCart, addToCartHook, setIsWholesale, setGeneralDiscount, setSelectedCustomer])

  // handleAddRepairToCart viene de usePOSRepairs (ver desestructuración arriba)

  // Global Keyboard Shortcuts (F2, F3, F4, F8, F9)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if (e.key === 'F2') {
        e.preventDefault()
        const searchInput = document.getElementById('search-input') as HTMLInputElement | null
        searchInput?.focus()
        searchInput?.select()
      } else if (e.key === 'F3') {
        e.preventDefault()
        setIsQuickCustomerOpen(true)
      } else if (e.key === 'F4') {
        e.preventDefault()
        if (canCheckout) {
          setIsCheckoutOpen(true)
        }
      } else if (e.key === 'F8') {
        e.preventDefault()
        if (combinedCartItems.length > 0) {
          handleParkCurrentSale()
        } else {
          setIsHeldSalesModalOpen(true)
        }
      } else if (e.key === 'F9') {
        e.preventDefault()
        handleWholesaleToggle(!isWholesale)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [canCheckout, combinedCartItems.length, handleParkCurrentSale, isWholesale, handleWholesaleToggle, setIsCheckoutOpen])

  const applyPromoCode = useCallback((code: string) => {
    const cartItems = combinedCartItems
      .map(item => ({
        id: item.id,
        product_id: item.id,
        variant_id: undefined,
        sku: item.sku || item.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        category_id: (item as any).category,
        total_price: item.price * item.quantity
      }))

    if (cartItems.length === 0) {
      toast.error('No hay items en el carrito para aplicar promoción')
      return false
    }

    // Use promotion engine to validate/apply code against DB promotions
    const result = applyPromotionByCode(code, cartItems as any, allPromotions)

    if (!result.applied) {
      toast.error(result.reason || 'Código promocional inválido')
      return false
    }

    // Aplicación por item: solo a productos elegibles
    const promotion = allPromotions.find(p => p.code.toLowerCase() === code.toLowerCase())
    if (!promotion) {
      toast.error('Promoción no encontrada en la base de datos')
      return false
    }

    const isEligible = (item: typeof cartItems[number]) => {
      const matchesProduct = !promotion.applicable_products?.length || promotion.applicable_products.includes(item.product_id)
      const matchesCategory = !promotion.applicable_categories?.length || (!!item.category_id && promotion.applicable_categories.includes(String(item.category_id)))
      return matchesProduct && matchesCategory
    }

    const eligibleItems = cartItems.filter(isEligible)
    if (eligibleItems.length === 0) {
      toast.error('No hay items elegibles para este código')
      return false
    }

    // Base de línea según modo mayorista
    const lineBase = (item: any) => {
      const unitNonWholesale = item.unit_price
      const existingItem = combinedCartItems.find(ci => ci.id === item.id)
      const isService = existingItem?.isService === true
      const unitWholesaleCandidate =
        existingItem?.wholesalePrice ?? (unitNonWholesale * (1 - (WHOLESALE_DISCOUNT_RATE / 100)))
      const unitApplied = isWholesale && !isService ? unitWholesaleCandidate : unitNonWholesale
      return unitApplied * item.quantity
    }

    const totalApplicable = eligibleItems.reduce((sum, it) => sum + lineBase(it), 0)

    setVipAutoApplied(false)

    if (promotion.type === 'percentage') {
      // Aplicar porcentaje directo a items elegibles
      eligibleItems.forEach(it => {
        const existingItem = combinedCartItems.find(ci => ci.id === it.id)
        const currentDiscount = (existingItem as any)?.discount || 0
        const newDiscount = Math.max(currentDiscount, promotion.value)
        updateItemDiscount(it.id, Math.min(100, Math.max(0, newDiscount)))
        updateItemPromoCode(it.id, code)
      })
      toast.success(`Código aplicado: ${promotion.value}% en items elegibles`)
    } else {
      // Distribuir monto fijo proporcionalmente
      if (totalApplicable <= 0) {
        toast.error('Subtotal aplicable inválido para distribuir descuento')
        return false
      }
      eligibleItems.forEach(it => {
        const line = lineBase(it)
        const share = (line / totalApplicable) * promotion.value
        const percentShare = line > 0 ? (share / line) * 100 : 0
        const existingItem = combinedCartItems.find(ci => ci.id === it.id)
        const currentDiscount = (existingItem as any)?.discount || 0
        const newDiscount = Math.min(100, Math.max(0, currentDiscount + percentShare))
        updateItemDiscount(it.id, newDiscount)
        updateItemPromoCode(it.id, code)
      })
      toast.success(`Código aplicado: ahorro ${formatCurrency(result.discount_amount)} distribuido en items elegibles`)
    }

    return true
  }, [combinedCartItems, allPromotions, isWholesale, updateItemDiscount])

  const calculateLoyaltyPoints = useCallback((total: number) => {
    // 1 punto por cada $10 gastados
    const basePoints = Math.floor(total / 10)

    // Bonificación por monto alto
    const bonusMultiplier = total >= 500 ? 2 : total >= 200 ? 1.5 : 1

    return Math.floor(basePoints * bonusMultiplier)
  }, [])

  // ── Wrappers de procesamiento de venta (delegan a usePOSSaleProcessor) ──────
  //
  // Construyen el objeto deps con el estado actual del componente y llaman al
  // hook. Así page.tsx no contiene la lógica de pago, solo el ensamblado.

  /** Deps comunes a ambos procesadores */
  const buildSaleDeps = useCallback(() => ({
    isRegisterOpen: getCurrentRegister.isOpen,
    currentSessionId,
    combinedCartItems,
    cartCalculations,
    isWholesale,
    generalDiscount,
    paymentMethod,
    cashReceived,
    cardNumber,
    transferReference,
    electronicProvider,
    electronicInstitution,
    electronicChannel,
    terminalId,
    notes,
    creditTerms,
    paymentSplit,
    storeCreditApplied,
    selectedRepairIds,
    markRepairDelivered,
    deliveryOutcome,
    selectedCustomer,
    customers,
    cashierName,
    setPaymentStatus,
    setPaymentError,
    processInventorySale,
    onSuccess: (receipt: any) => {
      setLastSaleData(receipt)
      setCurrentReceipt(receipt)
      setShowReceiptModal(true)
      if (markRepairDelivered && selectedRepairIds.length > 0) {
        setCustomerRepairs(prev =>
          prev.map(r =>
            selectedRepairIds.includes(r.id)
              ? { ...r, status: 'entregado', delivered_at: new Date().toISOString() }
              : r
          )
        )
      }
    },
    onAfterSale: () => {
      clearCart(true)
      setSelectedCustomer('')
      clearRepairs()
      setGeneralDiscount(0)
      resetCheckoutState()
      setIsCheckoutOpen(false)
    },
    formatCurrency,
    measureSaleProcessing,
  }), [
    getCurrentRegister.isOpen, currentSessionId, combinedCartItems, cartCalculations,
    isWholesale, generalDiscount, paymentMethod, cashReceived, cardNumber, transferReference,
    electronicProvider, electronicInstitution, electronicChannel, terminalId, notes,
    creditTerms, paymentSplit, storeCreditApplied, selectedRepairIds, markRepairDelivered,
    deliveryOutcome, selectedCustomer, customers, cashierName,
    setPaymentStatus, setPaymentError, processInventorySale,
    clearCart, setSelectedCustomer, clearRepairs, setGeneralDiscount, resetCheckoutState,
    setIsCheckoutOpen, formatCurrency, measureSaleProcessing,
    setCustomerRepairs,
  ])

  const processSale = useCallback(
    () => processSaleBase(buildSaleDeps()),
    [processSaleBase, buildSaleDeps]
  )

  const processMixedPayment = useCallback(
    () => processMixedPaymentBase(buildSaleDeps()),
    [processMixedPaymentBase, buildSaleDeps]
  )


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
            break
          case 'Enter':
            e.preventDefault()
            if (combinedCartItems.length > 0) {
              setIsCheckoutOpen(true)
            } else {
              toast.error('Carrito vacío y sin reparaciones')
            }
            break
          case 'Backspace':
            e.preventDefault()
            if (cart.length > 0) {
              clearCart()
              toast.success('Carrito vaciado correctamente')
            }
            break
          case 'n':
            e.preventDefault()
            clearCart()
            setSelectedCustomer('')
            toast.success('Nueva venta iniciada')
            break
          case 'p':
            e.preventDefault()
            if (combinedCartItems.length > 0) {
              setIsCheckoutOpen(true)
            }
            break
          case 'g':
            e.preventDefault()
            setViewMode(viewMode === 'grid' ? 'list' : 'grid')
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
            break
          case 'F3':
            e.preventDefault()
            setShowAccessibilitySettings(true)
            break
          case 'F5':
            e.preventDefault()
            setShowFeatured(!showFeatured)
            break
          case 'F4':
            e.preventDefault()
            setIsFullscreen(!isFullscreen)
            break
          case 'Escape':
            e.preventDefault()
            if (isCheckoutOpen) {
              setIsCheckoutOpen(false)
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
      } else {
        toast.error('Producto no encontrado')
        setBarcodeInput('')
      }
    }
  }, [barcodeInput, addToCart, inventoryProducts])

  const holdCurrentSale = handleParkCurrentSale

  const resumeHeldSale = useCallback((heldId: string) => {
    const held = heldSales.find(h => h.id === heldId)
    if (!held) return
    handleRestoreHeldSale(held)
  }, [heldSales, handleRestoreHeldSale])

  const createQuickItem = useCallback(async () => {
    setQuickItemError('')
    setQuickItemSaving(true)
    try {
      const payload = buildQuickItemPayload({
        name: quickItemName,
        price: quickItemPrice,
        quantity: quickItemQty,
        sku: quickItemSku,
        publishToCatalog: quickItemPublishToCatalog,
        // Solo se manda el costo si el usuario puede verlo: para el resto el
        // campo no existe y el item se crea sin costo, como antes.
        purchasePrice: canViewCost ? quickItemPurchasePrice : '',
        wholesalePrice: quickItemWholesalePrice,
      })
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...branchHeaders(selectedBranchId),
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null) as {
        success?: boolean
        data?: Product
        error?: string
        details?: Array<{ field?: string; message?: string }>
      } | null

      if (!response.ok || !result?.success || !result.data) {
        throw new Error(getQuickItemApiError(result))
      }

      const quickProduct = result.data
      syncProduct(quickProduct)
      addToCartHook(quickProduct, payload.stock_quantity)
      showAddToCartToast({ name: quickProduct.name, quantity: payload.stock_quantity })

      setQuickItemName('')
      setQuickItemPrice('')
      setQuickItemPurchasePrice('')
      setQuickItemWholesalePrice('')
      setQuickItemQty('1')
      setQuickItemSku('')
      setQuickItemPublishToCatalog(false)
      setIsQuickItemDialogOpen(false)
      toast.success('Item rapido creado y sincronizado')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'No se pudo crear el item rapido.'
      setQuickItemError(message)
      toast.error(message)
    } finally {
      setQuickItemSaving(false)
    }
  }, [quickItemName, quickItemPrice, quickItemPurchasePrice, quickItemWholesalePrice, quickItemQty, quickItemSku, quickItemPublishToCatalog, canViewCost, selectedBranchId, syncProduct, addToCartHook])

  return (
    <div className={`pos-theme pos-shell h-dvh max-h-dvh overflow-hidden flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Contenido principal */}
        <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${sidebarCollapsed ? 'lg:ml-0' : 'lg:ml-0'}`}>
          {/* Header desktop optimizado */}
  <POSHeader
    className="hidden lg:flex items-center justify-between bg-card/70 backdrop-blur-md border-b border-border/60 px-4 py-1.5 sticky top-0 z-20 shadow-xs"
    registers={registers}
    activeRegisterId={activeRegisterId}
    onRegisterChange={handleRegisterChange}
    onOpenRegisterManager={() => canManageRegisters && setIsRegisterManagerOpen(true)}
    onOpenMovements={() => {
      setMovementType('out')
      setMovementAmount('')
      setMovementNote('')
      setIsMovementDialogOpen(true)
    }}
    onOpenRegister={() => setIsOpenRegisterDialogOpen(true)}
    isRegisterOpen={Boolean(registerState[activeRegisterId]?.isOpen)}
    canManageRegisters={canManageRegisters}
    isFullscreen={isFullscreen}
    onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
    onOpenCart={() => setShowCartDialog(true)}
    cartItemCount={cartItemCount}
  >
            {/* Branding */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/20">
                <ShoppingCart className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold leading-none tracking-tight text-foreground">Punto de Venta</h1>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[9px] font-semibold ${
                    registerState[activeRegisterId]?.isOpen
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${registerState[activeRegisterId]?.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    {registerState[activeRegisterId]?.isOpen ? 'Caja abierta' : 'Caja cerrada'}
                  </span>
                  <div className="h-2.5 w-px bg-border/40" />
                  <SupabaseStatus mode="minimal" />
                </div>
              </div>
            </div>
          </POSHeader>



          {/* Header móvil con acción principal del carrito */}
  <POSHeader
    className="flex lg:hidden items-center justify-between bg-card border-b border-border px-4 py-2 sticky top-0 z-20"
    registers={registers}
    activeRegisterId={activeRegisterId}
    onRegisterChange={handleRegisterChange}
    onOpenRegisterManager={() => canManageRegisters && setIsRegisterManagerOpen(true)}
    onOpenMovements={() => {
      setMovementType('out')
      setMovementAmount('')
      setMovementNote('')
      setIsMovementDialogOpen(true)
    }}
    onOpenRegister={() => setIsOpenRegisterDialogOpen(true)}
    isRegisterOpen={Boolean(registerState[activeRegisterId]?.isOpen)}
    canManageRegisters={canManageRegisters}
    isFullscreen={isFullscreen}
    onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
    onOpenCart={() => setShowCartDialog(true)}
    cartItemCount={cartItemCount}
    mobileCompact
  >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
                <ShoppingCart className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold">POS</span>
                <span className={`h-1.5 w-1.5 rounded-full ${registerState[activeRegisterId]?.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              </div>
            </div>
          </POSHeader>

    {/* Cart Overview Dialog */}
  <Dialog open={showCartDialog} onOpenChange={setShowCartDialog}>
    <DialogContent className="max-w-2xl p-0 overflow-hidden">
      <DialogHeader className="px-5 py-4 border-b bg-muted/30">
        <DialogTitle className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          Productos en el carrito
        </DialogTitle>
        <DialogDescription>
          Revisa cantidades y montos antes de finalizar la venta.
        </DialogDescription>
      </DialogHeader>

      <div className="px-5 py-3 border-b bg-background/80">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Items</p>
            <p className="font-semibold">{combinedCartItems.length}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-right">
            <p className="text-[11px] text-muted-foreground">Total</p>
            <p className="font-semibold text-primary">{formatCurrency(cartCalculations.total)}</p>
          </div>
        </div>
      </div>

      <div className="max-h-[52vh] overflow-y-auto">
        {combinedCartItems.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium">Carrito vacío</p>
            <p className="text-xs text-muted-foreground">Agrega productos para continuar</p>
          </div>
        ) : (
          <div className="divide-y">
            {combinedCartItems.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-muted/20 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.isService && (
                      <Badge variant="secondary" className="h-5 text-[10px]">Servicio</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.quantity} x {formatCurrency(item.price)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatCurrency((item.price ?? 0) * (item.quantity ?? 1))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DialogFooter className="px-5 py-4 border-t bg-background/95">
        <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Total a cobrar: </span>
            <span className="font-bold text-base text-primary">{formatCurrency(cartCalculations.total)}</span>
          </div>
          <div className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setShowCartDialog(false)}>Cerrar</Button>
            <Button className="pos-button-primary pos-button-confirm-sale" onClick={() => { setShowCartDialog(false); setIsCheckoutOpen(true) }}>
              Cobrar
            </Button>
          </div>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>



          {/* Barra de búsqueda y filtros */}
          <div className="border-b border-border/70 bg-card/90 px-3 py-1.5 backdrop-blur-md lg:px-4">
            <div className="pos-panel flex flex-col gap-1.5 rounded-lg p-1 lg:flex-row lg:items-center bg-muted/20 border border-border/50">
              {/* Búsqueda con autocompletado */}
              <div className="flex-1 relative" id="search-container">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-primary/70 h-3.5 w-3.5 pointer-events-none" />
                  <Input
                    id="search-input"
                    placeholder="Buscar por nombre, código de barras, SKU o marca..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="h-8 pl-8 pr-12 text-xs rounded-md bg-background/80 border-border/70 focus-visible:ring-primary/40 focus-visible:border-primary shadow-xs transition-all placeholder:text-muted-foreground/60"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => handleSearchChange('')}
                        className="p-0.5 text-muted-foreground hover:text-foreground rounded-full"
                        title="Limpiar búsqueda"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <kbd className="hidden sm:inline-flex items-center text-[9px] font-mono font-medium text-muted-foreground bg-muted/80 px-1.5 py-0.2 rounded border border-border/50 select-none">
                      F2
                    </kbd>
                  </div>
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

              <div className="lg:hidden flex items-center justify-end gap-2">
                <Button
                  variant={creditOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCreditOnly(!creditOnly)}
                  aria-pressed={creditOnly}
                  className="h-7.5 px-2.5 text-xs"
                >
                  <CreditCard className="mr-1 h-3.5 w-3.5" />
                  Con cuotas
                  <span className="ml-1 text-[10px] opacity-75">({financedProductsCount})</span>
                </Button>
                <Button
                  variant={isMobileFiltersOpen ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsMobileFiltersOpen((v) => !v)}
                  className="h-7.5 text-xs"
                >
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-background/30 px-1 py-0.2 text-[9px] font-semibold">
                      {activeFiltersCount}
                    </span>
                  )}
                  {isMobileFiltersOpen ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
                </Button>
              </div>

              {/* Filtros rápidos y botón Más */}
              <div className={`flex flex-wrap items-center gap-1.5 ${isMobileFiltersOpen ? '' : 'hidden lg:flex'}`}>
                {/* Selector de Categoría */}
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-8 w-full sm:w-40 lg:w-36 text-xs">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category} className="text-xs">
                        {category === 'all' ? 'Todas las categorías' : category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Botón Destacados */}
                <Button
                  variant={showFeatured ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFeatured(!showFeatured)}
                  className={`h-8 text-xs transition-all px-2.5 ${showFeatured ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs' : ''}`}
                >
                  <Star className={`h-3 w-3 mr-1 ${showFeatured ? 'fill-white' : 'text-amber-500'}`} />
                  Destacados
                </Button>

                <Button
                  variant={creditOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCreditOnly(!creditOnly)}
                  aria-pressed={creditOnly}
                  className="hidden h-8 px-2.5 text-xs lg:inline-flex"
                >
                  <CreditCard className="mr-1 h-3.5 w-3.5" />
                  Con cuotas
                  <span className="ml-1 text-[10px] opacity-75">({financedProductsCount})</span>
                </Button>

                {/* Botón Filtros Avanzados con Contador */}
                <Button
                  variant={showAdvancedFilters || activeFiltersCount > 0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="h-8 text-xs relative px-2.5"
                >
                  <SlidersHorizontal className="h-3 w-3 mr-1" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge className="ml-1 h-3.5 min-w-[14px] px-1 text-[9px] bg-white text-primary dark:bg-black dark:text-white font-bold rounded-full">
                      {activeFiltersCount}
                    </Badge>
                  )}
                  {showAdvancedFilters ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>

                {/* Menú "Más" Potenciado */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs font-medium gap-1 hover:bg-muted px-2.5">
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                      Más
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 max-h-[75vh] sm:max-h-[80vh] overflow-y-auto p-2 shadow-xl border-border/80">
                    {/* Sección Acciones Rápidas */}
                    <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Acciones Rápidas
                    </div>
                    <DropdownMenuItem 
                      onClick={() => setIsQuickItemDialogOpen(true)}
                      className="gap-2.5 cursor-pointer py-2 text-xs"
                    >
                      <Plus className="h-4 w-4 text-emerald-500" />
                      <div className="flex flex-col">
                        <span className="font-medium">Crear Ítem Rápido</span>
                        <span className="text-[10px] text-muted-foreground">Producto temporal al vuelo</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setIsQuickCustomerOpen(true)}
                      className="gap-2.5 cursor-pointer py-2 text-xs"
                    >
                      <UserPlus className="h-4 w-4 text-blue-500" />
                      <div className="flex flex-col flex-1">
                        <span className="font-medium">Nuevo Cliente Express</span>
                        <span className="text-[10px] text-muted-foreground">Alta en 10s (Nombre y CI)</span>
                      </div>
                      <kbd className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">F3</kbd>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setIsRepairModalOpen(true)}
                      className="gap-2.5 cursor-pointer py-2 text-xs"
                    >
                      <Wrench className="h-4 w-4 text-amber-500" />
                      <div className="flex flex-col">
                        <span className="font-medium">Cobrar Reparación / Taller</span>
                        <span className="text-[10px] text-muted-foreground">Importar saldo de ticket técnico</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setIsMovementDialogOpen(true)}
                      className="gap-2.5 cursor-pointer py-2 text-xs"
                    >
                      <DollarSign className="h-4 w-4 text-purple-500" />
                      <div className="flex flex-col">
                        <span className="font-medium">Movimiento de Caja</span>
                        <span className="text-[10px] text-muted-foreground">Registrar ingreso o egreso manual</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="gap-2.5 cursor-pointer py-2 text-xs">
                      <Link href="/dashboard/pos/caja">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <div className="flex flex-col">
                          <span className="font-medium text-blue-600 dark:text-blue-400">Detalles de Caja</span>
                          <span className="text-[10px] text-muted-foreground">Arqueo, cortes y estado del turno</span>
                        </div>
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="my-1" />

                    {/* Sección Ventas en Espera */}
                    <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Ventas en Espera
                    </div>
                    <DropdownMenuItem 
                      onClick={handleParkCurrentSale}
                      disabled={combinedCartItems.length === 0}
                      className="gap-2.5 cursor-pointer py-2 text-xs"
                    >
                      <Clock className="h-4 w-4 text-amber-500" />
                      <div className="flex flex-col flex-1">
                        <span className="font-medium">Pausar Venta Actual</span>
                        <span className="text-[10px] text-muted-foreground">Guardar carrito y continuar</span>
                      </div>
                      <kbd className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">F8</kbd>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setIsHeldSalesModalOpen(true)}
                      className="gap-2.5 cursor-pointer py-2 text-xs"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium flex items-center gap-2">
                          <span>📂</span> Ver Ventas Pausadas
                        </span>
                        {heldSalesCount > 0 && (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] h-4 px-1.5">
                            {heldSalesCount}
                          </Badge>
                        )}
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="my-1" />

                    {/* Sección Vistas y Ayuda */}
                    <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Herramientas & Vista
                    </div>
                    <DropdownMenuItem 
                      onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                      className="gap-2.5 cursor-pointer py-2 text-xs"
                    >
                      {viewMode === 'grid' ? <List className="h-4 w-4 text-muted-foreground" /> : <Grid className="h-4 w-4 text-muted-foreground" />}
                      <span>Cambiar a vista <strong>{viewMode === 'grid' ? 'Lista' : 'Grilla'}</strong></span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowKeyboardShortcuts(true)}
                      className="gap-2.5 cursor-pointer py-2 text-xs"
                    >
                      <Keyboard className="h-4 w-4 text-muted-foreground" />
                      <span>Atajos de Teclado (F2-F9)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleShowPosGuide}
                      className="gap-2.5 cursor-pointer py-2 text-xs"
                    >
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span>Guía de Uso del POS</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Chips de Filtros Activos */}
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-2 px-1 text-xs">
                <span className="text-muted-foreground text-[11px] font-medium mr-1 flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Filtros activos:
                </span>
                {selectedCategory !== 'all' && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs bg-primary/10 text-primary border-primary/20">
                    Cat: {selectedCategory}
                    <button 
                      onClick={() => setSelectedCategory('all')} 
                      className="hover:bg-primary/20 rounded-full p-0.5"
                      title="Quitar categoría"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {showFeatured && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                    ★ Destacados
                    <button 
                      onClick={() => setShowFeatured(false)} 
                      className="hover:bg-amber-500/20 rounded-full p-0.5"
                      title="Quitar filtro destacados"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {creditOnly && (
                  <Badge variant="secondary" className="gap-1 border-sky-500/20 bg-sky-500/10 py-0.5 pl-2 pr-1 text-xs text-sky-700 dark:text-sky-300">
                    Con cuotas
                    <button
                      type="button"
                      onClick={() => setCreditOnly(false)}
                      className="rounded-full p-0.5 hover:bg-sky-500/20"
                      aria-label="Quitar filtro de productos con cuotas"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {minimumInstallments > 1 && (
                  <Badge variant="secondary" className="gap-1 border-sky-500/20 bg-sky-500/10 py-0.5 pl-2 pr-1 text-xs text-sky-700 dark:text-sky-300">
                    Desde {minimumInstallments} cuotas
                    <button
                      type="button"
                      onClick={() => setMinimumInstallments(1)}
                      className="rounded-full p-0.5 hover:bg-sky-500/20"
                      aria-label="Quitar mínimo de cuotas"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {creditSort && (
                  <Badge variant="secondary" className="gap-1 border-sky-500/20 bg-sky-500/10 py-0.5 pl-2 pr-1 text-xs text-sky-700 dark:text-sky-300">
                    Crédito: {creditSort === 'installment_low' ? 'menor cuota' : creditSort === 'rate_low' ? 'menor tasa' : creditSort === 'installments_high' ? 'más cuotas' : 'menor total'}
                    <button
                      type="button"
                      onClick={() => setCreditSort(null)}
                      className="rounded-full p-0.5 hover:bg-sky-500/20"
                      aria-label="Quitar orden financiero"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {stockFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                    Stock: {stockFilter === 'in_stock' ? 'En stock' : stockFilter === 'low_stock' ? 'Stock bajo' : 'Sin stock'}
                    <button 
                      onClick={() => setStockFilter('all')} 
                      className="hover:bg-blue-500/20 rounded-full p-0.5"
                      title="Quitar filtro stock"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {(sortBy !== 'name' || sortOrder !== 'asc') && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                    Orden: {sortBy === 'price' ? (sortOrder === 'asc' ? 'Menor Precio' : 'Mayor Precio') : sortBy === 'stock' ? 'Stock' : 'Z-A'}
                    <button 
                      onClick={() => { setSortBy('name'); setSortOrder('asc'); }} 
                      className="hover:bg-purple-500/20 rounded-full p-0.5"
                      title="Restablecer orden"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {(priceRange.min > 0 || (priceRange.max < Number.POSITIVE_INFINITY && priceRange.max > 0)) && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    Precio: {priceRange.min > 0 ? `>${formatCurrency(priceRange.min)}` : ''} {priceRange.max < Number.POSITIVE_INFINITY ? `<${formatCurrency(priceRange.max)}` : ''}
                    <button 
                      onClick={() => setPriceRange({ min: 0, max: Number.POSITIVE_INFINITY })} 
                      className="hover:bg-emerald-500/20 rounded-full p-0.5"
                      title="Quitar rango de precio"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Limpiar todo
                </Button>
              </div>
            )}

            {/* Panel de Filtros Avanzados */}
            {showAdvancedFilters && (
              <Card className="mt-2.5 border-border/70 shadow-sm bg-card/95 backdrop-blur animate-in slide-in-from-top-2 duration-200">
                <CardContent className="p-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
                    {/* Disponibilidad de Stock */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-primary" /> Disponibilidad de Stock
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-muted/40 p-1 rounded-lg border border-border/40">
                        <button
                          type="button"
                          onClick={() => setStockFilter('all')}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${stockFilter === 'all' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockFilter('in_stock')}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${stockFilter === 'in_stock' ? 'bg-background shadow-xs text-emerald-600 font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          En Stock
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockFilter('low_stock')}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${stockFilter === 'low_stock' ? 'bg-background shadow-xs text-amber-600 font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          Stock Bajo
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockFilter('out_of_stock')}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${stockFilter === 'out_of_stock' ? 'bg-background shadow-xs text-rose-600 font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          Agotados
                        </button>
                      </div>
                    </div>

                    {/* Ordenar Productos */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Ordenar Por
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-muted/40 p-1 rounded-lg border border-border/40">
                        <button
                          type="button"
                          onClick={() => { setSortBy('name'); setSortOrder('asc'); }}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${sortBy === 'name' && sortOrder === 'asc' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          Nombre A-Z
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSortBy('name'); setSortOrder('desc'); }}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${sortBy === 'name' && sortOrder === 'desc' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          Nombre Z-A
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSortBy('price'); setSortOrder('asc'); }}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${sortBy === 'price' && sortOrder === 'asc' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          Menor Precio
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSortBy('price'); setSortOrder('desc'); }}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${sortBy === 'price' && sortOrder === 'desc' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          Mayor Precio
                        </button>
                      </div>
                    </div>

                    {/* Rango de Precio */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-primary" /> Rango de Precio
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Mín"
                          value={priceRange.min > 0 ? priceRange.min : ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setPriceRange({ ...priceRange, min: val })
                          }}
                          className="h-8 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">-</span>
                        <Input
                          type="number"
                          placeholder="Máx"
                          value={priceRange.max < Number.POSITIVE_INFINITY && priceRange.max > 0 ? priceRange.max : ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || Number.POSITIVE_INFINITY
                            setPriceRange({ ...priceRange, max: val })
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* Condiciones de financiación */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <CreditCard className="h-3.5 w-3.5 text-primary" /> Financiación
                      </label>
                      <div className="grid gap-2">
                        <Select
                          value={String(minimumInstallments)}
                          onValueChange={(value) => setMinimumInstallments(Number(value))}
                        >
                          <SelectTrigger className="h-8 text-xs" aria-label="Cantidad mínima de cuotas">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Cualquier cantidad</SelectItem>
                            {[3, 6, 12, 18, 24, 36, 48, 60].map(count => (
                              <SelectItem key={count} value={String(count)}>Desde {count} cuotas</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={creditSort ?? 'none'}
                          onValueChange={(value) => setCreditSort(value === 'none' ? null : value as ProductCreditSort)}
                        >
                          <SelectTrigger className="h-8 text-xs" aria-label="Ordenar por condiciones de financiación">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin orden financiero</SelectItem>
                            <SelectItem value="installment_low">Menor cuota</SelectItem>
                            <SelectItem value="rate_low">Menor tasa</SelectItem>
                            <SelectItem value="installments_high">Más cuotas</SelectItem>
                            <SelectItem value="financed_total_low">Menor total financiado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Acciones de Filtro */}
                    <div className="space-y-1.5 flex flex-col justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="h-8 text-xs gap-1.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restablecer Filtros
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Contenido principal con productos y carrito */}
          <div className="flex-1 min-h-0 flex overflow-hidden bg-muted/5">
            {/* Lista de productos */}
            <div className="flex-1 min-h-0 p-2.5 sm:p-3 md:p-4 overflow-y-auto pb-24 md:pb-4" role="main" aria-label="Lista de productos">
              <div className="mb-2.5 space-y-2.5">
                <div className="pos-panel flex items-center justify-between px-3 py-1.5 rounded-lg">
                  <h2 className="pos-heading text-base md:text-lg font-semibold text-foreground flex items-center gap-2" id="products-heading">
                    <Package className="h-4 w-4 text-primary" />
                    Productos <span className="text-muted-foreground font-normal text-xs">({filteredProducts.length})</span>
                  </h2>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-full border border-border/50">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Mayorista (F9)</span>
                      <Switch
                        checked={isWholesale}
                        onCheckedChange={handleWholesaleToggle}
                        aria-label="Ver precio mayorista"
                        className="scale-75 origin-right"
                      />
                    </div>
                  </div>
                </div>

                {/* Escáner de códigos de barras */}
                {getFeatureFlag('enableBarcodeScanner') && (
                  <POSBarcodeScanner
                    onProductFound={async (barcode) => {
                      const normalized = normalizeBarcode(barcode)
                      const localProduct = inventoryProducts.find(
                        (p) => p.barcode === barcode || p.barcode === normalized
                      )
                      if (localProduct) {
                        addToCart(localProduct)
                        return
                      }
                      const remoteProduct = await findProductByBarcode(normalized)
                      if (remoteProduct) {
                        addToCart(remoteProduct)
                      } else {
                        toast.error('Producto no encontrado')
                      }
                    }}
                    className="w-full shadow-sm"
                  />
                )}
              </div>

              {/* Estados de carga y error */}
              {productsLoading && (
                <div className="pos-state-card text-center py-16 rounded-xl border border-dashed shadow-sm">
                  <div className="pos-state-icon p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
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
                <div className="pos-state-card text-center py-16 rounded-xl border border-dashed shadow-sm">
                  <div className="pos-state-icon p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
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

              {!productsLoading && !productsError && inventoryProducts.length > 0 && filteredProducts.length > virtualizationThreshold ? (
                <div className="pos-panel rounded-xl overflow-hidden">
                  <VirtualizedProductGrid
                    products={filteredProducts}
                    viewMode={viewMode}
                    height={viewportHeight - 200}
                    onAddToCart={addToCart}
                    getCartQuantity={(id: string) => cart.find(item => item.id === id)?.quantity || 0}
                    inventoryManager={inventoryManager}
                    isWholesale={isWholesale}
                    wholesaleDiscountRate={WHOLESALE_DISCOUNT_RATE}
                    showStock={true}
                    showBarcode={true}
                    onViewDetail={(p, tab) => {
                      setDetailProduct(p)
                      setDetailDialogScrollToCredit(tab === 'precios')
                      setIsDetailDialogOpen(true)
                    }}
                  />
                </div>
              ) : !productsLoading && !productsError && inventoryProducts.length > 0 ? (
                <div
                  className={`grid gap-2 sm:gap-2.5 ${viewMode === 'grid'
                      ? 'product-grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
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
                      onViewDetail={(p, tab) => {
                        setDetailProduct(p)
                        setDetailDialogScrollToCredit(tab === 'precios')
                        setIsDetailDialogOpen(true)
                      }}
                    />
                  ))}
                </div>
              ) : null}

              {!productsLoading && !productsError && inventoryProducts.length > 0 && filteredProducts.length === 0 && (
                <div className="pos-state-card text-center py-16 rounded-xl border border-dashed shadow-sm">
                  <div className="pos-state-icon p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">No se encontraron productos</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">Intenta ajustar los términos de búsqueda o los filtros seleccionados</p>
                </div>
              )}

              {/* Controles de paginación */}
              {!productsLoading && !productsError && filteredProducts.length > 0 && filteredProducts.length <= virtualizationThreshold && (
                <div className="pos-panel flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 py-2 px-3 rounded-lg">
                  <div className="flex items-center gap-2 order-2 sm:order-1">
                    <span className="text-xs text-muted-foreground">Mostrar:</span>
                    <Select
                      value={String(itemsPerPage)}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value))
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="h-7 w-[72px] text-xs">
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
                    <div className="flex items-center gap-1.5 order-1 sm:order-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="h-7 px-2 text-xs shadow-xs"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                        Anterior
                      </Button>
                      <span className="text-xs font-medium bg-muted/30 px-2 py-0.5 rounded border shadow-xs min-w-[60px] text-center">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="h-7 px-2 text-xs shadow-xs"
                      >
                        Siguiente
                        <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Carrito lateral mejorado - responsive */}
            <div className="hidden md:flex min-h-0 flex-col w-72 lg:w-80 xl:w-[22rem] h-full transition-all duration-300 z-20 p-1.5">
              <POSCart
                items={combinedCartItems}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={handleRemoveItem}
                onApplyDiscount={updateItemDiscount}
                onCheckout={() => setIsCheckoutOpen(true)}
                onClearCart={() => clearCart()}
                onApplyPromoCode={applyPromoCode}
                isWholesale={isWholesale}
                onToggleWholesale={handleWholesaleToggle}
                discount={generalDiscount}
                onUpdateDiscount={setGeneralDiscount}
                subtotalApplied={unifiedCalculations.subtotalApplied}
                subtotalNonWholesale={unifiedCalculations.subtotalNonWholesale}
                generalDiscountAmount={unifiedCalculations.generalDiscountAmount}
                wholesaleDiscountAmount={unifiedCalculations.wholesaleDiscountAmount}
                totalSavings={unifiedCalculations.totalSavings}
                cartTax={unifiedCalculations.tax}
                cartTotal={unifiedCalculations.total}
                cartItemCount={unifiedCalculations.totalItemCount}
                taxRate={taxRate}
                canCheckout={canCheckout}
                checkoutDisabledReason={checkoutDisabledReason}
                onHoldSale={handleParkCurrentSale}
                onOpenHeldSales={() => setIsHeldSalesModalOpen(true)}
                heldSalesCount={heldSalesCount}
                onOpenRepairModal={() => setIsRepairModalOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop shortcuts sticky footer */}
      <POSShortcutsBar
        onFocusSearch={() => {
          const el = document.getElementById('search-input') as HTMLInputElement | null
          el?.focus()
          el?.select()
        }}
        onOpenCustomer={() => setIsQuickCustomerOpen(true)}
        onCheckout={() => setIsCheckoutOpen(true)}
        onHoldSale={handleParkCurrentSale}
        onOpenHeldSales={() => setIsHeldSalesModalOpen(true)}
        heldSalesCount={heldSalesCount}
        onToggleWholesale={() => handleWholesaleToggle(!isWholesale)}
        isWholesale={isWholesale}
        onClearCart={() => clearCart()}
        onOpenRepairModal={() => setIsRepairModalOpen(true)}
        canCheckout={canCheckout}
        cartItemCount={unifiedCalculations.totalItemCount}
      />

      {/* Desktop floating checkout button — always visible when cart has items */}
      {canCheckout && (
        <div className="hidden md:block fixed bottom-14 right-6 z-50">
          <Button
            onClick={() => setIsCheckoutOpen(true)}
            size="lg"
            className="h-14 px-6 text-base font-bold rounded-2xl shadow-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white transition-all hover:scale-105 hover:shadow-[0_8px_30px_rgba(16,185,129,0.4)] active:scale-95 animate-in slide-in-from-bottom-4 duration-300"
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Cobrar {formatCurrency(unifiedCalculations.total)}
          </Button>
        </div>
      )}

      {/* Mobile Cart Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t-2 border-primary/20 p-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-50">
        <div className="grid grid-cols-[1fr_auto] gap-2 items-stretch">
          <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
            <SheetTrigger asChild>
              <div className="flex flex-col justify-center cursor-pointer hover:bg-muted/50 px-3 py-2 rounded-xl transition-colors border border-border/60 relative">
                 <span className="text-[11px] text-muted-foreground">{unifiedCalculations.totalItemCount} items en carrito</span>
                 <span className="font-bold text-base">{formatCurrency(unifiedCalculations.total)}</span>
                 {unifiedCalculations.totalItemCount > 0 && (
                   <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                     {unifiedCalculations.totalItemCount}
                   </span>
                 )}
              </div>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] p-0 flex flex-col overflow-hidden">
              <SheetHeader className="p-4 border-b">
                <SheetTitle>Carrito de Compras</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-hidden">
                <POSCart
                  items={combinedCartItems}
                  onUpdateQuantity={updateQuantity}
                  onRemoveItem={handleRemoveItem}
                  onApplyDiscount={updateItemDiscount}
                  onCheckout={() => {
                    setIsMobileCartOpen(false)
                    setIsCheckoutOpen(true)
                  }}
                  onClearCart={() => clearCart()}
                  onApplyPromoCode={applyPromoCode}
                  isWholesale={isWholesale}
                  onToggleWholesale={handleWholesaleToggle}
                  discount={generalDiscount}
                  onUpdateDiscount={setGeneralDiscount}
                  subtotalApplied={unifiedCalculations.subtotalApplied}
                  subtotalNonWholesale={unifiedCalculations.subtotalNonWholesale}
                  generalDiscountAmount={unifiedCalculations.generalDiscountAmount}
                  wholesaleDiscountAmount={unifiedCalculations.wholesaleDiscountAmount}
                  totalSavings={unifiedCalculations.totalSavings}
                  cartTax={unifiedCalculations.tax}
                  cartTotal={unifiedCalculations.total}
                  cartItemCount={unifiedCalculations.totalItemCount}
                  taxRate={taxRate}
                  canCheckout={canCheckout}
                  checkoutDisabledReason={checkoutDisabledReason}
                  onHoldSale={handleParkCurrentSale}
                  onOpenHeldSales={() => {
                    setIsMobileCartOpen(false)
                    setIsHeldSalesModalOpen(true)
                  }}
                  heldSalesCount={heldSalesCount}
                  onOpenRepairModal={() => {
                    setIsMobileCartOpen(false)
                    setIsRepairModalOpen(true)
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Button
            className="h-full min-h-[52px] px-5 text-sm font-bold rounded-xl shadow-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white transition-all active:scale-[0.97]"
            onClick={() => setIsCheckoutOpen(true)}
            disabled={!canCheckout}
            title={checkoutDisabledReason}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Cobrar
            <span className="ml-2 font-bold tabular-nums">{formatCurrency(unifiedCalculations.total)}</span>
          </Button>
        </div>
      </div>

      <Dialog
        open={isQuickItemDialogOpen}
        onOpenChange={(open) => {
          setIsQuickItemDialogOpen(open)
          if (!open) setQuickItemError('')
        }}
      >
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void createQuickItem()
            }}
          >
            <DialogHeader className="border-b bg-muted/30 px-5 py-4 text-left">
              <div className="flex items-start gap-3 pr-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle>Agregar item rapido</DialogTitle>
                  <DialogDescription className="mt-1">
                    Crea el producto en inventario y agregalo a esta venta en un solo paso.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="max-h-[65vh] overflow-y-auto px-5 py-5">
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="quick-item-name">Nombre del item <span className="text-destructive">*</span></Label>
                  <Input
                    id="quick-item-name"
                    autoFocus
                    maxLength={200}
                    value={quickItemName}
                    onChange={(e) => setQuickItemName(e.target.value)}
                    placeholder="Ej: Cambio de pin de carga"
                    disabled={quickItemSaving}
                  />
                  <p className="text-xs text-muted-foreground">Usa un nombre claro para identificarlo luego en inventario.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="quick-item-price">Precio de venta <span className="text-destructive">*</span></Label>
                    <Input
                      id="quick-item-price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={quickItemPrice}
                      onChange={(e) => setQuickItemPrice(e.target.value)}
                      placeholder="0"
                      disabled={quickItemSaving}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="quick-item-qty">Cantidad a vender <span className="text-destructive">*</span></Label>
                    <Input
                      id="quick-item-qty"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={quickItemQty}
                      onChange={(e) => setQuickItemQty(e.target.value)}
                      disabled={quickItemSaving}
                    />
                  </div>
                </div>

                {/* Precio de compra y mayorista: opcionales, para no frenar la
                    carga rapida, pero disponibles cuando hacen falta. */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {canViewCost && (
                    <div className="grid gap-2">
                      <Label htmlFor="quick-item-purchase-price">
                        Precio de compra <span className="text-muted-foreground font-normal">(opcional)</span>
                      </Label>
                      <Input
                        id="quick-item-purchase-price"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={quickItemPurchasePrice}
                        onChange={(e) => setQuickItemPurchasePrice(e.target.value)}
                        placeholder="0"
                        disabled={quickItemSaving}
                      />
                      {quickItemMargin ? (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                          Margen: {formatCurrency(quickItemMargin.profit)} ({quickItemMargin.percent}%)
                        </p>
                      ) : (
                        // El costo se "fotografia" al vender y despues no se puede
                        // corregir desde la app: si queda vacio, esta venta nunca
                        // suma a la ganancia. Se avisa aca, no despues en Finanzas.
                        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Sin costo, esta venta no suma a la ganancia y no se puede corregir despues.</span>
                        </p>
                      )}
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="quick-item-wholesale-price">
                      Precio mayorista <span className="text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <Input
                      id="quick-item-wholesale-price"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={quickItemWholesalePrice}
                      onChange={(e) => setQuickItemWholesalePrice(e.target.value)}
                      placeholder="0"
                      disabled={quickItemSaving}
                    />
                    <p className="text-xs text-muted-foreground">Debe quedar entre el costo y el precio de venta.</p>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="quick-item-sku">SKU opcional</Label>
                  <Input
                    id="quick-item-sku"
                    maxLength={50}
                    value={quickItemSku}
                    onChange={(e) => setQuickItemSku(e.target.value.toUpperCase())}
                    placeholder="Se genera automaticamente"
                    disabled={quickItemSaving}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-3">
                  <div>
                    <Label htmlFor="quick-item-public" className="font-medium">Mostrar en catalogo publico</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Desactivado por defecto para evitar publicar items ocasionales.
                    </p>
                  </div>
                  <Switch
                    id="quick-item-public"
                    checked={quickItemPublishToCatalog}
                    onCheckedChange={setQuickItemPublishToCatalog}
                    disabled={quickItemSaving}
                  />
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Resumen</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Cantidad</p>
                      <p className="font-medium">{Math.max(1, Number(quickItemQty) || 1)} unidad(es)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total a agregar</p>
                      <p className="font-semibold text-primary">
                        {formatCurrency((Number(quickItemPrice) || 0) * Math.max(1, Number(quickItemQty) || 1))}
                      </p>
                    </div>
                  </div>
                  {quickItemMissingCost && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Vas a crear este item <strong>sin precio de compra</strong>. La ganancia de esta venta va a
                        quedar como &quot;pendiente de costo&quot; en Finanzas y no se puede corregir desde la app.
                      </span>
                    </div>
                  )}
                </div>

                {quickItemError && (
                  <Alert variant="destructive" role="alert">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{quickItemError}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <DialogFooter className="border-t bg-background/95 px-5 py-4">
              <Button type="button" variant="outline" onClick={() => setIsQuickItemDialogOpen(false)} disabled={quickItemSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={quickItemSaving}>
                {quickItemSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {quickItemSaving ? 'Sincronizando...' : 'Crear y agregar al carrito'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de checkout */}
      <CheckoutModal
        onUpdateQuantity={updateQuantity}
        selectedRepairIds={selectedRepairIds}
        setSelectedRepairIds={setSelectedRepairIds}
        customerRepairs={customerRepairs}
        markRepairDelivered={markRepairDelivered}
        setMarkRepairDelivered={setMarkRepairDelivered}
        deliveryOutcome={deliveryOutcome}
        setDeliveryOutcome={setDeliveryOutcome}
        supabaseStatusToLabel={supabaseStatusToLabel}
        cart={combinedCartItems}
        cartCalculations={cartCalculations}
        isWholesale={isWholesale}
        WHOLESALE_DISCOUNT_RATE={WHOLESALE_DISCOUNT_RATE}
        discount={generalDiscount}
        onDiscountChange={setGeneralDiscount}
        currency={settings.currency || 'PYG'}
        productCreditPlans={checkoutProductCreditPlans}
        processSale={processSale}
        processMixedPayment={processMixedPayment}
        formatCurrency={formatCurrency}
        allPromotions={allPromotions}
        onApplyPromoCode={applyPromoCode}
        isRegisterOpen={getCurrentRegister.isOpen}
        onOpenRegister={() => setIsOpenRegisterDialogOpen(true)}
        onCancel={() => {
          setIsCheckoutOpen(false)
          resetCheckoutState()
          clearPaymentAttempts()
        }}
      />

      <OpenCashRegisterDialog
        open={isOpenRegisterDialogOpen}
        onOpenChange={setIsOpenRegisterDialogOpen}
        amount={openingAmount}
        onAmountChange={setOpeningAmount}
        note={openingNote}
        onNoteChange={setOpeningNote}
        registerName={registers.find((register) => register.id === activeRegisterId)?.name}
        isSubmitting={isOpeningRegister}
        onSubmit={async (amount, note) => {
          setIsOpeningRegister(true)
          try {
            const opened = await openRegister(amount, note)
            if (opened) {
              await refreshRegisterOpenStatus()
              setIsOpenRegisterDialogOpen(false)
              setOpeningAmount('')
              setOpeningNote('')
            }
          } finally {
            setIsOpeningRegister(false)
          }
        }}
      />

      {/* Diálogo de Gestión de Cajas */}
      <Dialog open={canManageRegisters && isRegisterManagerOpen} onOpenChange={(open) => setIsRegisterManagerOpen(canManageRegisters && open)}>
        <DialogContent className="max-w-xl dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              Gestionar cajas
            </DialogTitle>
            <DialogDescription className="sr-only">
              Administra las cajas disponibles del POS, incluyendo creación y renombrado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
              Solo administradores pueden crear, renombrar o eliminar cajas. Los vendedores operan con la caja asignada o seleccionada.
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">Cajas actuales</h3>
              {registers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay cajas. Cree una nueva abajo.</p>
              ) : (
                <div className="space-y-3">
                  {registers.map((reg) => {
                    const isOpen = Boolean(registerOpenStatus[reg.id])
                    const isCurrent = activeRegisterId === reg.id

                    return (
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
                            <Badge className={isOpen ? 'bg-green-600' : 'bg-gray-500'}>
                              {isOpen ? 'Abierta' : 'Cerrada'}
                            </Badge>
                            {isCurrent && (
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
                                setRegisterManagerBusy(true)
                                if (config.supabase.isConfigured) {
                                  try {
                                    const supabase = createSupabaseClient()
                                    const { error } = await (supabase
                                      .from('cash_registers')
                                      .update({ name })
                                      .eq('id', reg.id)
                                      .select()
                                      .maybeSingle())
                                    if (error) {
                                      toast.error('Error al sincronizar nombre en Supabase')
                                      return
                                    }
                                  } catch (e) {
                                    console.error('Error syncing register name:', e)
                                    toast.error('Error al sincronizar nombre en Supabase')
                                    return
                                  } finally {
                                    setRegisterManagerBusy(false)
                                  }
                                }
                                setRegisters(registers.map(r => r.id === reg.id ? { ...r, name } : r))
                                await refreshRegisters()
                                setRegisterManagerBusy(false)
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
                              disabled={registerManagerBusy || isCurrent}
                              onClick={() => handleRegisterChange(reg.id)}
                            >
                              Usar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={registerManagerBusy}
                              onClick={() => { setRenameRegisterId(reg.id); setRenameRegisterName(reg.name || '') }}
                            >
                              Renombrar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={registerManagerBusy || isOpen}
                              title={isOpen ? 'No puedes eliminar una caja abierta. Cierrala primero.' : undefined}
                              onClick={async () => {
                                if (isOpen) {
                                  toast.error('No puedes eliminar una caja abierta. Cierrala primero.')
                                  return
                                }
                                const nextRegs = registers.filter(r => r.id !== reg.id)
                                setRegisterManagerBusy(true)
                                if (config.supabase.isConfigured) {
                                  try {
                                    const supabase = createSupabaseClient()
                                    const { error } = await supabase
                                      .from('cash_registers')
                                      .delete()
                                      .eq('id', reg.id)
                                    if (error) {
                                      toast.error('Error al eliminar caja en Supabase')
                                      return
                                    }
                                  } catch (e) {
                                    console.error('Error deleting register:', e)
                                    toast.error('Error al eliminar caja en Supabase')
                                    return
                                  } finally {
                                    setRegisterManagerBusy(false)
                                  }
                                }
                                setRegisters(nextRegs.length ? nextRegs : [{ id: 'principal', name: 'Caja Principal', isActive: false }])
                                
                                if (activeRegisterId === reg.id) {
                                  setActiveRegisterId(nextRegs.length ? nextRegs[0].id : 'principal')
                                }
                                await refreshRegisters()
                                await refreshRegisterOpenStatus()
                                setRegisterManagerBusy(false)
                                toast.success('Caja eliminada')
                              }}
                            >
                              Eliminar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    )
                  })}
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
                  disabled={registerManagerBusy}
                  onClick={async () => {
                    const name = newRegisterName.trim()
                    if (name.length < 2) { toast.error('Nombre demasiado corto'); return }
                    let newId = `reg-${Date.now()}`
                    setRegisterManagerBusy(true)
                    if (config.supabase.isConfigured) {
                      if (!selectedBranchId || selectedBranchId === 'all') {
                        toast.error('Selecciona una sucursal antes de crear una caja')
                        setRegisterManagerBusy(false)
                        return
                      }
                      try {
                        const response = await fetch('/api/pos/cash-registers', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name, branch_id: selectedBranchId }),
                        })
                        const payload = await response.json().catch(() => ({}))

                        if (!response.ok || !payload?.success) {
                          toast.warning(payload?.error || 'No se pudo crear la caja')
                          return
                        }

                        const insertedId = payload?.data?.id
                        if (insertedId) {
                          newId = String(insertedId)
                        }
                      } catch (e) {
                        console.error('Error creating register in Supabase:', e)
                        toast.error('Error al crear caja en Supabase')
                        return
                      } finally {
                        setRegisterManagerBusy(false)
                      }
                    }
                    setRegisters([...registers, { id: newId, name, isActive: false }])
                    setActiveRegisterId(newId)
                    await refreshRegisters()
                    await refreshRegisterOpenStatus()
                    setNewRegisterName('')
                    setRegisterManagerBusy(false)
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
            <DialogDescription className="sr-only">
              Consulta los atajos de teclado disponibles para operar más rápido el punto de venta.
            </DialogDescription>
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
            <DialogDescription className="sr-only">
              Visualiza, imprime, descarga o comparte el comprobante generado para la venta actual.
            </DialogDescription>
          </DialogHeader>

          {currentReceipt && (
            <div className="space-y-4">
              <ReceiptGenerator
                receiptData={currentReceipt}
                formatCurrency={formatCurrency}
                onPrint={() => printReceipt(currentReceipt, companyInfo)}
                onDownload={() => downloadReceipt(currentReceipt, companyInfo)}
                onShare={() => shareReceipt(currentReceipt, companyInfo)}
              />

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => printReceipt(currentReceipt, companyInfo)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => downloadReceipt(currentReceipt, companyInfo)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => shareReceipt(currentReceipt, companyInfo)}
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

      {/* Diálogo de Registro de Movimiento Potenciado */}
      <POSCashMovementDialog
        open={isMovementDialogOpen}
        onOpenChange={setIsMovementDialogOpen}
        onAddMovement={addMovement}
        initialType={movementType}
        currentBalance={registerState?.[activeRegisterId]?.balance || 0}
      />

      {/* Modal de Ventas en Espera (Parked Sales) */}
      <HeldSalesModal
        open={isHeldSalesModalOpen}
        onOpenChange={setIsHeldSalesModalOpen}
        heldSales={heldSales}
        onRestoreSale={handleRestoreHeldSale}
        onDeleteSale={deleteSale}
        onClearAll={clearAllSales}
        currentCartHasItems={combinedCartItems.length > 0}
      />

      {/* Modal de Cobro de Reparación / Taller */}
      <POSRepairChargeModal
        open={isRepairModalOpen}
        onOpenChange={setIsRepairModalOpen}
        onAddRepairToCart={handleAddRepairToCart}
      />

      {/* Alta rapida de cliente: el mismo dialogo que el checkout y que
          reparaciones. El que habia aca insertaba contra Supabase desde el
          navegador, sin `organization_id`, con una columna `document_id` que no
          existe y con el email en null sobre una columna NOT NULL. */}
      <CustomerQuickCreateDialog
        open={isQuickCustomerOpen}
        onClose={() => setIsQuickCustomerOpen(false)}
        onCreated={(customerId) => {
          setSelectedCustomer(customerId)
          setIsQuickCustomerOpen(false)
        }}
      />

      {/* Modal de Detalle de Producto */}
      <POSProductDetailDialog
        product={detailProduct}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        autoScrollToCredit={detailDialogScrollToCredit}
        onAddToCart={(product, qty) => {
          addToCartHook(product, qty)
        }}
        creditContext={{
          hasCustomer: Boolean(activeCustomer),
          hasCreditLine: Number(activeCustomer?.credit_limit || 0) > 0,
          availableCredit: Math.max(
            0,
            Number(activeCustomer?.credit_limit || 0) - Number(activeCustomer?.current_balance || 0),
          ),
          isRegisterOpen: getCurrentRegister.isOpen,
        }}
        onUseCreditPlan={(product, qty, plan) => {
          addToCartHook(product, qty)
          setPaymentMethod('credit')
          applyProductCreditSuggestion({
            productId: product.id,
            productName: product.name,
            count: plan.count,
            interestRate: plan.rate,
            frequency: plan.frequency,
          })
          toast.success(`Plan de ${plan.count} cuotas preparado`, {
            description: 'Revisá las condiciones sobre el total del ticket antes de confirmar.',
          })
        }}
        isWholesale={isWholesale}
        wholesaleDiscountRate={WHOLESALE_DISCOUNT_RATE}
      />
    </div>
  )
}

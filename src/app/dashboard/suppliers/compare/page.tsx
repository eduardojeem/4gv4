'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Package,
  Plus,
  RefreshCw,
  HelpCircle,
  Info,
  Lightbulb,
  Search,
  ShieldAlert,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import type { SectionGuideData } from '@/components/dashboard/common/SectionGuideModal'
import { CreateOrderModal } from '@/components/suppliers/CreateOrderModal'
import { ProductThumb } from '@/components/suppliers/order-ui'
import { formatCurrency } from '@/lib/currency'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface SupplierProduct {
  id: string
  name: string
  suppliersku: string
  internalsku: string
  barcode?: string
  category?: string
  unitprice: number
  saleprice: number
  currency: string
  supplier_id: string
  stock: number | null
  minStock: number | null
  imageUrl?: string | null
  suppliers?: {
    id?: string
    name: string
    contact_name?: string
    phone?: string
    address?: string
  }
}

interface ProductGroup {
  id: string
  name: string
  sku: string
  barcode?: string
  category?: string
  imageUrl?: string | null
  stock: number | null
  minStock: number | null
  salePrice: number
  avgPrice: number
  minPrice: number
  maxPrice: number
  savingsPercent: number
  savingsAmount: number
  offers: SupplierProduct[]
}

type SegmentFilter = 'all' | 'multi' | 'savings' | 'stock_low'
type SortOption = 'savings_desc' | 'cost_asc' | 'cost_desc' | 'name_asc' | 'offers_desc'
type ViewMode = 'cards' | 'table'

const COMPARISON_GUIDE: SectionGuideData = {
  title: 'Guía de Comparativa de Proveedores',
  subtitle: 'Optimizá tus decisiones de compra, identificá el menor costo unitario y maximizá tu margen bruto de ganancia.',
  badgeText: 'Adquisición y Ahorro',
  gradient: 'from-emerald-600 via-teal-700 to-slate-900',
  icon: TrendingDown,
  tip: 'Revisá siempre la columna "Diferencia vs Mejor". Si supera el 15%, usá la cotización más baja como argumento comercial para negociar mejores precios o plazos con tu proveedor habitual.',
  steps: [
    {
      title: 'Agrupación Inteligente de Artículos',
      description: 'El motor agrupa automáticamente productos equivalentes en tus catálogos cruzando Código de Barras (EAN/UPC), SKU interno y normalización de nombre entre las listas de los proveedores.',
      icon: Layers,
    },
    {
      title: 'Identificación Automática del Mejor Costo',
      description: 'Las ofertas se ordenan automáticamente de menor a mayor costo de compra. La primera opción se distingue con la insignia verde "Mejor Precio" y se toma como base de cálculo.',
      icon: CheckCircle2,
    },
    {
      title: 'Cálculo de Ahorro y Margen Bruto Proyectado',
      description: 'El sistema calcula en tiempo real la brecha de sobrecosto [(Costo Mayor - Costo Menor) ÷ Costo Mayor] y proyecta el margen comercial sobre tu Precio de Venta al Público (PVP).',
      icon: TrendingUp,
    },
    {
      title: 'Reposición Crítica y Orden Inmediata',
      description: 'Identificá artículos agotados o por debajo del stock mínimo con las alertas ámbar y roja, y abrí la orden de compra preconfigurada hacia el proveedor ganador con un solo clic.',
      icon: ShoppingCart,
    },
  ],
  examples: [
    {
      goal: 'Comprar 20 unidades de Smartphones al costo más bajo disponible',
      setup: [
        'En el buscador escribís "iPhone" o activás el orden "Mayor ahorro potencial (%)".',
        'El sistema compara: Proveedor A a ₲ 5.850.000 vs Proveedor B a ₲ 6.450.000 (brecha de ₲ 600.000 / u.).',
        'La barra visual de dispersión refleja un 9.3% de ahorro directo entre ambas cotizaciones.'
      ],
      result: 'Generás la orden con el Proveedor A y ahorrás ₲ 12.000.000 en el lote total de 20 unidades.',
      icon: TrendingDown,
    },
    {
      goal: 'Evitar quiebres de stock en accesorios con margen de ganancia maximizado',
      setup: [
        'Hacés clic en la píldora rápida "Reposición Crítica".',
        'Detectás cables USB-C con stock en 0 y 3 proveedores disponibles (₲ 18.500 vs ₲ 28.000).',
        'Con PVP de venta en ₲ 45.000, el costo mínimo proyecta un margen bruto del 58.9% frente al 37.8% del más caro.'
      ],
      result: 'Reabastecés antes de perder ventas con 21.1 puntos porcentuales más de rentabilidad neta.',
      icon: AlertTriangle,
    },
    {
      goal: 'Activar un proveedor de respaldo ante demoras o falta de stock',
      setup: [
        'Filtrás por "Con Múltiples Ofertas" para auditar productos con 2 o más distribuidores vinculados.',
        'Consultás el teléfono y SKU alternativo del segundo proveedor listado en la comparativa.'
      ],
      result: 'Garantizás la continuidad operativa de tu tienda sin depender de una sola fuente de suministro.',
      icon: Building2,
    },
  ],
}

const DEMO_PRODUCTS: SupplierProduct[] = [
  // 1. iPhone 15 128GB Black (3 ofertas competitivas)
  {
    id: 'demo-iph15-1',
    name: 'Apple iPhone 15 128GB Black',
    suppliersku: 'TG-IPH15-128',
    internalsku: 'IPH-15-128-BLK',
    barcode: '195949038241',
    category: 'Telefonía & Smart',
    unitprice: 5850000,
    saleprice: 7490000,
    currency: 'PYG',
    supplier_id: 'sup-tecnoglobal',
    stock: 2,
    minStock: 5,
    imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-tecnoglobal',
      name: 'TecnoGlobal Distribuidora',
      contact_name: 'Carlos Benítez',
      phone: '+595 21 600 100',
    },
  },
  {
    id: 'demo-iph15-2',
    name: 'Apple iPhone 15 128GB Black',
    suppliersku: 'DA-IPH15-BLK',
    internalsku: 'IPH-15-128-BLK',
    barcode: '195949038241',
    category: 'Telefonía & Smart',
    unitprice: 6200000,
    saleprice: 7490000,
    currency: 'PYG',
    supplier_id: 'sup-dist-asuncion',
    stock: 2,
    minStock: 5,
    imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-dist-asuncion',
      name: 'Distribuidora Asunción S.A.',
      contact_name: 'Lorena Ortiz',
      phone: '+595 21 555 230',
    },
  },
  {
    id: 'demo-iph15-3',
    name: 'Apple iPhone 15 128GB Black',
    suppliersku: 'IDE-APL-15128',
    internalsku: 'IPH-15-128-BLK',
    barcode: '195949038241',
    category: 'Telefonía & Smart',
    unitprice: 6550000,
    saleprice: 7490000,
    currency: 'PYG',
    supplier_id: 'sup-imp-este',
    stock: 2,
    minStock: 5,
    imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-imp-este',
      name: 'Importadora del Este',
      contact_name: 'Fabio Ferreira',
      phone: '+595 61 500 800',
    },
  },
  // 2. Smart TV Samsung 55" Crystal UHD 4K (3 ofertas, Stock Agotado = Reposición Crítica)
  {
    id: 'demo-tv55-1',
    name: 'Smart TV Samsung 55" Crystal UHD 4K',
    suppliersku: 'ES-SAM-55UHD',
    internalsku: 'SAM-TV-55CU7000',
    barcode: '8806094892211',
    category: 'Audio & Video',
    unitprice: 3150000,
    saleprice: 4590000,
    currency: 'PYG',
    supplier_id: 'sup-electrosur',
    stock: 0,
    minStock: 3,
    imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-electrosur',
      name: 'ElectroSur Mayorista',
      contact_name: 'Mariano Silva',
      phone: '+595 21 720 300',
    },
  },
  {
    id: 'demo-tv55-2',
    name: 'Smart TV Samsung 55" Crystal UHD 4K',
    suppliersku: 'MM-TV-55-SAM',
    internalsku: 'SAM-TV-55CU7000',
    barcode: '8806094892211',
    category: 'Audio & Video',
    unitprice: 3600000,
    saleprice: 4590000,
    currency: 'PYG',
    supplier_id: 'sup-megamarket',
    stock: 0,
    minStock: 3,
    imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-megamarket',
      name: 'Megamarket Mayorista',
      contact_name: 'Paola Méndez',
      phone: '+595 21 890 120',
    },
  },
  {
    id: 'demo-tv55-3',
    name: 'Smart TV Samsung 55" Crystal UHD 4K',
    suppliersku: 'SR-S55-4K',
    internalsku: 'SAM-TV-55CU7000',
    barcode: '8806094892211',
    category: 'Audio & Video',
    unitprice: 3900000,
    saleprice: 4590000,
    currency: 'PYG',
    supplier_id: 'sup-soluciones',
    stock: 0,
    minStock: 3,
    imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-soluciones',
      name: 'Soluciones Retail Py',
      contact_name: 'Esteban Bogado',
      phone: '+595 21 333 440',
    },
  },
  // 3. Cable USB-C 65W Trenzado 2m (3 ofertas, 33.9% de ahorro, margen alto)
  {
    id: 'demo-cbl-1',
    name: 'Cable USB-C Carga Rápida 65W Trenzado 2m',
    suppliersku: 'AP-USBC-65W',
    internalsku: 'CBL-USBC-65W-2M',
    barcode: '7791234567890',
    category: 'Accesorios',
    unitprice: 18500,
    saleprice: 45000,
    currency: 'PYG',
    supplier_id: 'sup-accesorios-pro',
    stock: 4,
    minStock: 15,
    imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-accesorios-pro',
      name: 'Accesorios Pro Paraguay',
      contact_name: 'Rodrigo Romero',
      phone: '+595 981 123 456',
    },
  },
  {
    id: 'demo-cbl-2',
    name: 'Cable USB-C Carga Rápida 65W Trenzado 2m',
    suppliersku: 'GI-CAB-65W',
    internalsku: 'CBL-USBC-65W-2M',
    barcode: '7791234567890',
    category: 'Accesorios',
    unitprice: 24000,
    saleprice: 45000,
    currency: 'PYG',
    supplier_id: 'sup-global-imports',
    stock: 4,
    minStock: 15,
    imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-global-imports',
      name: 'Global Imports S.R.L.',
      contact_name: 'Mirta González',
      phone: '+595 21 445 678',
    },
  },
  {
    id: 'demo-cbl-3',
    name: 'Cable USB-C Carga Rápida 65W Trenzado 2m',
    suppliersku: 'CT-USB-C2M',
    internalsku: 'CBL-USBC-65W-2M',
    barcode: '7791234567890',
    category: 'Accesorios',
    unitprice: 28000,
    saleprice: 45000,
    currency: 'PYG',
    supplier_id: 'sup-cabletec',
    stock: 4,
    minStock: 15,
    imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-cabletec',
      name: 'CableTec Distribuciones',
      contact_name: 'Hugo Ayala',
      phone: '+595 971 889 900',
    },
  },
  // 4. Aire Acondicionado Split 12000 BTU Inverter (2 ofertas)
  {
    id: 'demo-ac12-1',
    name: 'Aire Acondicionado Split 12000 BTU Inverter Eco',
    suppliersku: 'CP-AC12-INV',
    internalsku: 'SPLIT-12000-INV',
    barcode: '7891234998822',
    category: 'Climatización',
    unitprice: 2450000,
    saleprice: 3390000,
    currency: 'PYG',
    supplier_id: 'sup-climatizacion',
    stock: 8,
    minStock: 3,
    imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-climatizacion',
      name: 'Climatización Py S.A.',
      contact_name: 'Dario Vera',
      phone: '+595 21 999 111',
    },
  },
  {
    id: 'demo-ac12-2',
    name: 'Aire Acondicionado Split 12000 BTU Inverter Eco',
    suppliersku: 'ES-SPLIT-12K',
    internalsku: 'SPLIT-12000-INV',
    barcode: '7891234998822',
    category: 'Climatización',
    unitprice: 2750000,
    saleprice: 3390000,
    currency: 'PYG',
    supplier_id: 'sup-electrosur',
    stock: 8,
    minStock: 3,
    imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-electrosur',
      name: 'ElectroSur Mayorista',
      contact_name: 'Mariano Silva',
      phone: '+595 21 720 300',
    },
  },
  // 5. Notebook Lenovo ThinkPad E14 Core i5 (2 ofertas)
  {
    id: 'demo-nb14-1',
    name: 'Notebook Lenovo ThinkPad E14 Gen 4 Core i5 16GB 512GB',
    suppliersku: 'TG-TP-E14',
    internalsku: 'LEN-E14-G4-I5',
    barcode: '196800123456',
    category: 'Informática',
    unitprice: 6400000,
    saleprice: 8200000,
    currency: 'PYG',
    supplier_id: 'sup-tecnoglobal',
    stock: 12,
    minStock: 4,
    imageUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-tecnoglobal',
      name: 'TecnoGlobal Distribuidora',
      contact_name: 'Carlos Benítez',
      phone: '+595 21 600 100',
    },
  },
  {
    id: 'demo-nb14-2',
    name: 'Notebook Lenovo ThinkPad E14 Gen 4 Core i5 16GB 512GB',
    suppliersku: 'IE-LN-E14G4',
    internalsku: 'LEN-E14-G4-I5',
    barcode: '196800123456',
    category: 'Informática',
    unitprice: 6950000,
    saleprice: 8200000,
    currency: 'PYG',
    supplier_id: 'sup-imp-este',
    stock: 12,
    minStock: 4,
    imageUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=300&auto=format&fit=crop&q=80',
    suppliers: {
      id: 'sup-imp-este',
      name: 'Importadora del Este',
      contact_name: 'Fabio Ferreira',
      phone: '+595 61 500 800',
    },
  },
]

export default function PriceComparisonPage() {
  const router = useRouter()
  const [products, setProducts] = useState<SupplierProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('savings_desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  // Datos activos: datos de la organización o datos de ejemplo
  const activeProducts = useMemo(() => {
    return isDemoMode ? DEMO_PRODUCTS : products
  }, [isDemoMode, products])

  // Estado para el modal de pedido
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [orderSupplier, setOrderSupplier] = useState<{ id: string; name: string } | null>(null)
  const [orderProduct, setOrderProduct] = useState<{
    id: string
    name: string
    suppliersku: string
    unitprice: number
    currency: string
    stock?: number | null
    minStock?: number | null
    imageUrl?: string | null
    source?: 'own' | 'supplier'
  } | null>(null)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      // Cargar productos activos mediante el endpoint de tenant con paginación
      const res = await fetch('/api/products?per_page=100&is_active=true', { cache: 'no-store' })
      const payload = (await res.json().catch(() => null)) as {
        success?: boolean
        error?: string
        data?: {
          products?: Array<Record<string, unknown>>
          pagination?: { total?: number; totalPages?: number }
        }
      } | null

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudieron cargar los productos')
      }

      let allProducts = payload.data?.products ?? []

      // Si hay más páginas, traer páginas adicionales en paralelo para comparar el catálogo completo
      const totalPages = payload.data?.pagination?.totalPages ?? 1
      if (totalPages > 1) {
        const extraPages = Math.min(totalPages, 3)
        const pagePromises = []
        for (let p = 2; p <= extraPages; p++) {
          pagePromises.push(
            fetch(`/api/products?per_page=100&is_active=true&page=${p}`, { cache: 'no-store' })
              .then((r) => r.json().catch(() => null))
              .then((data) => data?.data?.products ?? [])
          )
        }
        const results = await Promise.all(pagePromises)
        for (const pageProducts of results) {
          allProducts = allProducts.concat(pageProducts)
        }
      }

      const mapped: SupplierProduct[] = allProducts.map((p) => {
        const supplierObj = p.supplier as SupplierProduct['suppliers'] | undefined
        const categoryObj = p.category as { name?: string } | undefined
        const images = Array.isArray(p.images) ? (p.images as string[]) : []
        const purchasePrice = Number(p.purchase_price ?? p.cost_price ?? 0)
        const salePrice = Number(p.sale_price ?? 0)

        return {
          id: String(p.id),
          name: String(p.name || 'Producto sin nombre'),
          suppliersku: String(p.sku || ''),
          internalsku: String(p.sku || ''),
          barcode: p.barcode ? String(p.barcode) : undefined,
          category: categoryObj?.name || undefined,
          // Corrección clave: El valor a comparar es el costo de compra del proveedor
          unitprice: purchasePrice > 0 ? purchasePrice : salePrice,
          saleprice: salePrice,
          currency: 'PYG',
          supplier_id: String(p.supplier_id || supplierObj?.id || ''),
          stock: p.stock_quantity == null ? null : Number(p.stock_quantity),
          minStock: p.min_stock == null ? null : Number(p.min_stock),
          imageUrl: (p.image_url as string | null) || images[0] || null,
          suppliers: supplierObj || { name: 'Sin proveedor asignado' },
        }
      })

      setProducts(mapped)
    } catch (error: unknown) {
      logger.error('Error fetching products for comparison', {
        error,
        details: error instanceof Error ? error.message : String(error),
      })
      toast.error('No se pudieron cargar los datos para la comparativa de precios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  // Proveedores únicos para el filtro
  const uniqueSuppliers = useMemo(() => {
    const suppliers = new Map<string, { id: string; name: string; count: number }>()
    activeProducts.forEach((p) => {
      if (p.supplier_id && p.suppliers?.name) {
        const existing = suppliers.get(p.supplier_id)
        if (existing) {
          existing.count += 1
        } else {
          suppliers.set(p.supplier_id, {
            id: p.supplier_id,
            name: p.suppliers.name,
            count: 1,
          })
        }
      }
    })
    return Array.from(suppliers.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [activeProducts])

  // Agrupamiento y análisis de ofertas
  const groupedProducts = useMemo(() => {
    const groups: Record<string, SupplierProduct[]> = {}

    // Filtrar según proveedor seleccionado
    const filtered = selectedSupplierId === 'all'
      ? activeProducts
      : activeProducts.filter((p) => p.supplier_id === selectedSupplierId)

    // Agrupar por barcode, SKU o nombre normalizado
    const normalize = (val: string) => val.trim().toLowerCase()
    const relevantKeys = new Set(filtered.map((p) => p.barcode?.trim() || p.internalsku?.trim() || normalize(p.name)))

    activeProducts.forEach((p) => {
      const key = p.barcode?.trim() || p.internalsku?.trim() || normalize(p.name)
      if (relevantKeys.has(key)) {
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(p)
      }
    })

    const result: ProductGroup[] = Object.entries(groups).map(([key, offers]) => {
      // Ordenar ofertas por precio unitario ascendente (mejor precio primero)
      const sortedOffers = [...offers].sort((a, b) => a.unitprice - b.unitprice)
      const prices = sortedOffers.map((o) => o.unitprice)
      const minPrice = Math.min(...prices)
      const maxPrice = Math.max(...prices)
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length
      const savingsAmount = maxPrice - minPrice
      const savingsPercent = maxPrice > 0 ? (savingsAmount / maxPrice) * 100 : 0
      const first = sortedOffers[0]

      return {
        id: first.id,
        name: first.name,
        sku: first.internalsku || key,
        barcode: first.barcode,
        category: first.category,
        imageUrl: first.imageUrl,
        stock: first.stock,
        minStock: first.minStock,
        salePrice: first.saleprice,
        avgPrice,
        minPrice,
        maxPrice,
        savingsAmount,
        savingsPercent,
        offers: sortedOffers,
      }
    })

    // Filtro por búsqueda
    let filteredResult = result.filter((g) => {
      if (!search.trim()) return true
      const term = search.trim().toLowerCase()
      const matchesName = g.name.toLowerCase().includes(term)
      const matchesSku = g.sku.toLowerCase().includes(term)
      const matchesBarcode = g.barcode ? g.barcode.toLowerCase().includes(term) : false
      const matchesSupplier = g.offers.some((o) => o.suppliers?.name?.toLowerCase().includes(term))
      return matchesName || matchesSku || matchesBarcode || matchesSupplier
    })

    // Filtro por píldoras de segmento
    if (segmentFilter === 'multi') {
      filteredResult = filteredResult.filter((g) => g.offers.length > 1)
    } else if (segmentFilter === 'savings') {
      filteredResult = filteredResult.filter((g) => g.savingsPercent >= 10 && g.offers.length > 1)
    } else if (segmentFilter === 'stock_low') {
      filteredResult = filteredResult.filter(
        (g) => (g.stock !== null && g.minStock !== null && g.stock <= g.minStock) || (g.stock !== null && g.stock <= 0)
      )
    }

    // Ordenamiento dinámico
    filteredResult.sort((a, b) => {
      switch (sortBy) {
        case 'savings_desc':
          return b.savingsPercent - a.savingsPercent || b.savingsAmount - a.savingsAmount
        case 'cost_asc':
          return a.minPrice - b.minPrice
        case 'cost_desc':
          return b.minPrice - a.minPrice
        case 'name_asc':
          return a.name.localeCompare(b.name)
        case 'offers_desc':
          return b.offers.length - a.offers.length
        default:
          return 0
      }
    })

    return filteredResult
  }, [activeProducts, search, selectedSupplierId, segmentFilter, sortBy])

  // KPIs de Adquisición
  const kpis = useMemo(() => {
    const totalProducts = activeProducts.length
    const multiOffers = groupedProducts.filter((g) => g.offers.length > 1).length
    const maxSavings = groupedProducts.reduce((max, g) => Math.max(max, g.savingsPercent), 0)
    const criticalStockCount = groupedProducts.filter(
      (g) => (g.stock !== null && g.minStock !== null && g.stock <= g.minStock) || (g.stock !== null && g.stock <= 0)
    ).length

    return {
      totalProducts,
      multiOffers,
      maxSavings,
      criticalStockCount,
    }
  }, [activeProducts, groupedProducts])

  // Exportar comparativa a CSV
  const exportToCSV = () => {
    if (groupedProducts.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }

    const headers = [
      'Producto',
      'SKU',
      'Código de Barra',
      'Categoría',
      'Stock Actual',
      'Stock Mínimo',
      'Precio Venta PVP',
      'Mejor Proveedor',
      'Mejor Costo Compra',
      'Costo Más Alto',
      'Ahorro Unitario',
      'Ahorro %',
      'Cantidad Ofertas',
    ]

    const rows = groupedProducts.map((g) => [
      `"${g.name.replace(/"/g, '""')}"`,
      `"${g.sku}"`,
      `"${g.barcode || ''}"`,
      `"${g.category || ''}"`,
      g.stock ?? 'N/A',
      g.minStock ?? 'N/A',
      g.salePrice,
      `"${(g.offers[0]?.suppliers?.name || 'N/A').replace(/"/g, '""')}"`,
      g.minPrice,
      g.maxPrice,
      g.savingsAmount,
      `${g.savingsPercent.toFixed(1)}%`,
      g.offers.length,
    ])

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `comparativa_proveedores_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Comparativa exportada exitosamente en CSV')
  }

  // Apertura del modal de orden
  const handleCreateOrder = (offer: SupplierProduct) => {
    if (!offer.supplier_id || !offer.suppliers?.name) {
      toast.error('Este producto no tiene un proveedor válido asignado')
      return
    }

    setOrderSupplier({
      id: offer.supplier_id,
      name: offer.suppliers.name,
    })
    setOrderProduct({
      id: offer.id,
      name: offer.name,
      suppliersku: offer.suppliersku || offer.internalsku,
      unitprice: offer.unitprice,
      currency: offer.currency || 'PYG',
      stock: offer.stock,
      minStock: offer.minStock,
      imageUrl: offer.imageUrl,
      source: 'own',
    })
    setOrderModalOpen(true)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── 1. Cabecera Ejecutiva ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/dashboard/suppliers')}
            className="h-10 w-10 shrink-0 rounded-xl"
            title="Volver a Proveedores"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Comparativa de Precios
              </h1>
              <Badge variant="outline" className="hidden sm:inline-flex bg-primary/10 text-primary border-primary/20">
                Auditoría de Adquisición
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Analizá costos de compra, identificá ahorros por proveedor y generá órdenes de reposición directa.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap sm:flex-nowrap">
          {/* Toggle Modo Ejemplo / Demostración */}
          {isDemoMode ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setIsDemoMode(false)
                toast.success('Regresaste a tus datos reales')
              }}
              className="h-9 gap-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              <X className="h-3.5 w-3.5" />
              <span>Salir de Ejemplos</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDemoMode(true)
                toast.info('Modo Demostración activo: 5 productos con cotizaciones cruzadas')
              }}
              className="h-9 gap-1.5 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
              title="Probar la comparativa con productos y proveedores de ejemplo"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Probar Ejemplos</span>
            </Button>
          )}

          {/* Guía Interactiva ¿Cómo funciona? */}
          <SectionGuideButton guide={COMPARISON_GUIDE} />

          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchProducts()}
            disabled={loading || isDemoMode}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
            title={isDemoMode ? 'Desactivá el modo ejemplo para actualizar datos' : 'Actualizar catálogo'}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            <span className="hidden md:inline">Actualizar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={loading || groupedProducts.length === 0}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* ── Banner Informativo de Demostración ── */}
      {isDemoMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 via-blue-50/60 to-purple-50/60 dark:border-indigo-900/50 dark:bg-gradient-to-r dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-purple-950/30 shadow-2xs animate-in fade-in duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-foreground">
                  Modo Demostración Activo
                </h4>
                <Badge className="bg-indigo-600 text-white text-[10px] font-bold py-0 h-4 uppercase tracking-wider">
                  5 Ejemplos Prácticos
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Explorando productos con múltiples cotizaciones simuladas (smartphones, televisores, cables y climatización) para evaluar brechas de ahorro, márgenes y generación directa de pedidos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDemoMode(false)
                toast.success('Regresaste a tus datos reales')
              }}
              className="h-8 rounded-lg text-xs font-semibold bg-background/80 hover:bg-background"
            >
              Volver a Mis Datos
            </Button>
          </div>
        </div>
      )}

      {/* ── Banner de Recomendación si la tienda no tiene múltiples proveedores ── */}
      {!isDemoMode && !loading && kpis.multiOffers === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-amber-200/70 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20">
          <div className="flex items-start sm:items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-foreground">
                ¿Cómo sacarle el máximo provecho a la comparativa?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tus productos actuales aún no tienen múltiples cotizaciones registradas. Activá los datos de ejemplo para ver cómo el algoritmo calcula márgenes y brechas de costo en tiempo real.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsDemoMode(true)
              toast.info('Modo Demostración activado')
            }}
            className="h-8 rounded-lg text-xs font-semibold shrink-0 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200"
          >
            <Sparkles className="h-3 w-3 mr-1.5 text-amber-600 dark:text-amber-400" />
            Cargar Ejemplos
          </Button>
        </div>
      )}

      {/* ── 2. Panel de KPIs de Compras ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Ahorro Máximo */}
        <Card className="border-border/70 bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ahorro Máx. Posible</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {kpis.maxSavings > 0 ? `+${kpis.maxSavings.toFixed(1)}%` : '0%'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Brecha entre mejor y peor oferta</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Múltiples Ofertas */}
        <Card className="border-border/70 bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Con Competencia</p>
              <p className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                {kpis.multiOffers} <span className="text-xs font-normal text-muted-foreground">ítems</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Productos con 2+ cotizaciones</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Stock Crítico */}
        <Card className="border-border/70 bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reposición Crítica</p>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                {kpis.criticalStockCount} <span className="text-xs font-normal text-muted-foreground">ítems</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Stock agotado o bajo mínimo</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Proveedores Activos */}
        <Card className="border-border/70 bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Proveedores</p>
              <p className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                {uniqueSuppliers.length} <span className="text-xs font-normal text-muted-foreground">activos</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Disponibles para pedidos</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. Barra de Búsqueda, Filtros y Segmentos ── */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Buscador de Producto / SKU */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por producto, SKU interno, código de barra o proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/80 h-10 rounded-xl text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtro por Proveedor Específico */}
          <div className="w-full md:w-64">
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger className="h-10 bg-card border-border/80 rounded-xl text-xs font-medium">
                <div className="flex items-center gap-2 truncate">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Filtrar por proveedor" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proveedores ({activeProducts.length} productos)</SelectItem>
                {uniqueSuppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selector de Orden */}
          <div className="w-full md:w-56">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-10 bg-card border-border/80 rounded-xl text-xs font-medium">
                <div className="flex items-center gap-2 truncate">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Ordenar por" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="savings_desc">Mayor ahorro potencial (%)</SelectItem>
                <SelectItem value="cost_asc">Menor costo primero</SelectItem>
                <SelectItem value="cost_desc">Mayor costo primero</SelectItem>
                <SelectItem value="name_asc">Nombre del producto (A-Z)</SelectItem>
                <SelectItem value="offers_desc">Más cotizaciones</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Switch de Modo de Vista */}
          <div className="flex items-center border border-border/80 rounded-xl bg-card p-0.5 shrink-0">
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-9 px-3 rounded-lg text-xs gap-1.5"
              title="Vista de Tarjetas Detalladas"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tarjetas</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-9 px-3 rounded-lg text-xs gap-1.5"
              title="Vista de Tabla Compacta"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tabla</span>
            </Button>
          </div>
        </div>

        {/* Píldoras Rápidas de Segmentación */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSegmentFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg border font-semibold transition-colors shrink-0',
              segmentFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-card hover:bg-muted text-muted-foreground border-border/80'
            )}
          >
            Todos ({activeProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setSegmentFilter('multi')}
            className={cn(
              'px-3 py-1.5 rounded-lg border font-semibold transition-colors shrink-0 flex items-center gap-1.5',
              segmentFilter === 'multi'
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-card hover:bg-muted text-muted-foreground border-border/80'
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Con Múltiples Ofertas ({kpis.multiOffers})
          </button>
          <button
            type="button"
            onClick={() => setSegmentFilter('savings')}
            className={cn(
              'px-3 py-1.5 rounded-lg border font-semibold transition-colors shrink-0 flex items-center gap-1.5',
              segmentFilter === 'savings'
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-card hover:bg-muted text-muted-foreground border-border/80'
            )}
          >
            <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
            Mayor Ahorro (&gt;10%)
          </button>
          <button
            type="button"
            onClick={() => setSegmentFilter('stock_low')}
            className={cn(
              'px-3 py-1.5 rounded-lg border font-semibold transition-colors shrink-0 flex items-center gap-1.5',
              segmentFilter === 'stock_low'
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-card hover:bg-muted text-muted-foreground border-border/80'
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Reposición Crítica ({kpis.criticalStockCount})
          </button>
        </div>
      </div>

      {/* ── 4. Contenedor de Resultados ── */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden border-border/70 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48 rounded" />
                    <Skeleton className="h-4 w-32 rounded" />
                  </div>
                </div>
                <Skeleton className="h-8 w-28 rounded" />
              </div>
              <Skeleton className="h-24 w-full rounded-xl" />
            </Card>
          ))}
        </div>
      ) : groupedProducts.length === 0 ? (
        /* Estado Vacío */
        <Card className="border-dashed border-border/80 p-12 text-center bg-card/60">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
            <Package className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No se encontraron productos para comparar</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            {search || selectedSupplierId !== 'all' || segmentFilter !== 'all'
              ? 'Probá ajustando o restableciendo los filtros de búsqueda y proveedor.'
              : 'Todavía no hay productos registrados con proveedores en el catálogo de la organización.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {(search || selectedSupplierId !== 'all' || segmentFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setSelectedSupplierId('all')
                  setSegmentFilter('all')
                }}
                className="rounded-xl text-xs font-semibold"
              >
                Restablecer todos los filtros
              </Button>
            )}
            {!isDemoMode && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setIsDemoMode(true)
                  setSearch('')
                  setSelectedSupplierId('all')
                  setSegmentFilter('all')
                  toast.info('Modo Demostración activado: 5 productos de ejemplo cargados')
                }}
                className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Explorar con datos de ejemplo
              </Button>
            )}
          </div>
        </Card>
      ) : viewMode === 'table' ? (
        /* ── Modo Vista: Tabla Compacta ── */
        <Card className="overflow-hidden border-border/80 shadow-2xs bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[300px]">Producto</TableHead>
                <TableHead>SKU / Código</TableHead>
                <TableHead>Stock Actual</TableHead>
                <TableHead>PVP Tienda</TableHead>
                <TableHead>Mejor Proveedor</TableHead>
                <TableHead className="text-right">Mejor Costo</TableHead>
                <TableHead className="text-right">Costo Alto</TableHead>
                <TableHead className="text-right">Ahorro %</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedProducts.map((group) => {
                const isOut = group.stock !== null && group.stock <= 0
                const isLow = group.stock !== null && group.minStock !== null && group.stock <= group.minStock && !isOut
                const bestOffer = group.offers[0]

                return (
                  <TableRow key={group.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <ProductThumb url={group.imageUrl} name={group.name} size={36} />
                        <span className="truncate max-w-[220px]" title={group.name}>
                          {group.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {group.sku}
                    </TableCell>
                    <TableCell>
                      {group.stock !== null ? (
                        <span
                          className={cn(
                            'text-xs font-bold tabular-nums inline-flex items-center gap-1',
                            isOut && 'text-rose-600',
                            isLow && 'text-amber-600',
                            !isOut && !isLow && 'text-foreground'
                          )}
                        >
                          {isOut ? '0 (Agotado)' : isLow ? `${group.stock} (Bajo)` : `${group.stock} u.`}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {group.salePrice > 0 ? formatCurrency(group.salePrice) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-semibold text-xs">
                        {bestOffer?.suppliers?.name || 'Desconocido'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(group.minPrice)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground font-mono">
                      {group.offers.length > 1 ? formatCurrency(group.maxPrice) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {group.savingsPercent > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{group.savingsPercent.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Única</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {bestOffer && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2.5 text-xs font-semibold rounded-lg"
                          onClick={() => handleCreateOrder(bestOffer)}
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Pedir
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        /* ── Modo Vista: Tarjetas Detalladas con Gráfico de Dispersión ── */
        <div className="grid grid-cols-1 gap-5">
          {groupedProducts.map((group) => {
            const isOut = group.stock !== null && group.stock <= 0
            const isLow = group.stock !== null && group.minStock !== null && group.stock <= group.minStock && !isOut
            const bestCost = group.minPrice
            const marginWithBest = group.salePrice > 0 && bestCost > 0
              ? ((group.salePrice - bestCost) / group.salePrice) * 100
              : null

            return (
              <Card key={group.sku} className="overflow-hidden border-border/80 bg-card shadow-2xs hover:shadow-xs transition-shadow">
                {/* Cabecera de la Tarjeta */}
                <CardHeader className="p-4 sm:p-5 pb-4 bg-muted/20 border-b border-border/60">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <ProductThumb url={group.imageUrl} name={group.name} size={48} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base sm:text-lg font-bold truncate">
                            {group.name}
                          </CardTitle>
                          {group.category && (
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                              {group.category}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                            SKU: {group.sku}
                          </span>
                          {group.barcode && (
                            <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                              Barra: {group.barcode}
                            </span>
                          )}

                          {/* Badge de Stock */}
                          {group.stock !== null && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[11px] font-semibold flex items-center gap-1',
                                isOut && 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
                                isLow && 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
                                !isOut && !isLow && 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                              )}
                            >
                              {isOut ? 'Agotado (0 u.)' : isLow ? `Stock bajo (${group.stock} / mín ${group.minStock})` : `En stock (${group.stock} u.)`}
                            </Badge>
                          )}

                          <Badge variant="secondary" className="text-[11px] font-bold">
                            {group.offers.length} {group.offers.length === 1 ? 'Proveedor' : 'Proveedores'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Resumen Financiero Lateral */}
                    <div className="flex items-center md:items-end justify-between md:flex-col shrink-0 gap-1 border-t md:border-t-0 pt-3 md:pt-0 border-border/40">
                      <div className="text-left md:text-right">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Mejor Costo de Compra
                        </span>
                        <div className="font-extrabold text-xl sm:text-2xl text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatCurrency(group.minPrice)}
                        </div>
                      </div>

                      {group.salePrice > 0 && marginWithBest !== null && (
                        <div className="text-right">
                          <span className="text-[11px] text-muted-foreground block">
                            PVP: {formatCurrency(group.salePrice)}
                          </span>
                          <span className="text-xs font-bold text-primary tabular-nums">
                            Margen bruto: +{marginWithBest.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Barra Visual de Dispersión de Precios */}
                  {group.offers.length > 1 && (
                    <div className="mt-3.5 pt-3 border-t border-border/40">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5 font-medium">
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mínimo: {formatCurrency(group.minPrice)}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          Más alto: {formatCurrency(group.maxPrice)}
                        </span>
                      </div>
                      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 opacity-80" />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          Ahorro potencial: {group.savingsPercent.toFixed(1)}% ({formatCurrency(group.savingsAmount)} / u.)
                          <span
                            className="text-[10px] text-muted-foreground font-normal px-1.5 py-0.5 rounded bg-muted/60"
                            title="Fórmula: (Costo Más Alto - Costo Mínimo) ÷ Costo Más Alto"
                          >
                            [(Max - Min) ÷ Max]
                          </span>
                        </span>
                        <span>Promedio del mercado: {formatCurrency(group.avgPrice)}</span>
                      </div>
                    </div>
                  )}
                </CardHeader>

                {/* Tabla de Ofertas de Proveedores */}
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 border-b border-border/50">
                        <TableHead className="w-[40px] text-center">#</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>SKU Proveedor</TableHead>
                        <TableHead className="text-right">Costo Unitario</TableHead>
                        <TableHead className="text-right">Diferencia vs Mejor</TableHead>
                        <TableHead className="text-right">Margen Proyectado</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.offers.map((offer, index) => {
                        const diff = offer.unitprice - group.minPrice
                        const percent = group.minPrice > 0 ? (diff / group.minPrice) * 100 : 0
                        const isBestPrice = index === 0
                        const margin = group.salePrice > 0 && offer.unitprice > 0
                          ? ((group.salePrice - offer.unitprice) / group.salePrice) * 100
                          : null

                        return (
                          <TableRow
                            key={offer.id}
                            className={cn(
                              'transition-colors',
                              isBestPrice
                                ? 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08]'
                                : 'hover:bg-muted/30'
                            )}
                          >
                            <TableCell className="text-center font-bold text-xs text-muted-foreground">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">
                                  {offer.suppliers?.name || 'Proveedor sin nombre'}
                                </span>
                                {isBestPrice && (
                                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white h-5 px-1.5 text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
                                    Mejor Precio
                                  </Badge>
                                )}
                              </div>
                              {offer.suppliers?.phone && (
                                <span className="text-[11px] text-muted-foreground block">
                                  Tel: {offer.suppliers.phone}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {offer.suppliersku || '-'}
                            </TableCell>
                            <TableCell className="text-right font-extrabold font-mono text-sm tabular-nums">
                              {formatCurrency(offer.unitprice)}
                            </TableCell>
                            <TableCell className="text-right">
                              {isBestPrice ? (
                                <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-end gap-1 text-xs font-bold">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Mejor opción
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    'inline-flex items-center justify-end gap-1 text-xs font-semibold tabular-nums',
                                    percent > 20
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                  )}
                                >
                                  <TrendingUp className="h-3.5 w-3.5" />
                                  +{percent.toFixed(1)}% (+{formatCurrency(diff)})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold tabular-nums">
                              {margin !== null ? (
                                <span
                                  className={cn(margin >= 30 ? 'text-primary' : 'text-muted-foreground')}
                                  title={`Ganancia bruta: ${formatCurrency(group.salePrice - offer.unitprice)} / u. [(PVP - Costo) ÷ PVP]`}
                                >
                                  +{margin.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={isBestPrice ? 'default' : 'outline'}
                                className="h-8 px-3 text-xs font-bold rounded-lg shadow-2xs"
                                onClick={() => handleCreateOrder(offer)}
                              >
                                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                                Pedir
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── 5. Modal de Creación de Orden de Compra ── */}
      {orderSupplier && (
        <CreateOrderModal
          isOpen={orderModalOpen}
          onClose={() => setOrderModalOpen(false)}
          supplierId={orderSupplier.id}
          supplierName={orderSupplier.name}
          onOrderCreated={() => {
            setOrderModalOpen(false)
            toast.success(`Orden de compra iniciada con ${orderSupplier.name}`)
            void fetchProducts()
          }}
          initialProduct={orderProduct}
        />
      )}
    </div>
  )
}

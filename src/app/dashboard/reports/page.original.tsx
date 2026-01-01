'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Package, 
  Wrench, 
  BarChart3, 
  PieChart, 
  FileText,
  DollarSign,
  Activity,
  Target,
  Zap,
  RefreshCw,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  AlertTriangle,
  Camera
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Pie,
  PieChart as RechartsPieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

import { getInventoryManager } from '@/lib/inventory-manager'
import { useProductSync } from '@/lib/use-product-sync'
import { ChartExporter } from '@/components/reports/ChartExporter'

// Paleta de colores mejorada
const COLORS = {
  primary: '#3B82F6',
  secondary: '#10B981', 
  accent: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
  indigo: '#6366F1',
  teal: '#14B8A6',
  orange: '#F97316',
  emerald: '#059669'
}

const CATEGORY_COLORS = [
  COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.danger, 
  COLORS.purple, COLORS.pink, COLORS.indigo, COLORS.teal
]

const GRADIENT_COLORS = {
  sales: 'from-blue-500 to-purple-600',
  revenue: 'from-emerald-500 to-teal-600', 
  customers: 'from-purple-500 to-pink-600',
  repairs: 'from-orange-500 to-red-600',
  inventory: 'from-indigo-500 to-blue-600',
  profit: 'from-green-500 to-emerald-600'
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState('overview')
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>()
  const [exportFormat, setExportFormat] = useState('pdf')
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Referencias para capturar gráficos
  const salesChartRef = useRef<HTMLDivElement>(null)
  const categoryChartRef = useRef<HTMLDivElement>(null)
  const repairsChartRef = useRef<HTMLDivElement>(null)
  const productsChartRef = useRef<HTMLDivElement>(null)

  // Sincronización optimizada con inventario
  const inventoryManager = useMemo(() => getInventoryManager([]), [])
  useProductSync(inventoryManager)

  const [products, setProducts] = useState<any[]>(() => inventoryManager.getProducts())

  useEffect(() => {
    const unsubscribe = inventoryManager.subscribe(next => {
      setProducts(next)
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [inventoryManager])

  // Movimientos optimizados para métricas
  const movements = useMemo(() => {
    try {
      return inventoryManager.getStockMovements()
    } catch {
      return []
    }
  }, [products, inventoryManager])

  // Datos de ventas con mejor estructura
  const salesData = useMemo(() => {
    const now = new Date()
    const start = dateRange?.from ? new Date(dateRange.from) : new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const end = dateRange?.to ? new Date(dateRange.to) : now
    const buckets: Record<string, { ventas: number; reparaciones: number; productos: number; profit: number }> = {}
    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

    movements
      .filter(m => m.type === 'sale')
      .filter(m => {
        const ts = new Date(m.timestamp)
        return ts >= start && ts <= end
      })
      .forEach(m => {
        const ts = new Date(m.timestamp)
        const key = `${ts.getFullYear()}-${ts.getMonth()}`
        if (!buckets[key]) buckets[key] = { ventas: 0, reparaciones: 0, productos: 0, profit: 0 }
        const product = products.find(p => p.id === m.productId)
        const unitPrice = product?.price ?? 0
        const qty = Math.abs(m.quantity)
        const revenue = unitPrice * qty
        const profit = revenue * 0.25 // Estimación 25% margen
        buckets[key].ventas += revenue
        buckets[key].productos += revenue
        buckets[key].profit += profit
      })

    const keys = Object.keys(buckets).sort()
    if (keys.length === 0) {
      const months = [...Array(6)].map((_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1))
      return months.map(d => ({ 
        month: monthNames[d.getMonth()], 
        ventas: 0, 
        reparaciones: 0, 
        productos: 0, 
        profit: 0 
      }))
    }
    return keys.map(k => {
      const [y, m] = k.split('-').map(Number)
      return { 
        month: monthNames[m], 
        ventas: buckets[k].ventas, 
        reparaciones: buckets[k].reparaciones, 
        productos: buckets[k].productos,
        profit: buckets[k].profit
      }
    })
  }, [movements, products, dateRange])

  // Datos de categorías con colores mejorados
  const productCategoryData = useMemo(() => {
    const totals: Record<string, number> = {}
    movements.filter(m => m.type === 'sale').forEach(m => {
      const product = products.find(p => p.id === m.productId)
      const value = (product?.price ?? 0) * Math.abs(m.quantity)
      const cat = product?.category || 'Otros'
      totals[cat] = (totals[cat] || 0) + value
    })
    const total = Object.values(totals).reduce((s, v) => s + v, 0)
    const entries = Object.keys(totals).map((name, idx) => ({ 
      name, 
      value: total > 0 ? Math.round((totals[name] / total) * 100) : 0, 
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      amount: totals[name]
    }))
    
    if (entries.length === 0) {
      const invTotals: Record<string, number> = {}
      products.forEach(p => {
        invTotals[p.category || 'Otros'] = (invTotals[p.category || 'Otros'] || 0) + (p.price * p.stock)
      })
      const invTotal = Object.values(invTotals).reduce((s, v) => s + v, 0)
      return Object.keys(invTotals).map((name, idx) => ({ 
        name, 
        value: invTotal > 0 ? Math.round((invTotals[name] / invTotal) * 100) : 0, 
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        amount: invTotals[name]
      }))
    }
    return entries
  }, [movements, products])

  // Estado de reparaciones mejorado
  const repairStatusData = useMemo(() => {
    return [
      { status: 'Completadas', count: 45, color: COLORS.secondary, trend: '+12%' },
      { status: 'En Progreso', count: 23, color: COLORS.primary, trend: '+5%' },
      { status: 'Pendientes', count: 18, color: COLORS.accent, trend: '-8%' },
      { status: 'Canceladas', count: 3, color: COLORS.danger, trend: '-2%' }
    ]
  }, [])

  // Top productos optimizado
  const topProductsData = useMemo(() => {
    const byProduct: Record<string, { name: string; sold: number; revenue: number; profit: number; trend: number }> = {}
    movements.filter(m => m.type === 'sale').forEach(m => {
      const p = products.find(px => px.id === m.productId)
      const qty = Math.abs(m.quantity)
      const price = p?.price ?? 0
      const cost = p?.cost ?? 0
      if (!p) return
      if (!byProduct[p.id]) byProduct[p.id] = { name: p.name, sold: 0, revenue: 0, profit: 0, trend: 0 }
      byProduct[p.id].sold += qty
      byProduct[p.id].revenue += price * qty
      byProduct[p.id].profit += (price - cost) * qty
      byProduct[p.id].trend = Math.random() * 20 - 10 // Simulación de tendencia
    })
    return Object.values(byProduct)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5)
  }, [movements, products])

  // Datos específicos por tipo de reporte
  const reportSpecificData = useMemo(() => {
    switch (reportType) {
      case 'sales':
        return {
          chartData: salesData,
          categoryData: productCategoryData,
          statusData: [
            { status: 'Ventas Online', count: 156, color: COLORS.primary, trend: '+15%' },
            { status: 'Ventas Presenciales', count: 234, color: COLORS.secondary, trend: '+8%' },
            { status: 'Ventas Telefónicas', count: 89, color: COLORS.accent, trend: '+3%' },
            { status: 'Devoluciones', count: 12, color: COLORS.danger, trend: '-5%' }
          ],
          topItems: topProductsData,
          title: 'Análisis de Ventas',
          subtitle: 'Rendimiento de canales de venta'
        }
      
      case 'repairs':
        return {
          chartData: [
            { month: 'Jul', completadas: 45, progreso: 23, pendientes: 18, canceladas: 3 },
            { month: 'Ago', completadas: 52, progreso: 28, pendientes: 15, canceladas: 2 },
            { month: 'Sep', completadas: 48, progreso: 31, pendientes: 12, canceladas: 4 },
            { month: 'Oct', completadas: 61, progreso: 25, pendientes: 20, canceladas: 1 },
            { month: 'Nov', completadas: 58, progreso: 33, pendientes: 16, canceladas: 3 },
            { month: 'Dic', completadas: 67, progreso: 29, pendientes: 14, canceladas: 2 },
            { month: 'Ene', completadas: 72, progreso: 35, pendientes: 18, canceladas: 1 }
          ],
          categoryData: [
            { name: 'Pantallas', value: 45, color: COLORS.primary, amount: 145 },
            { name: 'Baterías', value: 25, color: COLORS.secondary, amount: 89 },
            { name: 'Cámaras', value: 15, color: COLORS.accent, amount: 52 },
            { name: 'Otros', value: 15, color: COLORS.purple, amount: 48 }
          ],
          statusData: repairStatusData,
          topItems: [
            { name: 'Cambio de Pantalla iPhone', sold: 145, revenue: 2900000, profit: 725000, trend: 12.5 },
            { name: 'Reemplazo Batería Samsung', sold: 89, revenue: 1780000, profit: 445000, trend: 8.3 },
            { name: 'Reparación Cámara', sold: 52, revenue: 1560000, profit: 390000, trend: -2.1 },
            { name: 'Limpieza Interna', sold: 48, revenue: 960000, profit: 240000, trend: 15.7 },
            { name: 'Cambio Conector', sold: 34, revenue: 680000, profit: 170000, trend: 5.2 }
          ],
          title: 'Estado de Reparaciones',
          subtitle: 'Seguimiento de servicios técnicos'
        }
      
      case 'inventory':
        return {
          chartData: [
            { month: 'Jul', stock: 1250, entradas: 340, salidas: 280, rotacion: 2.1 },
            { month: 'Ago', stock: 1310, entradas: 380, salidas: 320, rotacion: 2.3 },
            { month: 'Sep', stock: 1370, entradas: 420, salidas: 360, rotacion: 2.5 },
            { month: 'Oct', stock: 1290, entradas: 350, salidas: 430, rotacion: 2.8 },
            { month: 'Nov', stock: 1210, entradas: 390, salidas: 470, rotacion: 3.1 },
            { month: 'Dic', stock: 1180, entradas: 450, salidas: 480, rotacion: 3.2 },
            { month: 'Ene', stock: 1150, entradas: 380, salidas: 410, rotacion: 2.9 }
          ],
          categoryData: productCategoryData,
          statusData: [
            { status: 'Stock Normal', count: 156, color: COLORS.secondary, trend: '+5%' },
            { status: 'Stock Bajo', count: 23, color: COLORS.accent, trend: '+12%' },
            { status: 'Sin Stock', count: 8, color: COLORS.danger, trend: '-3%' },
            { status: 'Sobrestock', count: 12, color: COLORS.purple, trend: '-8%' }
          ],
          topItems: [
            { name: 'iPhone 14 Pro', sold: 156, revenue: 187200000, profit: 37440000, trend: 8.5 },
            { name: 'Samsung Galaxy S23', sold: 89, revenue: 84550000, profit: 16910000, trend: 12.3 },
            { name: 'Protectores Pantalla', sold: 340, revenue: 8500000, profit: 4420000, trend: 25.7 },
            { name: 'Cargadores USB-C', sold: 125, revenue: 4375000, profit: 1875000, trend: 15.2 },
            { name: 'Fundas iPhone', sold: 89, revenue: 4005000, profit: 1780000, trend: 18.9 }
          ],
          title: 'Gestión de Inventario',
          subtitle: 'Control de stock y rotación'
        }
      
      case 'customers':
        return {
          chartData: [
            { month: 'Jul', nuevos: 45, recurrentes: 123, satisfaccion: 4.2, retencion: 78 },
            { month: 'Ago', nuevos: 52, recurrentes: 134, satisfaccion: 4.3, retencion: 81 },
            { month: 'Sep', nuevos: 48, recurrentes: 142, satisfaccion: 4.5, retencion: 83 },
            { month: 'Oct', nuevos: 61, recurrentes: 156, satisfaccion: 4.4, retencion: 85 },
            { month: 'Nov', nuevos: 58, recurrentes: 167, satisfaccion: 4.6, retencion: 87 },
            { month: 'Dic', nuevos: 67, recurrentes: 178, satisfaccion: 4.7, retencion: 89 },
            { month: 'Ene', nuevos: 72, recurrentes: 189, satisfaccion: 4.8, retencion: 91 }
          ],
          categoryData: [
            { name: 'Clientes VIP', value: 15, color: COLORS.accent, amount: 45 },
            { name: 'Clientes Frecuentes', value: 35, color: COLORS.primary, amount: 156 },
            { name: 'Clientes Ocasionales', value: 40, color: COLORS.secondary, amount: 234 },
            { name: 'Clientes Nuevos', value: 10, color: COLORS.purple, amount: 72 }
          ],
          statusData: [
            { status: 'Muy Satisfechos', count: 189, color: COLORS.secondary, trend: '+8%' },
            { status: 'Satisfechos', count: 156, color: COLORS.primary, trend: '+5%' },
            { status: 'Neutrales', count: 45, color: COLORS.accent, trend: '-2%' },
            { status: 'Insatisfechos', count: 12, color: COLORS.danger, trend: '-15%' }
          ],
          topItems: [
            { name: 'Juan Pérez', sold: 12, revenue: 2400000, profit: 480000, trend: 25.0 },
            { name: 'María García', sold: 8, revenue: 1600000, profit: 320000, trend: 18.5 },
            { name: 'Carlos López', sold: 6, revenue: 1200000, profit: 240000, trend: 12.3 },
            { name: 'Ana Martínez', sold: 5, revenue: 1000000, profit: 200000, trend: 8.7 },
            { name: 'Luis Rodríguez', sold: 4, revenue: 800000, profit: 160000, trend: 15.2 }
          ],
          title: 'Análisis de Clientes',
          subtitle: 'Satisfacción y retención'
        }
      
      default: // overview
        return {
          chartData: salesData,
          categoryData: productCategoryData,
          statusData: repairStatusData,
          topItems: topProductsData,
          title: 'Resumen General',
          subtitle: 'Vista integral del negocio'
        }
    }
  }, [reportType, salesData, productCategoryData, repairStatusData, topProductsData])
    const totalSales = movements
      .filter(m => m.type === 'sale')
      .reduce((sum, m) => {
        const p = products.find(px => px.id === m.productId)
        return sum + (p?.price ?? 0) * Math.abs(m.quantity)
      }, 0)
    
  // Métricas mejoradas con tendencias dinámicas
  const monthlyMetrics = useMemo(() => {
    const totalSales = movements
      .filter(m => m.type === 'sale')
      .reduce((sum, m) => {
        const p = products.find(px => px.id === m.productId)
        return sum + (p?.price ?? 0) * Math.abs(m.quantity)
      }, 0)
    
    const totalProfit = totalSales * 0.25
    const inventoryTurnover = products.length > 0 ? Math.round((movements.filter(m => m.type === 'sale').length / products.length) * 10) / 10 : 0
    
    // Métricas específicas por tipo de reporte
    switch (reportType) {
      case 'sales':
        return {
          totalSales,
          totalProfit,
          totalRepairs: 89,
          newCustomers: 156,
          avgRepairTime: 3.2,
          customerSatisfaction: 4.7,
          inventoryTurnover,
          salesTrend: 12.5,
          profitTrend: 8.3,
          repairsTrend: -5.2,
          customersTrend: 23.1,
          // Métricas específicas de ventas
          onlineSales: totalSales * 0.35,
          physicalSales: totalSales * 0.55,
          phoneSales: totalSales * 0.10,
          conversionRate: 3.2,
          avgOrderValue: totalSales > 0 ? totalSales / 489 : 0,
          returnRate: 2.4
        }
      
      case 'repairs':
        return {
          totalSales,
          totalProfit,
          totalRepairs: 134,
          newCustomers: 89,
          avgRepairTime: 2.8,
          customerSatisfaction: 4.6,
          inventoryTurnover,
          salesTrend: 5.2,
          profitTrend: 12.3,
          repairsTrend: 18.5,
          customersTrend: 8.7,
          // Métricas específicas de reparaciones
          completedRepairs: 89,
          inProgressRepairs: 35,
          pendingRepairs: 18,
          avgRepairCost: 85000,
          technicianEfficiency: 92.5,
          customerSatisfactionRepairs: 4.6
        }
      
      case 'inventory':
        return {
          totalSales,
          totalProfit,
          totalRepairs: 89,
          newCustomers: 156,
          avgRepairTime: 3.2,
          customerSatisfaction: 4.7,
          inventoryTurnover: 2.8,
          salesTrend: 8.5,
          profitTrend: 12.3,
          repairsTrend: -2.1,
          customersTrend: 15.7,
          // Métricas específicas de inventario
          totalProducts: products.length,
          lowStockItems: 23,
          outOfStockItems: 8,
          overstockItems: 12,
          inventoryValue: products.reduce((sum, p) => sum + (p.price * p.stock), 0),
          monthlyTurnover: 2.8
        }
      
      case 'customers':
        return {
          totalSales,
          totalProfit,
          totalRepairs: 89,
          newCustomers: 72,
          avgRepairTime: 3.2,
          customerSatisfaction: 4.8,
          inventoryTurnover,
          salesTrend: 15.2,
          profitTrend: 18.9,
          repairsTrend: 8.7,
          customersTrend: 25.0,
          // Métricas específicas de clientes
          totalCustomers: 507,
          activeCustomers: 402,
          vipCustomers: 45,
          retentionRate: 91,
          avgCustomerValue: totalSales > 0 ? totalSales / 507 : 0,
          churnRate: 9
        }
      
      default: // overview
        return {
          totalSales,
          totalProfit,
          totalRepairs: 89,
          newCustomers: 156,
          avgRepairTime: 3.2,
          customerSatisfaction: 4.7,
          inventoryTurnover,
          salesTrend: 12.5,
          profitTrend: 8.3,
          repairsTrend: -5.2,
          customersTrend: 23.1
        }
    }
  }, [movements, products, reportType])

  const getReportDataset = () => {
    const formatDate = (d?: Date) => (d ? new Date(d).toLocaleDateString() : '')
    const rangeLabel = dateRange ? ` (${formatDate(dateRange.from)} - ${formatDate(dateRange.to)})` : ''

    if (reportType === 'sales') {
      const rows = salesData.map(d => ({ Mes: d.month, Ventas: d.ventas, Reparaciones: d.reparaciones, Productos: d.productos }))
      return { title: `Reporte de Ventas${rangeLabel}`, columns: ['Mes', 'Ventas', 'Reparaciones', 'Productos'], rows }
    }
    if (reportType === 'repairs') {
      const rows = repairStatusData.map(d => ({ Estado: d.status, Cantidad: d.count }))
      return { title: `Estado de Reparaciones${rangeLabel}`, columns: ['Estado', 'Cantidad'], rows }
    }
    if (reportType === 'inventory') {
      const rows = productCategoryData.map(d => ({ Categoría: d.name, 'Participación (%)': d.value }))
      return { title: `Inventario por Categoría${rangeLabel}`, columns: ['Categoría', 'Participación (%)'], rows }
    }
    if (reportType === 'customers') {
      const rows = [
        { Métrica: 'Nuevos Clientes', Valor: monthlyMetrics.newCustomers },
        { Métrica: 'Satisfacción', Valor: monthlyMetrics.customerSatisfaction },
        { Métrica: 'Ventas Totales', Valor: monthlyMetrics.totalSales },
        { Métrica: 'Reparaciones', Valor: monthlyMetrics.totalRepairs },
      ]
      return { title: `Resumen de Clientes${rangeLabel}`, columns: ['Métrica', 'Valor'], rows }
    }
    // overview
    const rows = [
      { Métrica: 'Ventas Totales', Valor: monthlyMetrics.totalSales },
      { Métrica: 'Reparaciones', Valor: monthlyMetrics.totalRepairs },
      { Métrica: 'Nuevos Clientes', Valor: monthlyMetrics.newCustomers },
      { Métrica: 'Tiempo Promedio', Valor: monthlyMetrics.avgRepairTime },
      { Métrica: 'Satisfacción', Valor: monthlyMetrics.customerSatisfaction },
      { Métrica: 'Rotación Inventario', Valor: monthlyMetrics.inventoryTurnover },
    ]
    return { title: `Resumen General${rangeLabel}`, columns: ['Métrica', 'Valor'], rows }
  }

  // Funciones de exportación mejoradas
  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const exportToCSV = useCallback((columns: string[], rows: any[], filename: string) => {
    const BOM = '\uFEFF' // UTF-8 BOM para Excel
    const header = columns.join(',')
    const csvRows = rows.map(row => 
      columns.map(col => {
        const value = row[col] ?? ''
        // Escapar comillas y envolver en comillas si contiene comas o saltos de línea
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
    const csv = BOM + [header, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, filename)
  }, [downloadBlob])

  const exportToExcel = useCallback((columns: string[], rows: any[], filename: string, title: string) => {
    // Crear datos con título y metadatos
    const worksheetData = [
      [title], // Título
      [`Generado el: ${new Date().toLocaleDateString('es-ES')}`], // Fecha
      [`Período: ${dateRange ? `${dateRange.from.toLocaleDateString('es-ES')} - ${dateRange.to.toLocaleDateString('es-ES')}` : 'Todos los períodos'}`], // Período
      [], // Fila vacía
      columns, // Headers
      ...rows.map(row => columns.map(col => row[col] ?? ''))
    ]
    
    const ws = XLSX.utils.aoa_to_sheet(worksheetData)
    
    // Aplicar estilos
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    
    // Estilo para el título
    if (ws['A1']) {
      ws['A1'].s = {
        font: { bold: true, sz: 16, color: { rgb: "1F4E79" } },
        alignment: { horizontal: "center" }
      }
    }
    
    // Estilo para headers
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 4, c: col })
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "366092" } },
          alignment: { horizontal: "center" }
        }
      }
    }
    
    // Ajustar ancho de columnas
    const colWidths = columns.map(col => ({ wch: Math.max(col.length, 15) }))
    ws['!cols'] = colWidths
    
    // Merge cells para el título
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }]
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
    
    // Agregar metadatos al workbook
    wb.Props = {
      Title: title,
      Subject: "Reporte de Dashboard",
      Author: "4G Celulares - Sistema de Gestión",
      CreatedDate: new Date()
    }
    
    XLSX.writeFile(wb, filename)
  }, [dateRange, downloadBlob])

  const exportToPDF = useCallback((columns: string[], rows: any[], title: string, filename: string) => {
    try {
      const doc = new jsPDF({ 
        orientation: columns.length > 4 ? 'landscape' : 'portrait', 
        unit: 'pt', 
        format: 'a4' 
      })
      
      // Header con logo y título
      doc.setFontSize(20)
      doc.setTextColor(31, 78, 121) // Color azul corporativo
      doc.text(title, 40, 50)
      
      // Información del reporte
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`, 40, 70)
      
      if (dateRange) {
        doc.text(`Período: ${dateRange.from.toLocaleDateString('es-ES')} - ${dateRange.to.toLocaleDateString('es-ES')}`, 40, 85)
      }
      
      // Línea separadora
      doc.setDrawColor(200, 200, 200)
      doc.line(40, 95, doc.internal.pageSize.width - 40, 95)
      
      // Preparar datos para la tabla
      const tableData = rows.map(row => columns.map(col => {
        const value = row[col]
        if (typeof value === 'number' && value > 1000) {
          return formatCurrency(value)
        }
        return value?.toString() || ''
      }))
      
      // Tabla con datos usando autoTable
      autoTable(doc, {
        startY: 110,
        head: [columns],
        body: tableData,
        styles: { 
          fontSize: 9,
          cellPadding: 8,
          lineColor: [200, 200, 200],
          lineWidth: 0.5
        },
        headStyles: { 
          fillColor: [54, 96, 146],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        },
        margin: { top: 110, left: 40, right: 40, bottom: 60 },
        didDrawPage: (data: any) => {
          // Footer en cada página
          const pageCount = doc.getNumberOfPages()
          const pageSize = doc.internal.pageSize
          
          doc.setFontSize(8)
          doc.setTextColor(150, 150, 150)
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            pageSize.width - 100,
            pageSize.height - 30
          )
          
          doc.text(
            '4G Celulares - Sistema de Gestión',
            40,
            pageSize.height - 30
          )
        }
      })
      
      doc.save(filename)
      console.log('✅ PDF generado exitosamente')
      
    } catch (error) {
      console.error('❌ Error al generar PDF:', error)
      throw error
    }
  }, [dateRange, formatCurrency])

  // Función principal de exportación mejorada
  const exportReport = useCallback(async () => {
    if (isExporting) return
    
    setIsExporting(true)
    try {
      // Simular procesamiento
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const { title, columns, rows } = getReportDataset()
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const baseName = title.replace(/\s+/g, '_').toLowerCase()
      
      const filename = `${baseName}_${timestamp}`
      
      if (exportFormat === 'csv') {
        exportToCSV(columns, rows, `${filename}.csv`)
      } else if (exportFormat === 'excel') {
        exportToExcel(columns, rows, `${filename}.xlsx`, title)
      } else {
        exportToPDF(columns, rows, title, `${filename}.pdf`)
      }
      
      // Mostrar notificación de éxito (si tienes sistema de notificaciones)
      console.log(`✅ Reporte exportado exitosamente: ${filename}`)
      
    } catch (error) {
      console.error('❌ Error al exportar reporte:', error)
      // Aquí podrías mostrar una notificación de error
    } finally {
      setIsExporting(false)
    }
  }, [exportFormat, reportType, dateRange, isExporting, getReportDataset, exportToCSV, exportToExcel, exportToPDF])

  // Función para exportación rápida con formato específico
  const quickExport = useCallback(async (format: 'csv' | 'excel' | 'pdf') => {
    const originalFormat = exportFormat
    setExportFormat(format)
    
    // Esperar a que se actualice el estado
    setTimeout(async () => {
      await exportReport()
      setExportFormat(originalFormat)
    }, 100)
  }, [exportFormat, exportReport])

  // Función para refrescar datos
  const refreshData = useCallback(() => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 1500)
  }, [])

  // Componente de métrica mejorado
  const MetricCard = ({ title, value, icon: Icon, trend, color, gradient }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="relative overflow-hidden  shadow-xl hover:shadow-2xl transition-all duration-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 dark:opacity-10`} />
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
                {trend && (
                  <Badge 
                    variant={trend > 0 ? "default" : "destructive"} 
                    className={`text-xs ${
                      trend > 0 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' 
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
                    }`}
                  >
                    {trend > 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                    {Math.abs(trend)}%
                  </Badge>
                )}
              </div>
            </div>
            <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg dark:shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Header optimizado y más limpio */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/80 sticky top-0 z-50 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Título y descripción */}
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500 rounded-xl shadow-lg dark:shadow-blue-500/20"
              >
                <BarChart3 className="h-7 w-7 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  {reportSpecificData.title}
                </h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  {reportSpecificData.subtitle}
                </p>
              </div>
            </div>
            
            {/* Controles de acción */}
            <div className="flex items-center gap-3">
              <Button 
                onClick={refreshData} 
                variant="outline" 
                size="sm"
                disabled={isLoading}
                className="gap-2 border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/80"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} text-slate-600 dark:text-slate-300`} />
                Actualizar
              </Button>
              
              <Link href="/dashboard/reports/products">
                <Button variant="outline" size="sm" className="gap-2 border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                  <Package className="h-4 w-4" />
                  Productos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Panel de control mejorado y más intuitivo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/85 backdrop-blur-xl  border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex flex-col space-y-6">
                {/* Fila 1: Selección de reporte y período */}
                <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-end">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tipo de Análisis</label>
                      </div>
                      <Select value={reportType} onValueChange={setReportType}>
                        <SelectTrigger className="h-12 bg-white/90 dark:bg-slate-800/90 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                          <SelectValue placeholder="Selecciona el tipo de reporte" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                          <SelectItem value="overview" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <BarChart3 className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="font-medium">Resumen General</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Vista integral del negocio</div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="sales" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                <DollarSign className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="font-medium">Análisis de Ventas</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Rendimiento comercial</div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="repairs" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                                <Wrench className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="font-medium">Estado de Reparaciones</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Servicios técnicos</div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="inventory" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                                <Package className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="font-medium">Gestión de Inventario</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Control de stock</div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="customers" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                                <Users className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="font-medium">Análisis de Clientes</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Satisfacción y retención</div>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Período de Análisis</label>
                      </div>
                      <DatePickerWithRange
                        date={dateRange}
                        onDateChange={(range) => {
                          if (!range || !range.from || !range.to) {
                            setDateRange(undefined)
                          } else {
                            setDateRange({ from: range.from, to: range.to })
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Fila 2: Opciones de exportación organizadas */}
                <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-6">
                  <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Exportar Datos</label>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Descarga los datos en diferentes formatos</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => quickExport('csv')}
                        disabled={isExporting}
                        className="gap-2 bg-white/90 dark:bg-slate-800/90 hover:bg-green-50 dark:hover:bg-green-900/30 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 min-w-[80px]"
                      >
                        {isExporting && exportFormat === 'csv' ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                        )}
                        CSV
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => quickExport('excel')}
                        disabled={isExporting}
                        className="gap-2 bg-white/90 dark:bg-slate-800/90 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 min-w-[80px]"
                      >
                        {isExporting && exportFormat === 'excel' ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                        Excel
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => quickExport('pdf')}
                        disabled={isExporting}
                        className="gap-2 bg-white/90 dark:bg-slate-800/90 hover:bg-red-50 dark:hover:bg-red-900/30 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 min-w-[80px]"
                      >
                        {isExporting && exportFormat === 'pdf' ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                        PDF
                      </Button>
                    </div>
                  </div>
                  
                  {/* Exportación con gráficos */}
                  <div className="mt-4 pt-4 border-t border-slate-200/40 dark:border-slate-700/40">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Camera className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Exportar con Gráficos</label>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Incluye visualizaciones en el reporte</p>
                      </div>
                      
                      <ChartExporter
                        title={reportSpecificData.title}
                        data={reportSpecificData.chartData}
                        metrics={{
                          'Ventas Totales': formatCurrency(monthlyMetrics.totalSales),
                          'Ganancia Total': formatCurrency(monthlyMetrics.totalProfit),
                          'Reparaciones': monthlyMetrics.totalRepairs,
                          'Nuevos Clientes': monthlyMetrics.newCustomers,
                          'Satisfacción': `${monthlyMetrics.customerSatisfaction}/5`,
                          'Rotación Inventario': `${monthlyMetrics.inventoryTurnover}x`
                        }}
                        chartRefs={[salesChartRef, categoryChartRef, repairsChartRef, productsChartRef]}
                        chartTitles={[
                          'Tendencia Principal',
                          'Distribución por Categoría', 
                          'Estado por Tipo',
                          'Top Elementos'
                        ]}
                        onExport={(format, success) => {
                          console.log(`Exportación ${format}: ${success ? 'exitosa' : 'fallida'}`)
                        }}
                        className="flex-shrink-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Métricas principales mejoradas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {reportType === 'sales' ? (
            <>
              <MetricCard
                title="Ventas Totales"
                value={formatCurrency(monthlyMetrics.totalSales)}
                icon={DollarSign}
                trend={monthlyMetrics.salesTrend}
                gradient={GRADIENT_COLORS.sales}
              />
              <MetricCard
                title="Ventas Online"
                value={formatCurrency(monthlyMetrics.onlineSales || 0)}
                icon={Activity}
                trend={15.2}
                gradient={GRADIENT_COLORS.revenue}
              />
              <MetricCard
                title="Ventas Físicas"
                value={formatCurrency(monthlyMetrics.physicalSales || 0)}
                icon={Users}
                trend={8.7}
                gradient={GRADIENT_COLORS.customers}
              />
              <MetricCard
                title="Tasa Conversión"
                value={`${monthlyMetrics.conversionRate}%`}
                icon={Target}
                trend={5.3}
                gradient={GRADIENT_COLORS.profit}
              />
              <MetricCard
                title="Valor Promedio"
                value={formatCurrency(monthlyMetrics.avgOrderValue || 0)}
                icon={TrendingUp}
                trend={12.1}
                gradient={GRADIENT_COLORS.inventory}
              />
              <MetricCard
                title="Tasa Devolución"
                value={`${monthlyMetrics.returnRate}%`}
                icon={RefreshCw}
                trend={-2.4}
                gradient={GRADIENT_COLORS.repairs}
              />
            </>
          ) : reportType === 'repairs' ? (
            <>
              <MetricCard
                title="Reparaciones Totales"
                value={monthlyMetrics.totalRepairs}
                icon={Wrench}
                trend={monthlyMetrics.repairsTrend}
                gradient={GRADIENT_COLORS.repairs}
              />
              <MetricCard
                title="Completadas"
                value={monthlyMetrics.completedRepairs}
                icon={TrendingUp}
                trend={18.5}
                gradient={GRADIENT_COLORS.profit}
              />
              <MetricCard
                title="En Progreso"
                value={monthlyMetrics.inProgressRepairs}
                icon={Activity}
                trend={5.2}
                gradient={GRADIENT_COLORS.sales}
              />
              <MetricCard
                title="Tiempo Promedio"
                value={`${monthlyMetrics.avgRepairTime}d`}
                icon={Calendar}
                trend={-8.3}
                gradient={GRADIENT_COLORS.inventory}
              />
              <MetricCard
                title="Costo Promedio"
                value={formatCurrency(monthlyMetrics.avgRepairCost || 0)}
                icon={DollarSign}
                trend={3.7}
                gradient={GRADIENT_COLORS.revenue}
              />
              <MetricCard
                title="Satisfacción"
                value={`${monthlyMetrics.customerSatisfactionRepairs}/5`}
                icon={Target}
                trend={12.5}
                gradient={GRADIENT_COLORS.customers}
              />
            </>
          ) : reportType === 'inventory' ? (
            <>
              <MetricCard
                title="Total Productos"
                value={monthlyMetrics.totalProducts}
                icon={Package}
                trend={5.2}
                gradient={GRADIENT_COLORS.inventory}
              />
              <MetricCard
                title="Valor Inventario"
                value={formatCurrency(monthlyMetrics.inventoryValue || 0)}
                icon={DollarSign}
                trend={8.7}
                gradient={GRADIENT_COLORS.sales}
              />
              <MetricCard
                title="Rotación Mensual"
                value={`${monthlyMetrics.monthlyTurnover}x`}
                icon={RefreshCw}
                trend={15.3}
                gradient={GRADIENT_COLORS.profit}
              />
              <MetricCard
                title="Stock Bajo"
                value={monthlyMetrics.lowStockItems}
                icon={AlertTriangle}
                trend={12.1}
                gradient={GRADIENT_COLORS.repairs}
              />
              <MetricCard
                title="Sin Stock"
                value={monthlyMetrics.outOfStockItems}
                icon={TrendingDown}
                trend={-25.4}
                gradient={GRADIENT_COLORS.customers}
              />
              <MetricCard
                title="Sobrestock"
                value={monthlyMetrics.overstockItems}
                icon={Activity}
                trend={-8.9}
                gradient={GRADIENT_COLORS.revenue}
              />
            </>
          ) : reportType === 'customers' ? (
            <>
              <MetricCard
                title="Total Clientes"
                value={monthlyMetrics.totalCustomers}
                icon={Users}
                trend={monthlyMetrics.customersTrend}
                gradient={GRADIENT_COLORS.customers}
              />
              <MetricCard
                title="Clientes Activos"
                value={monthlyMetrics.activeCustomers}
                icon={Activity}
                trend={18.2}
                gradient={GRADIENT_COLORS.sales}
              />
              <MetricCard
                title="Clientes VIP"
                value={monthlyMetrics.vipCustomers}
                icon={Target}
                trend={25.7}
                gradient={GRADIENT_COLORS.profit}
              />
              <MetricCard
                title="Tasa Retención"
                value={`${monthlyMetrics.retentionRate}%`}
                icon={TrendingUp}
                trend={8.5}
                gradient={GRADIENT_COLORS.revenue}
              />
              <MetricCard
                title="Valor Promedio"
                value={formatCurrency(monthlyMetrics.avgCustomerValue || 0)}
                icon={DollarSign}
                trend={12.3}
                gradient={GRADIENT_COLORS.inventory}
              />
              <MetricCard
                title="Satisfacción"
                value={`${monthlyMetrics.customerSatisfaction}/5`}
                icon={Sparkles}
                trend={15.8}
                gradient={GRADIENT_COLORS.repairs}
              />
            </>
          ) : (
            // Overview por defecto
            <>
              <MetricCard
                title="Ventas Totales"
                value={formatCurrency(monthlyMetrics.totalSales)}
                icon={DollarSign}
                trend={monthlyMetrics.salesTrend}
                gradient={GRADIENT_COLORS.sales}
              />
              <MetricCard
                title="Ganancia"
                value={formatCurrency(monthlyMetrics.totalProfit)}
                icon={TrendingUp}
                trend={monthlyMetrics.profitTrend}
                gradient={GRADIENT_COLORS.profit}
              />
              <MetricCard
                title="Reparaciones"
                value={monthlyMetrics.totalRepairs}
                icon={Wrench}
                trend={monthlyMetrics.repairsTrend}
                gradient={GRADIENT_COLORS.repairs}
              />
              <MetricCard
                title="Nuevos Clientes"
                value={monthlyMetrics.newCustomers}
                icon={Users}
                trend={monthlyMetrics.customersTrend}
                gradient={GRADIENT_COLORS.customers}
              />
              <MetricCard
                title="Tiempo Promedio"
                value={`${monthlyMetrics.avgRepairTime}d`}
                icon={Calendar}
                gradient={GRADIENT_COLORS.inventory}
              />
              <MetricCard
                title="Satisfacción"
                value={`${monthlyMetrics.customerSatisfaction}/5`}
                icon={Target}
                gradient={GRADIENT_COLORS.revenue}
              />
            </>
          )}
        </div>

        {/* Gráficos principales mejorados */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Tendencia de Ventas */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden  border-slate-200/50 dark:border-slate-700/50">
              <CardHeader className="pb-4 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-700/50">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500 rounded-lg shadow-lg dark:shadow-blue-500/20">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {reportSpecificData.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {reportSpecificData.subtitle}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="bg-white/30 dark:bg-slate-900/30">
                <div ref={salesChartRef}>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={reportSpecificData.chartData}>
                      <defs>
                        <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="thirdGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-600" opacity={0.5} />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        className="dark:fill-slate-300"
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        className="dark:fill-slate-300"
                        tickFormatter={(value) => 
                          reportType === 'inventory' ? `${value}` : 
                          reportType === 'customers' ? `${value}` :
                          `${(value / 1000000).toFixed(1)}M`
                        }
                      />
                      <Tooltip 
                        formatter={(value, name) => {
                          const formatValue = reportType === 'sales' || reportType === 'overview' 
                            ? formatCurrency(Number(value))
                            : Number(value)
                          
                          const nameMap: Record<string, string> = {
                            ventas: 'Ventas',
                            profit: 'Ganancia',
                            completadas: 'Completadas',
                            progreso: 'En Progreso',
                            pendientes: 'Pendientes',
                            stock: 'Stock',
                            entradas: 'Entradas',
                            salidas: 'Salidas',
                            nuevos: 'Nuevos',
                            recurrentes: 'Recurrentes',
                            satisfaccion: 'Satisfacción'
                          }
                          
                          return [formatValue, nameMap[name as string] || name]
                        }}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                          backdropFilter: 'blur(10px)'
                        }}
                        wrapperClassName="dark:[&_.recharts-tooltip-wrapper]:!bg-slate-800/95 dark:[&_.recharts-tooltip-wrapper]:!text-slate-100 dark:[&_.recharts-tooltip-wrapper]:!border-slate-600"
                      />
                      
                      {/* Áreas dinámicas según el tipo de reporte */}
                      {reportType === 'sales' || reportType === 'overview' ? (
                        <>
                          <Area
                            type="monotone"
                            dataKey="ventas"
                            stroke={COLORS.primary}
                            strokeWidth={3}
                            fill="url(#salesGradient)"
                            name="ventas"
                          />
                          <Area
                            type="monotone"
                            dataKey="profit"
                            stroke={COLORS.secondary}
                            strokeWidth={3}
                            fill="url(#profitGradient)"
                            name="profit"
                          />
                        </>
                      ) : reportType === 'repairs' ? (
                        <>
                          <Area
                            type="monotone"
                            dataKey="completadas"
                            stroke={COLORS.secondary}
                            strokeWidth={3}
                            fill="url(#salesGradient)"
                            name="completadas"
                          />
                          <Area
                            type="monotone"
                            dataKey="progreso"
                            stroke={COLORS.primary}
                            strokeWidth={3}
                            fill="url(#profitGradient)"
                            name="progreso"
                          />
                          <Area
                            type="monotone"
                            dataKey="pendientes"
                            stroke={COLORS.accent}
                            strokeWidth={3}
                            fill="url(#thirdGradient)"
                            name="pendientes"
                          />
                        </>
                      ) : reportType === 'inventory' ? (
                        <>
                          <Area
                            type="monotone"
                            dataKey="stock"
                            stroke={COLORS.primary}
                            strokeWidth={3}
                            fill="url(#salesGradient)"
                            name="stock"
                          />
                          <Area
                            type="monotone"
                            dataKey="entradas"
                            stroke={COLORS.secondary}
                            strokeWidth={3}
                            fill="url(#profitGradient)"
                            name="entradas"
                          />
                          <Area
                            type="monotone"
                            dataKey="salidas"
                            stroke={COLORS.accent}
                            strokeWidth={3}
                            fill="url(#thirdGradient)"
                            name="salidas"
                          />
                        </>
                      ) : reportType === 'customers' ? (
                        <>
                          <Area
                            type="monotone"
                            dataKey="nuevos"
                            stroke={COLORS.primary}
                            strokeWidth={3}
                            fill="url(#salesGradient)"
                            name="nuevos"
                          />
                          <Area
                            type="monotone"
                            dataKey="recurrentes"
                            stroke={COLORS.secondary}
                            strokeWidth={3}
                            fill="url(#profitGradient)"
                            name="recurrentes"
                          />
                        </>
                      ) : null}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Distribución por Categorías */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl  border-slate-200/50 dark:border-slate-700/50">
              <CardHeader className="pb-4 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-700/50">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500 rounded-lg shadow-lg dark:shadow-emerald-500/20">
                    <PieChart className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {reportType === 'sales' ? 'Ventas por Categoría' :
                       reportType === 'repairs' ? 'Reparaciones por Tipo' :
                       reportType === 'inventory' ? 'Inventario por Categoría' :
                       reportType === 'customers' ? 'Segmentación de Clientes' :
                       'Ventas por Categoría'}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {reportType === 'sales' ? 'Distribución de ingresos' :
                       reportType === 'repairs' ? 'Distribución por servicio' :
                       reportType === 'inventory' ? 'Distribución de stock' :
                       reportType === 'customers' ? 'Distribución por tipo' :
                       'Distribución de ingresos'}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="bg-white/30 dark:bg-slate-900/30">
                <div ref={categoryChartRef}>
                  <div className="flex flex-col lg:flex-row items-center gap-6">
                    <ResponsiveContainer width="100%" height={280}>
                      <RechartsPieChart>
                        <Pie
                          data={reportSpecificData.categoryData}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={40}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {reportSpecificData.categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value, name, props) => [
                            `${value}%`,
                            props.payload.name
                          ]}
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: 'none',
                            borderRadius: '12px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                          }}
                          wrapperClassName="dark:[&_.recharts-tooltip-wrapper]:!bg-slate-800/95 dark:[&_.recharts-tooltip-wrapper]:!text-slate-100 dark:[&_.recharts-tooltip-wrapper]:!border-slate-600"
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    
                    <div className="space-y-3 min-w-[200px]">
                      {reportSpecificData.categoryData.map((category, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-600/50">
                          <div 
                            className="w-4 h-4 rounded-full shadow-sm"
                            style={{ backgroundColor: category.color }}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{category.name}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {formatCurrency(category.amount)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {category.value}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Segunda fila de gráficos */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Estado de Reparaciones */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl  border-slate-200/50 dark:border-slate-700/50">
              <CardHeader className="pb-4 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-700/50">
                <CardTitle className="flex items-center gap-3">
                  <div className={`p-2 bg-gradient-to-br ${
                    reportType === 'sales' ? 'from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500' :
                    reportType === 'repairs' ? 'from-orange-500 to-red-600 dark:from-orange-400 dark:to-red-500' :
                    reportType === 'inventory' ? 'from-indigo-500 to-blue-600 dark:from-indigo-400 dark:to-blue-500' :
                    reportType === 'customers' ? 'from-purple-500 to-pink-600 dark:from-purple-400 dark:to-pink-500' :
                    'from-orange-500 to-red-600 dark:from-orange-400 dark:to-red-500'
                  } rounded-lg shadow-lg dark:shadow-orange-500/20`}>
                    {reportType === 'sales' ? <Activity className="h-5 w-5 text-white" /> :
                     reportType === 'repairs' ? <Wrench className="h-5 w-5 text-white" /> :
                     reportType === 'inventory' ? <Package className="h-5 w-5 text-white" /> :
                     reportType === 'customers' ? <Users className="h-5 w-5 text-white" /> :
                     <Wrench className="h-5 w-5 text-white" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {reportType === 'sales' ? 'Canales de Venta' :
                       reportType === 'repairs' ? 'Estado de Reparaciones' :
                       reportType === 'inventory' ? 'Estado del Stock' :
                       reportType === 'customers' ? 'Satisfacción del Cliente' :
                       'Estado de Reparaciones'}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {reportType === 'sales' ? 'Distribución por canal' :
                       reportType === 'repairs' ? 'Distribución por estado' :
                       reportType === 'inventory' ? 'Distribución por estado' :
                       reportType === 'customers' ? 'Distribución por nivel' :
                       'Distribución por estado'}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="bg-white/30 dark:bg-slate-900/30">
                <div ref={repairsChartRef}>
                  <div className="space-y-4">
                    {reportSpecificData.statusData.map((status, index) => (
                      <motion.div
                        key={status.status}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + index * 0.1 }}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-600/60 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full shadow-sm"
                            style={{ backgroundColor: status.color }}
                          />
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{status.status}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {status.count} {
                                reportType === 'sales' ? 'ventas' :
                                reportType === 'repairs' ? 'reparaciones' :
                                reportType === 'inventory' ? 'productos' :
                                reportType === 'customers' ? 'clientes' :
                                'elementos'
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={status.trend.startsWith('+') ? "default" : "destructive"}
                            className={`text-xs ${
                              status.trend.startsWith('+')
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
                            }`}
                          >
                            {status.trend}
                          </Badge>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{status.count}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Productos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50">
              <CardHeader className="pb-4 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-700/50">
                <CardTitle className="flex items-center gap-3">
                  <div className={`p-2 bg-gradient-to-br ${
                    reportType === 'sales' ? 'from-green-500 to-emerald-600 dark:from-green-400 dark:to-emerald-500' :
                    reportType === 'repairs' ? 'from-orange-500 to-red-600 dark:from-orange-400 dark:to-red-500' :
                    reportType === 'inventory' ? 'from-purple-500 to-pink-600 dark:from-purple-400 dark:to-pink-500' :
                    reportType === 'customers' ? 'from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500' :
                    'from-purple-500 to-pink-600 dark:from-purple-400 dark:to-pink-500'
                  } rounded-lg shadow-lg dark:shadow-purple-500/20`}>
                    {reportType === 'sales' ? <TrendingUp className="h-5 w-5 text-white" /> :
                     reportType === 'repairs' ? <Wrench className="h-5 w-5 text-white" /> :
                     reportType === 'inventory' ? <Package className="h-5 w-5 text-white" /> :
                     reportType === 'customers' ? <Users className="h-5 w-5 text-white" /> :
                     <Package className="h-5 w-5 text-white" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {reportType === 'sales' ? 'Productos Más Vendidos' :
                       reportType === 'repairs' ? 'Servicios Más Solicitados' :
                       reportType === 'inventory' ? 'Productos con Mayor Rotación' :
                       reportType === 'customers' ? 'Clientes Más Valiosos' :
                       'Productos Más Vendidos'}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {reportType === 'sales' ? 'Top 5 por ingresos' :
                       reportType === 'repairs' ? 'Top 5 por frecuencia' :
                       reportType === 'inventory' ? 'Top 5 por movimiento' :
                       reportType === 'customers' ? 'Top 5 por valor' :
                       'Top 5 por ingresos'}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="bg-white/30 dark:bg-slate-900/30">
                <div ref={productsChartRef}>
                  <div className="space-y-4">
                    {reportSpecificData.topItems.map((product, index) => (
                      <motion.div
                        key={product.name}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + index * 0.1 }}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-600/60 hover:bg-white/80 dark:hover:bg-slate-700/80 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br ${
                            index === 0 ? 'from-yellow-400 to-orange-500' :
                            index === 1 ? 'from-gray-300 to-gray-500' :
                            index === 2 ? 'from-orange-400 to-red-500' :
                            'from-blue-400 to-purple-500'
                          } shadow-lg`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{product.name}</p>
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <span>
                                {product.sold} {
                                  reportType === 'sales' ? 'unidades' :
                                  reportType === 'repairs' ? 'servicios' :
                                  reportType === 'inventory' ? 'movimientos' :
                                  reportType === 'customers' ? 'compras' :
                                  'unidades'
                                }
                              </span>
                              {product.trend && (
                                <Badge 
                                  variant={product.trend > 0 ? "default" : "destructive"}
                                  className={`text-xs ${
                                    product.trend > 0
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700'
                                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
                                  }`}
                                >
                                  {product.trend > 0 ? '+' : ''}{product.trend.toFixed(1)}%
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-slate-900 dark:text-slate-100">{formatCurrency(product.revenue)}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {reportType === 'sales' ? 'ingresos' :
                             reportType === 'repairs' ? 'facturado' :
                             reportType === 'inventory' ? 'valor' :
                             reportType === 'customers' ? 'gastado' :
                             'ingresos'}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Reportes Recientes Mejorados */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50">
            <CardHeader className="pb-4 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-700/50">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 dark:from-indigo-400 dark:to-blue-500 rounded-lg shadow-lg dark:shadow-indigo-500/20">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reportes Recientes</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Historial de exportaciones</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2 border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80">
                  <Eye className="h-4 w-4" />
                  Ver Todos
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-white/30 dark:bg-slate-900/30">
              <div className="space-y-4">
                {[
                  { 
                    name: 'Reporte Mensual - Enero 2024', 
                    date: '2024-01-30', 
                    type: 'PDF', 
                    size: '2.3 MB',
                    color: 'from-red-500 to-pink-600',
                    icon: FileText
                  },
                  { 
                    name: 'Análisis de Inventario - Q1 2024', 
                    date: '2024-01-28', 
                    type: 'Excel', 
                    size: '1.8 MB',
                    color: 'from-green-500 to-emerald-600',
                    icon: BarChart3
                  },
                  { 
                    name: 'Satisfacción del Cliente - Diciembre', 
                    date: '2023-12-31', 
                    type: 'PDF', 
                    size: '1.2 MB',
                    color: 'from-blue-500 to-purple-600',
                    icon: Users
                  },
                  { 
                    name: 'Reporte de Reparaciones - Diciembre', 
                    date: '2023-12-30', 
                    type: 'CSV', 
                    size: '0.5 MB',
                    color: 'from-orange-500 to-red-600',
                    icon: Wrench
                  }
                ].map((report, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-600/60 hover:bg-white/80 dark:hover:bg-slate-700/80 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${report.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <report.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                          {report.name}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                          <span>{report.date}</span>
                          <Badge variant="outline" className="text-xs border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {report.type}
                          </Badge>
                          <span>{report.size}</span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

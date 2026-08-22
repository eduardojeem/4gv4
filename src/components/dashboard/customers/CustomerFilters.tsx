"use client"

import React, { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { 
  Filter, X, Calendar as CalendarIcon, 
  ChevronDown, Star, MapPin,
  Users, TrendingUp, Zap, Settings2,
  Grid, List, Check, Sparkles, Building,
  Plus, Minus, UserCheck, CreditCard, DollarSign
} from 'lucide-react'
import { ImprovedSearchBar } from './ImprovedSearchBar'
import { ImprovedActionButtons } from './ImprovedActionButtons'
import { GSIcon } from '@/components/ui/standardized-components'
import { CustomerFilters as CustomerFiltersType, Customer } from '@/hooks/use-customer-state'
import { useDebounce } from '@/hooks/use-debounce'
import { CustomerDataDialog } from './CustomerDataDialog'
import { customerService } from '@/services/customer-service'
import { format, subDays, startOfMonth, startOfYear, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

interface CustomerFiltersProps {
  filters: CustomerFiltersType
  onFiltersChange: (filters: Partial<CustomerFiltersType>) => void
  viewMode: "table" | "grid" | "timeline"
  onViewModeChange: (mode: "table" | "grid" | "timeline") => void
  customers: Customer[]
  onAddCustomer?: () => void
  onRefresh?: () => Promise<void> | void
  compact?: boolean
  onCustomerSelect?: (customer: Customer) => void
}

export function CustomerFilters({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  customers,
  onAddCustomer,
  onRefresh,
  compact,
  onCustomerSelect
}: CustomerFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [searchValue, setSearchValue] = useState(filters.search)
  const [showDataDialog, setShowDataDialog] = useState(false)
  const [dataDialogTab, setDataDialogTab] = useState<'export' | 'import'>('export')
  const [showDatePicker, setShowDatePicker] = useState(false)
  
  // Debounce search to avoid excessive filtering cycles
  const debouncedSearch = useDebounce(searchValue, 300)
  
  React.useEffect(() => {
    onFiltersChange({ search: debouncedSearch })
  }, [debouncedSearch, onFiltersChange])

  // Sync external search filter changes with local state
  React.useEffect(() => {
    if (filters.search !== searchValue && filters.search === "") {
      setSearchValue("")
    }
  }, [filters.search])

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value)
  }, [])

  const handleFilterChange = useCallback((key: keyof CustomerFiltersType, value: any) => {
    onFiltersChange({ [key]: value })
  }, [onFiltersChange])

  // Dynamic unique cities extracted from actual customer records
  const dynamicCities = useMemo(() => {
    const citySet = new Set<string>()
    customers.forEach(c => {
      if (c.city && c.city.trim() !== "" && c.city.toLowerCase() !== "all") {
        citySet.add(c.city.trim())
      }
    })
    return Array.from(citySet).sort((a, b) => a.localeCompare(b, 'es'))
  }, [customers])

  // Dynamic unique salespersons extracted from actual customer records
  const dynamicSalespersons = useMemo(() => {
    const spSet = new Set<string>()
    customers.forEach(c => {
      if (c.assigned_salesperson && c.assigned_salesperson.trim() !== "" && c.assigned_salesperson.toLowerCase() !== "sin asignar") {
        spSet.add(c.assigned_salesperson.trim())
      }
    })
    return Array.from(spSet).sort((a, b) => a.localeCompare(b, 'es'))
  }, [customers])

  // Metrics for quick filter counter badges
  const filterCounts = useMemo(() => {
    return {
      withDebt: customers.filter(c => (c.pending_amount || 0) > 0 || (c.current_balance || 0) > 0).length,
      hasCredit: customers.filter(c => (c.credit_limit || 0) > 0).length,
      vip: customers.filter(c => c.customer_type === 'premium' || c.segment === 'vip').length,
      wholesale: customers.filter(c => c.customer_type === 'wholesale' || c.customer_type === 'empresa').length,
      active: customers.filter(c => c.status === 'active').length,
      highValue: customers.filter(c => (c.lifetime_value || 0) >= 1000000).length,
      newCustomers: customers.filter(c => c.segment === 'new').length,
      frequent: customers.filter(c => (c.total_purchases || 0) >= 3).length,
    }
  }, [customers])

  // Quick smart filter definitions with active detection and toggle
  const quickFilters = [
    {
      id: "with_debt",
      label: "Con Deuda",
      icon: DollarSign,
      count: filterCounts.withDebt,
      isActive: Boolean(filters.has_debt),
      action: () => {
        handleFilterChange("has_debt", !filters.has_debt)
      }
    },
    {
      id: "has_credit",
      label: "Línea de Crédito",
      icon: CreditCard,
      count: filterCounts.hasCredit,
      isActive: Boolean(filters.has_credit_limit),
      action: () => {
        handleFilterChange("has_credit_limit", !filters.has_credit_limit)
      }
    },
    {
      id: "vip",
      label: "VIP / Premium",
      icon: Star,
      count: filterCounts.vip,
      isActive: filters.customer_type === "premium" || filters.segment === "vip",
      action: () => {
        if (filters.customer_type === "premium") {
          handleFilterChange("customer_type", "all")
        } else {
          onFiltersChange({ customer_type: "premium", segment: "all" })
        }
      }
    },
    {
      id: "wholesale",
      label: "Empresas / Mayoristas",
      icon: Building,
      count: filterCounts.wholesale,
      isActive: filters.customer_type === "empresa" || filters.customer_type === "wholesale",
      action: () => {
        if (filters.customer_type === "empresa" || filters.customer_type === "wholesale") {
          handleFilterChange("customer_type", "all")
        } else {
          handleFilterChange("customer_type", "empresa")
        }
      }
    },
    {
      id: "active",
      label: "Activos",
      icon: UserCheck,
      count: filterCounts.active,
      isActive: filters.status === "active",
      action: () => {
        handleFilterChange("status", filters.status === "active" ? "all" : "active")
      }
    },
    {
      id: "high_value",
      label: "Alto Valor",
      icon: TrendingUp,
      count: filterCounts.highValue,
      isActive: filters.spent_min >= 1000000,
      action: () => {
        handleFilterChange("spent_min", filters.spent_min >= 1000000 ? 0 : 1000000)
      }
    },
    {
      id: "frequent",
      label: "Frecuentes (3+)",
      icon: Users,
      count: filterCounts.frequent,
      isActive: filters.purchases_min >= 3,
      action: () => {
        handleFilterChange("purchases_min", filters.purchases_min >= 3 ? 0 : 3)
      }
    },
    {
      id: "new",
      label: "Nuevos",
      icon: Zap,
      count: filterCounts.newCustomers,
      isActive: filters.segment === "new",
      action: () => {
        handleFilterChange("segment", filters.segment === "new" ? "all" : "new")
      }
    }
  ]

  const clearFilters = useCallback(() => {
    setSearchValue("")
    onFiltersChange({
      search: "",
      status: "all",
      customer_type: "all",
      segment: "all",
      city: "all",
      assigned_salesperson: "all",
      date_range: { from: null, to: null },
      credit_score_range: [0, 10],
      lifetime_value_range: [0, Number.MAX_SAFE_INTEGER],
      tags: [],
      purchases_min: 0,
      spent_min: 0,
      loyalty_points_min: 0,
      has_debt: false,
      has_credit_limit: false
    })
    toast.info("Filtros restablecidos")
  }, [onFiltersChange])

  const removeTag = useCallback((tagToRemove: string) => {
    const newTags = filters.tags.filter(tag => tag !== tagToRemove)
    handleFilterChange("tags", newTags)
  }, [filters.tags, handleFilterChange])

  // Count active basic & advanced filters
  const activeAdvancedCount = useMemo(() => {
    let count = 0
    if (filters.assigned_salesperson !== "all") count++
    if (filters.date_range.from || filters.date_range.to) count++
    if (filters.credit_score_range[0] > 0 || filters.credit_score_range[1] < 10) count++
    if (filters.lifetime_value_range[0] > 0 || filters.lifetime_value_range[1] < Number.MAX_SAFE_INTEGER) count++
    if (filters.purchases_min > 0) count++
    if (filters.spent_min > 0) count++
    if (filters.loyalty_points_min > 0) count++
    return count
  }, [filters])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.search) count++
    if (filters.status !== "all") count++
    if (filters.customer_type !== "all") count++
    if (filters.segment !== "all") count++
    if (filters.city !== "all") count++
    if (filters.has_debt) count++
    if (filters.has_credit_limit) count++
    if (filters.tags.length > 0) count += filters.tags.length
    count += activeAdvancedCount
    return count
  }, [filters, activeAdvancedCount])

  // Date range presets helpers
  const applyDatePreset = (preset: 'today' | '7days' | '30days' | 'thisMonth' | 'thisYear') => {
    const now = new Date()
    let from: Date | null = null
    const to: Date | null = endOfDay(now)

    switch (preset) {
      case 'today':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
        break
      case '7days':
        from = subDays(now, 7)
        break
      case '30days':
        from = subDays(now, 30)
        break
      case 'thisMonth':
        from = startOfMonth(now)
        break
      case 'thisYear':
        from = startOfYear(now)
        break
    }

    handleFilterChange("date_range", { from, to })
    setShowDatePicker(false)
  }

  // Active filter chip items list
  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = []
    
    if (filters.search) {
      chips.push({
        id: "search",
        label: `Búsqueda: "${filters.search}"`,
        onRemove: () => {
          setSearchValue("")
          handleFilterChange("search", "")
        }
      })
    }
    if (filters.status !== "all") {
      const labels: Record<string, string> = { active: "Activo", inactive: "Inactivo", suspended: "Suspendido" }
      chips.push({
        id: "status",
        label: `Estado: ${labels[filters.status] || filters.status}`,
        onRemove: () => handleFilterChange("status", "all")
      })
    }
    if (filters.customer_type !== "all") {
      const labels: Record<string, string> = { premium: "Premium", empresa: "Empresa", regular: "Regular", wholesale: "Mayorista" }
      chips.push({
        id: "customer_type",
        label: `Tipo: ${labels[filters.customer_type] || filters.customer_type}`,
        onRemove: () => handleFilterChange("customer_type", "all")
      })
    }
    if (filters.segment !== "all") {
      const labels: Record<string, string> = { high_value: "Alto Valor", business: "Empresarial", regular: "Regular", new: "Nuevo", vip: "VIP" }
      chips.push({
        id: "segment",
        label: `Segmento: ${labels[filters.segment] || filters.segment}`,
        onRemove: () => handleFilterChange("segment", "all")
      })
    }
    if (filters.city !== "all") {
      chips.push({
        id: "city",
        label: `Ciudad: ${filters.city}`,
        onRemove: () => handleFilterChange("city", "all")
      })
    }
    if (filters.assigned_salesperson !== "all") {
      chips.push({
        id: "salesperson",
        label: `Vendedor: ${filters.assigned_salesperson}`,
        onRemove: () => handleFilterChange("assigned_salesperson", "all")
      })
    }
    if (filters.date_range.from || filters.date_range.to) {
      const fromStr = filters.date_range.from ? format(filters.date_range.from, "dd/MM/yy", { locale: es }) : "..."
      const toStr = filters.date_range.to ? format(filters.date_range.to, "dd/MM/yy", { locale: es }) : "..."
      chips.push({
        id: "date_range",
        label: `Registro: ${fromStr} - ${toStr}`,
        onRemove: () => handleFilterChange("date_range", { from: null, to: null })
      })
    }
    if (filters.spent_min > 0) {
      chips.push({
        id: "spent_min",
        label: `Gasto min: ${formatCurrency(filters.spent_min)}`,
        onRemove: () => handleFilterChange("spent_min", 0)
      })
    }
    if (filters.purchases_min > 0) {
      chips.push({
        id: "purchases_min",
        label: `Compras min: ${filters.purchases_min}`,
        onRemove: () => handleFilterChange("purchases_min", 0)
      })
    }
    if (filters.credit_score_range[0] > 0 || filters.credit_score_range[1] < 10) {
      chips.push({
        id: "credit_score",
        label: `Score: ${filters.credit_score_range[0]} - ${filters.credit_score_range[1]}`,
        onRemove: () => handleFilterChange("credit_score_range", [0, 10])
      })
    }
    if (filters.has_debt) {
      chips.push({
        id: "has_debt",
        label: "Con Deuda Pendiente",
        onRemove: () => handleFilterChange("has_debt", false)
      })
    }
    if (filters.has_credit_limit) {
      chips.push({
        id: "has_credit_limit",
        label: "Con Línea de Crédito",
        onRemove: () => handleFilterChange("has_credit_limit", false)
      })
    }
    filters.tags.forEach(tag => {
      chips.push({
        id: `tag-${tag}`,
        label: `#${tag}`,
        onRemove: () => removeTag(tag)
      })
    })

    return chips
  }, [filters, handleFilterChange, removeTag])

  return (
    <>
    <Card className="border border-slate-200/80 dark:border-white/10 shadow-sm bg-white dark:bg-[#0d1117] rounded-2xl overflow-hidden transition-all">
      {/* ─── Header: Título, Modos de Vista y Toggle Avanzado ─── */}
      <CardHeader className={compact ? "p-3.5 pb-2" : "p-5 pb-3"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20">
              <Filter className="h-4.5 w-4.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Filtros Inteligentes
              </span>
              {activeFiltersCount > 0 && (
                <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-0 text-xs px-2 py-0.5 font-bold shadow-xs">
                  {activeFiltersCount} activo{activeFiltersCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200/60 dark:border-white/5">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("table")}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "table" 
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white" 
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-transparent"
                }`}
                aria-label="Vista de tabla"
              >
                <List className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Tabla</span>
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("grid")}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "grid" 
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white" 
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-transparent"
                }`}
                aria-label="Vista de cuadrícula"
              >
                <Grid className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Tarjetas</span>
              </Button>
              <Button
                variant={viewMode === "timeline" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("timeline")}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "timeline" 
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white" 
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-transparent"
                }`}
                aria-label="Vista de línea de tiempo"
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Timeline</span>
              </Button>
            </div>

            {/* Toggle Avanzado */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                "h-8 gap-1.5 rounded-xl border font-medium text-xs transition-all",
                showAdvanced || activeAdvancedCount > 0
                  ? "border-blue-300 bg-blue-50/70 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300 font-semibold"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              )}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Avanzado</span>
              {activeAdvancedCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                  {activeAdvancedCount}
                </span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
            </Button>
            
            {/* Limpiar Filtros */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 gap-1 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 text-xs font-semibold transition-all"
                title="Restablecer todos los filtros"
              >
                <X className="h-3.5 w-3.5" />
                <span>Limpiar</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className={compact ? "p-3.5 pt-0 space-y-4" : "p-5 pt-0 space-y-5"}>
        {/* ─── 1. Filtros Rápidos (Pills con estado activo y toggle) ─── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              Filtros Rápidos
            </Label>
            {activeFiltersCount > 0 && (
              <span className="text-xs text-slate-500">
                Mostrando clientes coincidentes
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            {quickFilters.map((filter) => {
              const Icon = filter.icon
              const active = filter.isActive

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={filter.action}
                  className={cn(
                    "flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200 border",
                    active
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white"
                      : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300 dark:bg-white/5 dark:text-slate-300 dark:border-white/10 dark:hover:bg-white/10"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", active ? "text-white dark:text-slate-900" : "text-slate-500 dark:text-slate-400")} />
                  <span>{filter.label}</span>
                  <span className={cn(
                    "ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    active
                      ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                      : "bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-slate-400"
                  )}>
                    {filter.count}
                  </span>
                  {active && <Check className="h-3 w-3 ml-0.5 animate-in zoom-in-50 duration-200" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── 2. Búsqueda Inteligente ─── */}
        <div className="space-y-1.5">
          <ImprovedSearchBar
            value={searchValue}
            onChange={handleSearchChange}
            onSearch={(value) => onFiltersChange({ search: value })}
            customers={customers}
            isSearching={false}
            placeholder="Buscar por nombre, CI/RUC, teléfono, email, código o notas..."
            onQuickFilter={(filter) => {
              if (filter.includes('customer_type:')) {
                const type = filter.split(':')[1]
                handleFilterChange('customer_type', type)
              } else if (filter.includes('city:')) {
                const city = filter.split(':')[1]
                handleFilterChange('city', city)
              } else if (filter.includes('status:')) {
                const status = filter.split(':')[1]
                handleFilterChange('status', status)
              } else if (filter.includes('purchases>=')) {
                const v = Number(filter.split('>=')[1])
                handleFilterChange('purchases_min', isNaN(v) ? 0 : v)
              } else if (filter.includes('spent>=')) {
                const v = Number(filter.split('>=')[1])
                handleFilterChange('spent_min', isNaN(v) ? 0 : v)
              }
            }}
            onCustomerSelect={onCustomerSelect}
          />
        </div>

        {/* ─── 2.5 Chips de Filtros Activos Inline ─── */}
        <AnimatePresence>
          {activeChips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center gap-1.5 pt-1"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
                Filtros aplicados:
              </span>
              {activeChips.map((chip) => (
                <Badge
                  key={chip.id}
                  variant="secondary"
                  className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 text-xs py-1 px-2.5 rounded-lg transition-all"
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-300 transition-colors"
                    aria-label={`Eliminar filtro ${chip.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 px-2 text-[11px] text-slate-500 hover:text-rose-600 font-semibold"
              >
                Limpiar todo
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── 3. Filtros Básicos (Selects con íconos descriptivos) ─── */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 pt-1">
          {/* Estado */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Estado
            </Label>
            <Select
              value={filters.status}
              onValueChange={(value) => handleFilterChange("status", value)}
            >
              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white dark:border-white/10 dark:bg-white/5 text-xs font-medium">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-white/10">
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>Todos los estados</span>
                  </div>
                </SelectItem>
                <SelectItem value="active">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">Activo</span>
                  </div>
                </SelectItem>
                <SelectItem value="inactive">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>Inactivo</span>
                  </div>
                </SelectItem>
                <SelectItem value="suspended">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="font-medium text-rose-700 dark:text-rose-300">Suspendido</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Cliente */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-500" />
              Tipo de Cliente
            </Label>
            <Select
              value={filters.customer_type}
              onValueChange={(value) => handleFilterChange("customer_type", value)}
            >
              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white dark:border-white/10 dark:bg-white/5 text-xs font-medium">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-white/10">
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="premium">
                  <div className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                    <span className="font-semibold text-amber-700 dark:text-amber-300">Premium</span>
                  </div>
                </SelectItem>
                <SelectItem value="empresa">
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Empresa</span>
                  </div>
                </SelectItem>
                <SelectItem value="wholesale">
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 w-3.5 text-purple-500" />
                    <span>Mayorista</span>
                  </div>
                </SelectItem>
                <SelectItem value="regular">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-500" />
                    <span>Regular</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Segmento */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
              Segmento
            </Label>
            <Select
              value={filters.segment}
              onValueChange={(value) => handleFilterChange("segment", value)}
            >
              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white dark:border-white/10 dark:bg-white/5 text-xs font-medium">
                <SelectValue placeholder="Todos los segmentos" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-white/10">
                <SelectItem value="all">Todos los segmentos</SelectItem>
                <SelectItem value="vip">
                  <div className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-purple-500 fill-purple-400" />
                    <span className="font-bold text-purple-700 dark:text-purple-300">VIP</span>
                  </div>
                </SelectItem>
                <SelectItem value="high_value">
                  <div className="flex items-center gap-2">
                    <GSIcon className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Alto Valor</span>
                  </div>
                </SelectItem>
                <SelectItem value="business">
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Empresarial</span>
                  </div>
                </SelectItem>
                <SelectItem value="new">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>Nuevo</span>
                  </div>
                </SelectItem>
                <SelectItem value="regular">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-500" />
                    <span>Regular</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ciudad (Dinámica desde datos reales) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-rose-500" />
              Ciudad
            </Label>
            <Select
              value={filters.city}
              onValueChange={(value) => handleFilterChange("city", value)}
            >
              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white dark:border-white/10 dark:bg-white/5 text-xs font-medium">
                <SelectValue placeholder="Todas las ciudades" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-white/10 max-h-56">
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>Todas las ciudades ({customers.length})</span>
                  </div>
                </SelectItem>
                {dynamicCities.map(city => {
                  const count = customers.filter(c => c.city?.trim() === city).length
                  return (
                    <SelectItem key={city} value={city}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-rose-500" />
                          <span>{city}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">({count})</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ─── 4. Filtros Avanzados (Desplegable) ─── */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-3 border-t border-slate-100 dark:border-white/5"
            >
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {/* Rango de Fechas con Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-blue-500" />
                      Fecha de Registro
                    </Label>
                    {(filters.date_range.from || filters.date_range.to) && (
                      <button
                        type="button"
                        onClick={() => handleFilterChange("date_range", { from: null, to: null })}
                        className="text-[10px] text-rose-600 hover:underline"
                      >
                        Limpiar fecha
                      </button>
                    )}
                  </div>

                  <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full h-10 justify-start text-left font-normal rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white dark:border-white/10 dark:bg-white/5 text-xs"
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                        {filters.date_range.from ? (
                          filters.date_range.to ? (
                            <span>
                              {format(filters.date_range.from, "dd MMM yyyy", { locale: es })} -{" "}
                              {format(filters.date_range.to, "dd MMM yyyy", { locale: es })}
                            </span>
                          ) : (
                            format(filters.date_range.from, "dd MMM yyyy", { locale: es })
                          )
                        ) : (
                          <span className="text-slate-400">Seleccionar período...</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3 rounded-2xl shadow-xl border-slate-200 dark:border-white/10" align="start">
                      {/* Presets rápidos */}
                      <div className="flex flex-wrap gap-1.5 pb-3 border-b border-slate-100 dark:border-white/5 mb-3">
                        <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => applyDatePreset('today')}>
                          Hoy
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => applyDatePreset('7days')}>
                          7 días
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => applyDatePreset('30days')}>
                          30 días
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => applyDatePreset('thisMonth')}>
                          Este mes
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => applyDatePreset('thisYear')}>
                          Este año
                        </Button>
                      </div>

                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={filters.date_range.from || undefined}
                        selected={{
                          from: filters.date_range.from || undefined,
                          to: filters.date_range.to || undefined
                        }}
                        onSelect={(range) => {
                          handleFilterChange("date_range", {
                            from: range?.from || null,
                            to: range?.to || null
                          })
                        }}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Vendedor Asignado (Dinámico) */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-500" />
                    Vendedor Asignado
                  </Label>
                  <Select
                    value={filters.assigned_salesperson}
                    onValueChange={(value) => handleFilterChange("assigned_salesperson", value)}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white dark:border-white/10 dark:bg-white/5 text-xs font-medium">
                      <SelectValue placeholder="Todos los vendedores" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 dark:border-white/10">
                      <SelectItem value="all">Todos los vendedores</SelectItem>
                      {dynamicSalespersons.map(sp => (
                        <SelectItem key={sp} value={sp}>
                          {sp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Puntuación de Crédito (0-10) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                      Score Crediticio
                    </Label>
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-5">
                      {filters.credit_score_range[0]} - {filters.credit_score_range[1]} / 10
                    </Badge>
                  </div>
                  <div className="pt-2 px-1">
                    <Slider
                      value={filters.credit_score_range}
                      onValueChange={(value) => handleFilterChange("credit_score_range", value)}
                      max={10}
                      min={0}
                      step={0.5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                      <span className="text-rose-600 dark:text-rose-400 font-medium">0 (Riesgo)</span>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">5 (Medio)</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">10 (Excelente)</span>
                    </div>
                  </div>
                </div>

                {/* Gasto Mínimo Acumulado */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                      Gasto Mínimo
                    </Label>
                    {filters.spent_min > 0 && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(filters.spent_min)}+
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      value={filters.spent_min || ""}
                      onChange={(e) => handleFilterChange("spent_min", Number(e.target.value) || 0)}
                      placeholder="Monto mínimo..."
                      className="h-10 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white dark:border-white/10 dark:bg-white/5 text-xs font-mono"
                    />
                  </div>
                  {/* Preset buttons */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {[100000, 500000, 1000000, 5000000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleFilterChange("spent_min", filters.spent_min === val ? 0 : val)}
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors",
                          filters.spent_min === val
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-400 dark:border-white/10"
                        )}
                      >
                        {val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}k`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compras Mínimas con Stepper */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                      Compras Mínimas
                    </Label>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {filters.purchases_min > 0 ? `${filters.purchases_min} compra(s)` : "Sin mínimo"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-slate-200 shrink-0"
                      onClick={() => handleFilterChange("purchases_min", Math.max(0, (filters.purchases_min || 0) - 1))}
                      disabled={filters.purchases_min <= 0}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      type="number"
                      value={filters.purchases_min || ""}
                      onChange={(e) => handleFilterChange("purchases_min", Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0"
                      className="h-10 text-center rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white dark:border-white/10 dark:bg-white/5 text-xs font-bold"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-slate-200 shrink-0"
                      onClick={() => handleFilterChange("purchases_min", (filters.purchases_min || 0) + 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {/* Preset pills */}
                  <div className="flex gap-1 pt-1">
                    {[1, 3, 5, 10].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => handleFilterChange("purchases_min", filters.purchases_min === cnt ? 0 : cnt)}
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors",
                          filters.purchases_min === cnt
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-400 dark:border-white/10"
                        )}
                      >
                        {cnt}+
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── 5. Footer con Contador y Botones de Acción ─── */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span>
              {activeFiltersCount > 0 ? (
                <>
                  <strong className="text-slate-900 dark:text-white font-semibold">{activeFiltersCount}</strong> filtro{activeFiltersCount !== 1 ? 's' : ''} aplicado{activeFiltersCount !== 1 ? 's' : ''}
                </>
              ) : (
                "Mostrando todos los clientes"
              )}
            </span>
          </div>
          
          <ImprovedActionButtons
            onAddCustomer={onAddCustomer}
            onExport={() => {
              setDataDialogTab('export')
              setShowDataDialog(true)
            }}
            onImport={() => {
              setDataDialogTab('import')
              setShowDataDialog(true)
            }}
            onRefresh={() => {
              if (onRefresh) {
                void Promise.resolve(onRefresh())
              }
            }}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            compact={compact}
          />
        </div>
      </CardContent>
    </Card>

    {/* ─── Modal de Exportación / Importación ─── */}
    <CustomerDataDialog
      isOpen={showDataDialog}
      onClose={() => setShowDataDialog(false)}
      customers={customers}
      defaultTab={dataDialogTab}
      onImport={async (file) => {
        try {
          const result = await customerService.importCustomersFromCSV(file)
          
          if (result.success) {
            toast.success(`${result.imported} clientes importados exitosamente`)
            if (onRefresh) {
              await Promise.resolve(onRefresh())
            }
          } else {
            toast.error(result.error || 'Error al importar clientes')
          }
          
          return result
        } catch (error: any) {
          const errorMessage = error.message || 'Error inesperado al importar'
          toast.error(errorMessage)
          return { success: false, error: errorMessage }
        }
      }}
    />
  </>
  )
}

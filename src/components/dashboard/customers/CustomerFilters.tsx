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
  Check, Sparkles, Building,
  Plus, Minus, UserCheck, CreditCard, DollarSign
} from 'lucide-react'
import { ImprovedSearchBar } from './ImprovedSearchBar'
import { ImprovedActionButtons } from './ImprovedActionButtons'
import { GSIcon } from '@/components/ui/standardized-components'
import { CustomerFilters as CustomerFiltersType, Customer } from '@/hooks/use-customer-state'
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
  totalCount?: number
  loadAllCustomersForExport?: () => Promise<Customer[]>
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
  onCustomerSelect,
  totalCount,
  loadAllCustomersForExport,
}: CustomerFiltersProps) {
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [searchValue, setSearchValue] = useState(filters.search)
  const [showDataDialog, setShowDataDialog] = useState(false)
  const [dataDialogTab, setDataDialogTab] = useState<'export' | 'import'>('export')
  const [showDatePicker, setShowDatePicker] = useState(false)
  
  // El campo escribe en su propio estado y NO filtra mientras se escribe.
  //
  // Antes cada tecla —con 300ms de espera— reemplazaba el filtro del panel: la
  // lista se rearmaba entera desde la primera letra, saltaba el paginador y
  // podias quedar mirando cientos de coincidencias de una «a». La busqueda se
  // aplica al confirmar: Enter, el boton, o elegir una sugerencia.
  React.useEffect(() => {
    setSearchValue(filters.search)
  }, [filters.search])

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value)
  }, [])

  const handleSearchSubmit = useCallback((value: string) => {
    onFiltersChange({ search: value })
  }, [onFiltersChange])

  const handleFilterChange = useCallback((key: keyof CustomerFiltersType, value: CustomerFiltersType[keyof CustomerFiltersType]) => {
    onFiltersChange({ [key]: value })
  }, [onFiltersChange])

  // Quick smart filter definitions with active detection and toggle
  const quickFilters = [
    {
      id: "with_debt",
      label: "Saldo registrado",
      icon: DollarSign,
      isActive: Boolean(filters.has_debt),
      action: () => {
        handleFilterChange("has_debt", !filters.has_debt)
      }
    },
    {
      id: "has_credit",
      label: "Línea de Crédito",
      icon: CreditCard,
      isActive: Boolean(filters.has_credit_limit),
      action: () => {
        handleFilterChange("has_credit_limit", !filters.has_credit_limit)
      }
    },
    {
      id: "vip",
      label: "VIP / Premium",
      icon: Star,
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
      isActive: filters.status === "active",
      action: () => {
        handleFilterChange("status", filters.status === "active" ? "all" : "active")
      }
    },
    {
      id: "high_value",
      label: "Alto Valor",
      icon: TrendingUp,
      isActive: filters.spent_min >= 1000000,
      action: () => {
        handleFilterChange("spent_min", filters.spent_min >= 1000000 ? 0 : 1000000)
      }
    },
    {
      id: "frequent",
      label: "Frecuentes (3+)",
      icon: Users,
      isActive: filters.purchases_min >= 3,
      action: () => {
        handleFilterChange("purchases_min", filters.purchases_min >= 3 ? 0 : 3)
      }
    },
    {
      id: "new",
      label: "Nuevos",
      icon: Zap,
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

  const activeMoreFiltersCount = activeAdvancedCount
    + Number(filters.status !== 'all')
    + Number(filters.customer_type !== 'all')
    + Number(filters.segment !== 'all')
    + Number(filters.city !== 'all')

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
        label: "Con saldo registrado",
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
      <CardHeader className={cn('px-4 pb-2 pt-4 sm:px-5', compact && 'pt-3')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
            <Filter className="h-4 w-4 shrink-0 text-blue-600" />
            <span>Filtros Inteligentes</span>
            {activeFiltersCount > 0 && <Badge variant="secondary" className="text-xs">{activeFiltersCount}</Badge>}
          </CardTitle>
          <ImprovedActionButtons
            onAddCustomer={onAddCustomer}
            onExport={() => { setDataDialogTab('export'); setShowDataDialog(true) }}
            onImport={() => { setDataDialogTab('import'); setShowDataDialog(true) }}
            onRefresh={() => { if (onRefresh) void Promise.resolve(onRefresh()) }}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            compact
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-5">
        {/* La búsqueda es la acción principal. */}
        <ImprovedSearchBar
          value={searchValue}
          onChange={handleSearchChange}
          onSearch={handleSearchSubmit}
          customers={customers}
          isSearching={false}
          placeholder="Buscar por nombre, CI/RUC, teléfono, email, código o notas..."
          onQuickFilter={(filter) => {
            if (filter.includes('customer_type:')) {
              handleFilterChange('customer_type', filter.split(':')[1])
            } else if (filter.includes('city:')) {
              handleFilterChange('city', filter.split(':')[1])
            } else if (filter.includes('status:')) {
              handleFilterChange('status', filter.split(':')[1])
            } else if (filter.includes('purchases>=')) {
              const value = Number(filter.split('>=')[1])
              handleFilterChange('purchases_min', isNaN(value) ? 0 : value)
            } else if (filter.includes('spent>=')) {
              const value = Number(filter.split('>=')[1])
              handleFilterChange('spent_min', isNaN(value) ? 0 : value)
            }
          }}
          onCustomerSelect={onCustomerSelect}
        />
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            Accesos rápidos
          </Label>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            {quickFilters.map((filter) => {
              const Icon = filter.icon
              const active = filter.isActive

              return (
                <button
                  key={filter.id}
                  type="button"
                  title={filter.id === 'with_debt' ? 'Filtra por el saldo guardado en la ficha; la deuda exacta se consulta en el detalle del cliente.' : undefined}
                  onClick={filter.action}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white"
                      : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300 dark:bg-white/5 dark:text-slate-300 dark:border-white/10 dark:hover:bg-white/10"
                  )}
                  aria-pressed={active}
                >
                  <Icon className={cn("h-3.5 w-3.5", active ? "text-white dark:text-slate-900" : "text-slate-500 dark:text-slate-400")} />
                  <span>{filter.label}</span>
                  {active && <Check className="h-3 w-3 ml-0.5 animate-in zoom-in-50 duration-200" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Los filtros aplicados permanecen visibles aun con los controles cerrados. */}
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
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-white/10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            aria-expanded={showMoreFilters}
            aria-controls="customer-extra-filters"
            onClick={() => setShowMoreFilters((open) => !open)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Más filtros
            {activeMoreFiltersCount > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{activeMoreFiltersCount}</Badge>}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showMoreFilters && 'rotate-180')} />
          </Button>
          {activeFiltersCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs text-rose-600">
              <X className="mr-1 h-3.5 w-3.5" /> Limpiar filtros
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showMoreFilters && (
            <motion.div
              id="customer-extra-filters"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden border-t border-slate-100 pt-3 dark:border-white/10"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <Input
              key={filters.city}
              defaultValue={filters.city === 'all' ? '' : filters.city}
              placeholder="Escribí una ciudad y presioná Enter"
              aria-label="Filtrar por ciudad"
              className="h-10 rounded-xl"
              onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
              onBlur={(event) => {
                const city = event.currentTarget.value.trim() || 'all'
                if (city !== filters.city) handleFilterChange('city', city)
              }}
            />
          </div>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 dark:border-white/10 md:grid-cols-2 lg:grid-cols-3">
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
                  <Input
                    key={filters.assigned_salesperson}
                    defaultValue={filters.assigned_salesperson === 'all' ? '' : filters.assigned_salesperson}
                    placeholder="Nombre del vendedor"
                    aria-label="Filtrar por vendedor asignado"
                    className="h-10 rounded-xl"
                    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                    onBlur={(event) => {
                      const salesperson = event.currentTarget.value.trim() || 'all'
                      if (salesperson !== filters.assigned_salesperson) handleFilterChange('assigned_salesperson', salesperson)
                    }}
                  />
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
                      onValueChange={(value) => handleFilterChange("credit_score_range", [value[0] ?? 0, value[1] ?? 10] as [number, number])}
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
      </CardContent>
    </Card>

    {/* ─── Modal de Exportación / Importación ─── */}
    <CustomerDataDialog
      isOpen={showDataDialog}
      onClose={() => setShowDataDialog(false)}
      customers={customers}
      totalCount={totalCount}
      loadAllCustomers={loadAllCustomersForExport}
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
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Error inesperado al importar'
          toast.error(errorMessage)
          return { success: false, error: errorMessage }
        }
      }}
    />
  </>
  )
}

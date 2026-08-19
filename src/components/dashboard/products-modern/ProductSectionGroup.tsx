import React, { useState, useMemo } from 'react'
import {
  ChevronDown, ChevronUp, Package, Wrench,
  Tag, Sparkles, FolderOpen, Maximize2, Minimize2,
  TrendingUp, BarChart2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Product } from '@/types/products'
import { SortConfig, ViewMode, GroupByMode } from '@/types/products-dashboard'
import { isServiceLikeProduct } from '@/lib/products-dashboard-utils'
import { ProductGrid } from './ProductGrid'
import { ProductTable } from './ProductTable'
import { formatCurrencyCompact } from '@/lib/currency'
import { cn } from '@/lib/utils'

export interface ProductSectionGroupProps {
  products: Product[]
  groupBy: GroupByMode
  viewMode: ViewMode
  selectedProductIds: string[]
  sortConfig: SortConfig
  onSort: (field: SortConfig['field']) => void
  onSelectAll: (selected: boolean) => void
  onSelect: (id: string) => void
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onDuplicate: (product: Product) => void
  onViewDetails: (product: Product) => void
  onToggleActive?: (product: Product, newValue: boolean) => Promise<void> | void
  loading?: boolean
  className?: string
}

interface SectionData {
  id: string
  title: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  color: 'indigo' | 'purple' | 'blue' | 'amber' | 'emerald' | 'slate'
  items: Product[]
  percentage: number
  totalValue: number
  isLargest: boolean
}

export function ProductSectionGroup({
  products,
  groupBy,
  viewMode,
  selectedProductIds,
  sortConfig,
  onSort,
  onSelectAll,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onViewDetails,
  onToggleActive,
  loading = false,
  className
}: ProductSectionGroupProps) {
  // State for which sections are expanded (all expanded by default)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  // Compute sections data
  const sections = useMemo<SectionData[]>(() => {
    const totalCount = products.length
    if (totalCount === 0) return []

    if (groupBy === 'type') {
      const physicalItems = products.filter(p => !isServiceLikeProduct(p))
      const serviceItems = products.filter(isServiceLikeProduct)

      const physicalValue = physicalItems.reduce((sum, p) => sum + ((p.sale_price || 0) * (p.stock_quantity || 0)), 0)
      const serviceValue = serviceItems.reduce((sum, p) => sum + (p.sale_price || 0), 0)

      const isPhysicalLargest = physicalItems.length >= serviceItems.length

      const list: SectionData[] = []

      if (physicalItems.length > 0) {
        list.push({
          id: 'physical-products',
          title: 'Productos Físicos con Inventario',
          subtitle: 'Artículos con control de stock y existencias en almacén',
          icon: Package,
          color: 'indigo',
          items: physicalItems,
          percentage: Math.round((physicalItems.length / totalCount) * 100),
          totalValue: physicalValue,
          isLargest: isPhysicalLargest && physicalItems.length > 0,
        })
      }

      if (serviceItems.length > 0) {
        list.push({
          id: 'services',
          title: 'Servicios Profesionales',
          subtitle: 'Mano de obra, reparaciones e intangibles sin control de stock',
          icon: Wrench,
          color: 'purple',
          items: serviceItems,
          percentage: Math.round((serviceItems.length / totalCount) * 100),
          totalValue: serviceValue,
          isLargest: !isPhysicalLargest && serviceItems.length > 0,
        })
      }

      return list
    }

    if (groupBy === 'category') {
      const categoryMap = new Map<string, Product[]>()

      for (const product of products) {
        const catName = product.category?.name || 'Sin Categoría'
        const current = categoryMap.get(catName) || []
        current.push(product)
        categoryMap.set(catName, current)
      }

      // Convert to array and sort descending by number of items (las que ocupan más espacio primero)
      const entries = Array.from(categoryMap.entries()).sort(
        (a, b) => b[1].length - a[1].length
      )

      const maxLen = entries[0]?.[1]?.length || 0

      const colors: Array<'blue' | 'indigo' | 'purple' | 'emerald' | 'amber' | 'slate'> = [
        'blue', 'purple', 'indigo', 'emerald', 'amber', 'slate'
      ]

      return entries.map(([categoryName, items], index) => {
        const totalVal = items.reduce(
          (sum, p) => sum + ((p.sale_price || 0) * (isServiceLikeProduct(p) ? 1 : (p.stock_quantity || 0))),
          0
        )
        const isServicesOnly = items.every(isServiceLikeProduct)

        return {
          id: `cat-${categoryName.toLowerCase().replace(/\s+/g, '-')}`,
          title: categoryName,
          subtitle: isServicesOnly ? 'Categoría de servicios' : 'Categoría de productos',
          icon: isServicesOnly ? Wrench : Tag,
          color: colors[index % colors.length],
          items,
          percentage: Math.round((items.length / totalCount) * 100),
          totalValue: totalVal,
          isLargest: items.length === maxLen && maxLen > 0,
        }
      })
    }

    return []
  }, [products, groupBy])

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const expandAll = () => setCollapsedSections({})
  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {}
    for (const section of sections) {
      allCollapsed[section.id] = true
    }
    setCollapsedSections(allCollapsed)
  }

  const colorStyles = {
    indigo: {
      border: 'border-indigo-200 dark:border-indigo-800/80',
      bg: 'bg-indigo-50/50 dark:bg-indigo-950/20',
      headerBg: 'bg-gradient-to-r from-indigo-50 via-white to-indigo-50/30 dark:from-indigo-950/40 dark:via-slate-900 dark:to-indigo-950/20',
      badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
    },
    purple: {
      border: 'border-purple-200 dark:border-purple-800/80',
      bg: 'bg-purple-50/50 dark:bg-purple-950/20',
      headerBg: 'bg-gradient-to-r from-purple-50 via-white to-purple-50/30 dark:from-purple-950/40 dark:via-slate-900 dark:to-purple-950/20',
      badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border-purple-200 dark:border-purple-700',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    blue: {
      border: 'border-blue-200 dark:border-blue-800/80',
      bg: 'bg-blue-50/50 dark:bg-blue-950/20',
      headerBg: 'bg-gradient-to-r from-blue-50 via-white to-blue-50/30 dark:from-blue-950/40 dark:via-slate-900 dark:to-blue-950/20',
      badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-700',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    emerald: {
      border: 'border-emerald-200 dark:border-emerald-800/80',
      bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      headerBg: 'bg-gradient-to-r from-emerald-50 via-white to-emerald-50/30 dark:from-emerald-950/40 dark:via-slate-900 dark:to-emerald-950/20',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    amber: {
      border: 'border-amber-200 dark:border-amber-800/80',
      bg: 'bg-amber-50/50 dark:bg-amber-950/20',
      headerBg: 'bg-gradient-to-r from-amber-50 via-white to-amber-50/30 dark:from-amber-950/40 dark:via-slate-900 dark:to-amber-950/20',
      badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-700',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    slate: {
      border: 'border-slate-200 dark:border-slate-800',
      bg: 'bg-slate-50/50 dark:bg-slate-900/20',
      headerBg: 'bg-gradient-to-r from-slate-100 via-white to-slate-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800',
      badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      iconColor: 'text-slate-600 dark:text-slate-400',
    },
  }

  if (sections.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Global Section Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur-md text-xs">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {sections.length} {sections.length === 1 ? 'sección desglosada' : 'secciones desglosadas'}
          </span>
          <span className="text-muted-foreground hidden sm:inline">
            (ordenadas por la que ocupa mayor volumen de catálogo)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={expandAll}
            className="h-7 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 gap-1"
          >
            <Maximize2 className="h-3 w-3" />
            Expandir todas
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            className="h-7 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 gap-1"
          >
            <Minimize2 className="h-3 w-3" />
            Colapsar todas
          </Button>
        </div>
      </div>

      {/* Render Each Section */}
      {sections.map((section) => {
        const isCollapsed = Boolean(collapsedSections[section.id])
        const style = colorStyles[section.color]
        const SectionIcon = section.icon

        return (
          <div
            key={section.id}
            className={cn(
              'rounded-3xl border transition-all duration-200 overflow-hidden shadow-sm',
              style.border,
              isCollapsed ? 'bg-white/60 dark:bg-slate-900/40' : 'bg-white/90 dark:bg-slate-900/80'
            )}
          >
            {/* Section Header Accordion Trigger */}
            <div
              onClick={() => toggleSection(section.id)}
              className={cn(
                'p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors',
                style.headerBg,
                'hover:opacity-95'
              )}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={cn('p-2.5 rounded-2xl shadow-xs border bg-white dark:bg-slate-900', style.border)}>
                  <SectionIcon className={cn('h-5 w-5', style.iconColor)} />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      {section.title}
                    </h3>
                    <Badge variant="outline" className={cn('px-2 py-0 text-xs font-bold rounded-lg', style.badgeBg)}>
                      {section.items.length} {section.items.length === 1 ? 'ítem' : 'ítems'}
                    </Badge>
                    {section.isLargest && (
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-[10px] px-2 py-0 shadow-xs border-0">
                        🔥 Mayor espacio ({section.percentage}%)
                      </Badge>
                    )}
                  </div>
                  {section.subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                      {section.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats & Toggle Chevron */}
              <div className="flex items-center gap-3 ml-auto sm:ml-0">
                <div className="text-right hidden md:block">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Ocupación / Valor
                  </p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {section.percentage}% del catálogo · {formatCurrencyCompact(section.totalValue)}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl bg-white/80 dark:bg-slate-800/80 shadow-xs shrink-0"
                  aria-label={isCollapsed ? 'Desplegar sección' : 'Plegar sección'}
                >
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  )}
                </Button>
              </div>
            </div>

            {/* Section Content (Grid or Table) */}
            {!isCollapsed && (
              <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800/80">
                {viewMode === 'grid' ? (
                  <ProductGrid
                    products={section.items}
                    selectedProductIds={selectedProductIds}
                    onProductSelect={onSelect}
                    onProductEdit={onEdit}
                    onProductDelete={onDelete}
                    onProductDuplicate={onDuplicate}
                    onProductViewDetails={onViewDetails}
                    onProductToggleActive={onToggleActive}
                    loading={loading}
                  />
                ) : (
                  <ProductTable
                    products={section.items}
                    selectedProductIds={selectedProductIds}
                    sortConfig={sortConfig}
                    onSort={onSort}
                    onSelectAll={onSelectAll}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onViewDetails={onViewDetails}
                    onToggleActive={onToggleActive}
                    loading={loading}
                    viewMode={viewMode}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

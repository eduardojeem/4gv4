/**
 * ProductCard Component - Modern & Clean Edition
 * Redesigned product card with clean hierarchy, intuitive actions, and modern aesthetics
 */

import React, { useState } from 'react'
import Image from 'next/image'
import {
  Edit, Trash2, Copy, Eye, Package,
  AlertTriangle, CheckCircle2, XCircle, Wrench, Layers3,
  ChevronDown, ChevronUp, ArrowUpRight
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Product } from '@/types/products'
import { getStockStatus, isServiceLikeProduct } from '@/lib/products-dashboard-utils'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCanViewCost } from '@/hooks/use-can-view-cost'

export interface ProductCardProps {
  product: Product
  isSelected: boolean
  onSelect: (id: string) => void
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onDuplicate: (product: Product) => void
  onViewDetails: (product: Product) => void
  onToggleActive?: (product: Product, newValue: boolean) => void
  className?: string
}

function getNormalizedVariants(product: Product) {
  const rawVariants = Array.isArray((product as any).variants) ? (product as any).variants : []
  return rawVariants.map((v: any, index: number) => {
    const attributes: Record<string, string> = {}
    if (v.attributes && typeof v.attributes === 'object' && !Array.isArray(v.attributes)) {
      for (const [k, val] of Object.entries(v.attributes)) {
        if (val !== undefined && val !== null) attributes[k] = String(val)
      }
    } else if (Array.isArray(v.attributes)) {
      for (const item of v.attributes) {
        if (item && typeof item === 'object') {
          const k = item.key || item.attribute_name || item.name || `attr_${index}`
          const val = item.value || item.display_value || ''
          if (k && val) attributes[String(k)] = String(val)
        }
      }
    }

    const name = v.variant_name || v.name || Object.values(attributes).join(' / ') || `Variante ${index + 1}`
    const salePrice = Number(v.sale_price ?? v.salePrice ?? product.sale_price ?? 0)
    const purchasePrice = v.purchase_price !== undefined
      ? Number(v.purchase_price)
      : v.purchasePrice !== undefined
        ? Number(v.purchasePrice)
        : undefined
    const wholesalePrice = v.wholesale_price !== undefined
      ? Number(v.wholesale_price)
      : v.wholesalePrice !== undefined
        ? Number(v.wholesalePrice)
        : undefined
    const stockQuantity = Number(v.stock_quantity ?? v.stockQuantity ?? 0)
    const minStock = v.min_stock !== undefined
      ? Number(v.min_stock)
      : v.minStock !== undefined
        ? Number(v.minStock)
        : undefined
    const isActive = v.is_active !== undefined ? Boolean(v.is_active) : v.isActive !== undefined ? Boolean(v.isActive) : true

    return {
      id: v.id || `var-${index}`,
      name,
      sku: v.sku || undefined,
      barcode: v.barcode || undefined,
      salePrice,
      purchasePrice,
      wholesalePrice,
      stockQuantity,
      minStock,
      isActive,
      attributes,
    }
  })
}

export const ProductCard = React.memo(function ProductCard({
  product,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onViewDetails,
  onToggleActive,
  className
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [showVariantsDrawer, setShowVariantsDrawer] = useState(false)
  const isPubliclyVisible = product.is_active && (product as any).visibility !== 'hidden'
  const [localActive, setLocalActive] = useState(isPubliclyVisible)
  const [togglingActive, setTogglingActive] = useState(false)
  const canViewCost = useCanViewCost()
  const isService = isServiceLikeProduct(product)

  React.useEffect(() => {
    setLocalActive(isPubliclyVisible)
  }, [isPubliclyVisible])

  const variants = getNormalizedVariants(product)
  const hasVariants = variants.length > 0 || Boolean((product as any).has_variants)
  const totalVariantStock = variants.length > 0
    ? variants.reduce((acc, v) => acc + v.stockQuantity, 0)
    : product.stock_quantity

  const prices = variants.map(v => v.salePrice).filter(p => p > 0)
  const minVariantPrice = prices.length > 0 ? Math.min(...prices) : product.sale_price
  const maxVariantPrice = prices.length > 0 ? Math.max(...prices) : product.sale_price
  const hasPriceRange = variants.length > 1 && minVariantPrice !== maxVariantPrice

  const stockStatus = getStockStatus(product)

  const stockStatusConfig = {
    in_stock: {
      label: 'En Stock',
      badgeClass: 'bg-emerald-600/90 text-white',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      barClass: 'from-emerald-500 to-teal-500',
      icon: CheckCircle2
    },
    low_stock: {
      label: 'Stock Bajo',
      badgeClass: 'bg-amber-600/90 text-white',
      textClass: 'text-amber-700 dark:text-amber-400',
      barClass: 'from-amber-500 to-orange-500',
      icon: AlertTriangle
    },
    out_of_stock: {
      label: 'Agotado',
      badgeClass: 'bg-rose-600/90 text-white',
      textClass: 'text-rose-700 dark:text-rose-400',
      barClass: 'from-rose-500 to-red-500',
      icon: XCircle
    }
  }

  const statusConfig = isService
    ? {
        label: 'Servicio',
        badgeClass: 'bg-purple-600/90 text-white',
        textClass: 'text-purple-700 dark:text-purple-400',
        barClass: 'from-purple-500 to-violet-500',
        icon: Wrench
      }
    : stockStatusConfig[stockStatus]
  const StatusIcon = statusConfig.icon

  // Margin calculation — solo admin/super_admin ve costo y margen
  const margin = canViewCost && product.purchase_price && product.purchase_price > 0 && product.sale_price > 0
    ? Math.round(((product.sale_price - product.purchase_price) / product.sale_price) * 100)
    : null

  // Stock fill percentage relative to min_stock threshold
  const minStock = product.min_stock ?? 1
  const effectiveStock = variants.length > 0 ? totalVariantStock : Number(product.stock_quantity || 0)
  const stockFillPct = Math.min(100, Math.round((effectiveStock / Math.max(minStock * 4, 1)) * 100))

  // First letter placeholder
  const firstLetter = product.name.charAt(0).toUpperCase()

  // Resolve usable image URL
  const imageUrl: string | undefined =
    ((product as any).images as string[] | null | undefined)?.[0] ||
    product.image ||
    (product as any).image_url ||
    undefined

  // Images count for the indicator
  const imagesCount: number = ((product as any).images as string[] | null | undefined)?.length ?? (imageUrl ? 1 : 0)

  // Validate image URL
  const isValidImage = imageUrl && (
    imageUrl.startsWith('data:image') ||
    imageUrl.startsWith('/') ||
    imageUrl.startsWith('http')
  )

  // Category label
  const categoryLabel = (product as any).category?.name || (product as any).category || null

  return (
    <Card
      role="article"
      aria-label={`Producto: ${product.name}, Precio: Gs. ${product.sale_price}, Stock: ${product.stock_quantity}`}
      className={cn(
        'group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden',
        'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-2xs',
        'hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700',
        isSelected && 'ring-2 ring-blue-500 border-blue-400 dark:border-blue-600 shadow-md shadow-blue-500/10',
        isHovered && '-translate-y-1',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onViewDetails(product)}
    >
      <CardContent className="p-0 flex flex-col flex-1">
        {/* ── Media Header (Image + Floating Badges) ── */}
        <div className="relative aspect-[16/10] bg-slate-100 dark:bg-slate-800/60 overflow-hidden border-b border-slate-100 dark:border-slate-800/80">
          {isValidImage && !imageError ? (
            <>
              <Image
                src={imageUrl!}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className={cn(
                  'object-cover transition-transform duration-500',
                  isHovered ? 'scale-105' : 'scale-100'
                )}
                onError={() => setImageError(true)}
              />
              <div
                className={cn(
                  'absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent transition-opacity duration-200',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/70 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900">
              <div className="text-center space-y-1">
                <div className="h-12 w-12 rounded-xl bg-white/80 dark:bg-slate-700/80 shadow-xs flex items-center justify-center mx-auto border border-slate-200/60 dark:border-slate-600/60">
                  <Package className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                </div>
                <span className="text-2xl font-black text-slate-300 dark:text-slate-600 tracking-wider">
                  {firstLetter}
                </span>
              </div>
            </div>
          )}

          {/* Checkbox de selección (Top-Left) */}
          <div
            className={cn(
              'absolute top-2.5 left-2.5 z-10 transition-all duration-200',
              isSelected || isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90 sm:group-hover:opacity-100 sm:group-hover:scale-100'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-lg p-1 shadow-xs border border-slate-200/80 dark:border-slate-700/80">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(product.id)}
                aria-label={`Seleccionar ${product.name}`}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
            </div>
          </div>

          {/* Badge de Estado (Top-Right) */}
          <div className="absolute top-2.5 right-2.5 z-10">
            <div className={cn(
              'px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-xs text-[10px] font-bold tracking-wide uppercase',
              statusConfig.badgeClass
            )}>
              <StatusIcon className="h-3 w-3" strokeWidth={2.5} />
              <span>{statusConfig.label}</span>
            </div>
          </div>

          {/* Indicador de fotos (Bottom-Left) */}
          {imagesCount > 1 && (
            <div className="absolute bottom-2 left-2 z-10">
              <span className="px-2 py-0.5 rounded-md bg-slate-900/75 backdrop-blur-md text-white text-[10px] font-semibold shadow-xs">
                +{imagesCount - 1} fotos
              </span>
            </div>
          )}

          {/* Margen comercial para admin (Bottom-Right) */}
          {margin !== null && (
            <div className="absolute bottom-2 right-2 z-10">
              <span className={cn(
                'px-2 py-0.5 rounded-md backdrop-blur-md text-white text-[10px] font-bold shadow-xs',
                margin >= 20 ? 'bg-emerald-600/85' : margin >= 10 ? 'bg-amber-600/85' : 'bg-rose-600/85'
              )}>
                {margin}% mg
              </span>
            </div>
          )}

          {/* Barra Flotante de Acciones en Hover (Centro/Bottom de la imagen) */}
          <div className={cn(
            'absolute inset-x-0 bottom-2 flex justify-center z-20 transition-all duration-200 px-2',
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          )}>
            <div className="flex items-center gap-1 bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md px-1.5 py-1 rounded-xl shadow-lg border border-white/10">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-200 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                onClick={(e) => { e.stopPropagation(); onViewDetails(product) }}
                title="Ver detalles rápidos"
                aria-label={`Ver detalles: ${product.name}`}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-200 hover:text-white hover:bg-blue-600/70 rounded-lg transition-colors"
                onClick={(e) => { e.stopPropagation(); onEdit(product) }}
                title="Editar producto"
                aria-label={`Editar: ${product.name}`}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-200 hover:text-white hover:bg-purple-600/70 rounded-lg transition-colors"
                onClick={(e) => { e.stopPropagation(); onDuplicate(product) }}
                title="Duplicar producto"
                aria-label={`Duplicar: ${product.name}`}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-200 hover:text-rose-200 hover:bg-rose-600/80 rounded-lg transition-colors"
                onClick={(e) => { e.stopPropagation(); onDelete(product) }}
                title="Eliminar producto"
                aria-label={`Eliminar: ${product.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Content Body ── */}
        <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            {/* Fila 1: Metadatos (Tipo/Categoría a la izquierda, SKU a la derecha) */}
            <div className="flex items-center justify-between gap-1.5 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                {isService ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/80 px-2 py-0.5 rounded-md shrink-0">
                    <Wrench className="h-2.5 w-2.5" />
                    Servicio
                  </span>
                ) : variants.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 px-2 py-0.5 rounded-md shrink-0">
                    <Layers3 className="h-2.5 w-2.5" />
                    {variants.length} vars
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 px-2 py-0.5 rounded-md shrink-0">
                    <Package className="h-2.5 w-2.5" />
                    Producto
                  </span>
                )}

                {categoryLabel && (
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]" title={categoryLabel}>
                    {categoryLabel}
                  </span>
                )}
              </div>

              {product.sku && (
                <code className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                  {product.sku}
                </code>
              )}
            </div>

            {/* Fila 2: Nombre del Producto */}
            <div>
              {product.brand && (
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                  {product.brand}
                </p>
              )}
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors min-h-[2.5rem]">
                {product.name}
              </h3>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/70">
            {/* Fila 3: Precios (Venta + Mayorista + Costo) */}
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div>
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {hasPriceRange
                    ? `${formatCurrency(minVariantPrice)} – ${formatCurrency(maxVariantPrice)}`
                    : formatCurrency(product.sale_price)
                  }
                </span>
                {product.wholesale_price && product.wholesale_price > 0 && (
                  <span className="block text-[11px] font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                    May: {formatCurrency(product.wholesale_price)}
                  </span>
                )}
              </div>
              {canViewCost && product.purchase_price && product.purchase_price > 0 && (
                <div className="text-right text-[11px] text-slate-400 dark:text-slate-500 font-medium tabular-nums">
                  <span>Costo: </span>
                  <span className="font-semibold text-slate-600 dark:text-slate-400">{formatCurrency(product.purchase_price)}</span>
                </div>
              )}
            </div>

            {/* Fila 4: Inventario / Stock */}
            {isService ? (
              <div className="rounded-xl border border-purple-200/60 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/25 px-2.5 py-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-purple-700 dark:text-purple-300 text-[11px] flex items-center gap-1.5">
                  <Wrench className="h-3 w-3" />
                  Mano de obra técnica
                </span>
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-100/80 dark:bg-purple-900/50 px-2 py-0.5 rounded-full">
                  Ilimitado
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {variants.length > 0 ? `Stock (${variants.length} variantes)` : 'Stock disponible'}
                  </span>
                  <span className={cn(
                    'font-bold tabular-nums text-xs',
                    stockStatus === 'in_stock' && 'text-emerald-600 dark:text-emerald-400',
                    stockStatus === 'low_stock' && 'text-amber-600 dark:text-amber-400',
                    stockStatus === 'out_of_stock' && 'text-rose-600 dark:text-rose-400',
                  )}>
                    {effectiveStock} u
                    {minStock > 0 && (
                      <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 ml-1">
                        (mín: {minStock})
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', statusConfig.barClass)}
                    style={{ width: `${stockFillPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Variantes Acordeón (si tiene) */}
            {variants.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowVariantsDrawer((prev) => !prev)
                  }}
                  className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200/50 dark:border-indigo-800/40"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers3 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Ver stock por variante ({variants.length})</span>
                  </span>
                  {showVariantsDrawer ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showVariantsDrawer && (
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 text-[11px]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{v.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{v.sku || '—'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            'inline-block px-1.5 py-0.2 rounded text-[10px] font-bold tabular-nums',
                            v.stockQuantity <= 0
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                              : v.minStock && v.stockQuantity <= v.minStock
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          )}>
                            {v.stockQuantity} u
                          </span>
                          <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {formatCurrency(v.salePrice)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Inactivo badge */}
            {!product.is_active && (
              <div className="py-0.5">
                <Badge
                  variant="outline"
                  className="text-[10px] bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 font-medium w-full justify-center py-0.5"
                >
                  ⏸ Producto Desactivado
                </Badge>
              </div>
            )}

            {/* Footer de la tarjeta: Visibilidad + Link Ver Detalle */}
            <div
              className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                {onToggleActive && (
                  <>
                    <Switch
                      checked={localActive}
                      disabled={togglingActive}
                      onCheckedChange={async (checked) => {
                        setLocalActive(checked)
                        setTogglingActive(true)
                        try {
                          await onToggleActive(product, checked)
                        } catch {
                          setLocalActive(!checked)
                        } finally {
                          setTogglingActive(false)
                        }
                      }}
                      aria-label={localActive ? 'Ocultar del catálogo público' : 'Publicar en catálogo'}
                      className="data-[state=checked]:bg-emerald-500 scale-90"
                    />
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      {!product.is_active ? (
                        <span className="text-slate-400">Inactivo</span>
                      ) : (product as any).visibility === 'hidden' ? (
                        <span className="text-slate-500">Oculto</span>
                      ) : (product as any).visibility === 'wholesale' ? (
                        <span className="text-blue-600 dark:text-blue-400">Mayorista</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">Visible</span>
                      )}
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => onViewDetails(product)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <span>Ficha</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.product.name === nextProps.product.name &&
    prevProps.product.sale_price === nextProps.product.sale_price &&
    prevProps.product.stock_quantity === nextProps.product.stock_quantity &&
    prevProps.product.unit_measure === nextProps.product.unit_measure &&
    prevProps.product.image === nextProps.product.image &&
    prevProps.product.is_active === nextProps.product.is_active &&
    prevProps.product.purchase_price === nextProps.product.purchase_price &&
    (prevProps.product as any).visibility === (nextProps.product as any).visibility &&
    JSON.stringify((prevProps.product as any).variants) === JSON.stringify((nextProps.product as any).variants) &&
    JSON.stringify((prevProps.product as any).images) === JSON.stringify((nextProps.product as any).images)
  )
})

'use client'

import React from 'react'
import { Building2, Globe, Calendar, Link as LinkIcon, Package, CheckCircle2, XCircle, Edit, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { Brand } from '@/hooks/useBrands'

interface BrandDetailModalProps {
  isOpen: boolean
  onClose: () => void
  brand?: Brand
  onEdit?: (brand: Brand) => void
}

export function BrandDetailModal({
  isOpen,
  onClose,
  brand,
  onEdit
}: BrandDetailModalProps) {
  if (!brand) return null

  const productCount = brand.stats?.product_count ?? 0

  // Format website link
  const toSafeWebsiteHref = (raw?: string | null) => {
    if (!raw) return null
    const value = raw.trim()
    if (!value) return null
    return /^https?:\/\//i.test(value) ? value : `https://${value}`
  }

  // Format creation date
  const formatCreationDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date)
    } catch {
      return dateString
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md overflow-hidden rounded-[24px] border border-slate-200/50 bg-white/90 backdrop-blur-md dark:bg-slate-950/90 dark:border-slate-800/50 shadow-2xl p-6">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center border border-blue-100/50 dark:border-blue-900/30">
              <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <DialogTitle className="text-xl font-bold text-slate-950 dark:text-slate-50 truncate">
                {brand.name}
              </DialogTitle>
              <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                <Badge
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 border-0 text-white',
                    brand.is_active 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm' 
                      : 'bg-slate-400 dark:bg-slate-700'
                  )}
                >
                  {brand.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
                {brand.country && (
                  <Badge variant="outline" className="text-[10px] font-medium border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                    <Globe className="h-2.5 w-2.5 mr-1" /> {brand.country}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Description */}
          <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100/30 dark:border-slate-800/30 min-h-[80px]">
            {brand.description ? (
              <p className="whitespace-pre-wrap">{brand.description}</p>
            ) : (
              <p className="italic text-slate-400 dark:text-slate-500 text-center py-4">Sin descripción disponible</p>
            )}
          </div>

          <Separator className="bg-slate-100 dark:bg-slate-800/50" />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Founded Year */}
            <div className="p-3 bg-slate-50/30 dark:bg-slate-900/20 rounded-xl border border-slate-100/30 dark:border-slate-800/30 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Fundación
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {brand.founded_year ? `${brand.founded_year}` : 'No registrada'}
              </span>
            </div>

            {/* Products Associated */}
            <div className="p-3 bg-slate-50/30 dark:bg-slate-900/20 rounded-xl border border-slate-100/30 dark:border-slate-800/30 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Package className="h-3 w-3" /> Catálogo
              </span>
              <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                {productCount === 1 ? '1 Producto' : `${productCount} Productos`}
              </span>
            </div>
          </div>

          {/* Website block */}
          {brand.website && (
            <div className="p-3.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-100/30 dark:border-slate-800/30 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1 mb-1">
                  <LinkIcon className="h-3 w-3" /> Sitio Web Oficial
                </span>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                  {brand.website.replace(/^https?:\/\/(www\.)?/, '')}
                </p>
              </div>
              {toSafeWebsiteHref(brand.website) && (
                <a
                  href={toSafeWebsiteHref(brand.website)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900">
                    Visitar <Globe className="h-3 w-3" />
                  </Button>
                </a>
              )}
            </div>
          )}

          <Separator className="bg-slate-100 dark:bg-slate-800/50" />

          {/* Creation Metadata */}
          <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 px-1">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Registro: {formatCreationDate(brand.created_at)}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" className="h-10 text-xs px-4" onClick={onClose}>
            Cerrar
          </Button>
          {onEdit && (
            <Button
              className="h-10 text-xs px-4 gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              onClick={() => {
                onClose()
                onEdit(brand)
              }}
            >
              <Edit className="h-3.5 w-3.5" /> Editar Marca
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

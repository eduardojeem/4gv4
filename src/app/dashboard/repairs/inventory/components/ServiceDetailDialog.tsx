"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Wrench,
  DollarSign,
  EyeOff,
  Globe,
  Lock,
  ShieldCheck,
  TrendingUp,
  Tag,
  Pencil,
  Sparkles,
  Info,
} from 'lucide-react'
import type { Product } from '@/types/product-unified'
import { formatPrice, cn } from '@/lib/utils'

interface ServiceDetailDialogProps {
  service: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (service: Product) => void
}

export function ServiceDetailDialog({ service, open, onOpenChange, onEdit }: ServiceDetailDialogProps) {
  if (!service) return null

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'wholesale': return <Lock className="h-3.5 w-3.5 text-purple-500" />
      case 'hidden': return <EyeOff className="h-3.5 w-3.5 text-gray-500" />
      default: return <Globe className="h-3.5 w-3.5 text-emerald-500" />
    }
  }

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'wholesale': return 'Solo Mayoristas'
      case 'hidden': return 'Oculto en Web'
      default: return 'Público en Web'
    }
  }

  const salePrice = service.sale_price || 0
  const costPrice = service.purchase_price || 0
  const wholesalePrice = service.wholesale_price || 0
  const netMargin = salePrice - costPrice
  const marginPercent = salePrice > 0 ? (netMargin / salePrice) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl">
        {/* Banner Superior con Gradiente */}
        <div className="bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-blue-600/10 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-blue-950/40 p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                  <Wrench className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    {service.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                      <Tag className="h-3 w-3 text-emerald-500" />
                      {service.sku || 'SIN CÓDIGO'}
                    </span>
                    <span>•</span>
                    <Badge variant="outline" className="text-[11px] font-normal border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                      {service.category?.name || 'Mano de Obra / Servicio'}
                    </Badge>
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Desglose Principal de Precios */}
          <div className="grid grid-cols-2 gap-3">
            {/* Precio Cliente / Público */}
            <div className="bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/30 dark:to-blue-900/10 p-4 rounded-2xl border border-blue-200/60 dark:border-blue-900/50 relative overflow-hidden">
              <span className="text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1.5 mb-1">
                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Precio Cliente
              </span>
              <p className="text-2xl font-black text-blue-900 dark:text-blue-100">
                {formatPrice(salePrice)}
              </p>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Tarifa estándar de mostrador</span>
            </div>

            {/* Precio Mayorista */}
            <div className="bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/30 dark:to-purple-900/10 p-4 rounded-2xl border border-purple-200/60 dark:border-purple-900/50 relative overflow-hidden">
              <span className="text-xs text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1.5 mb-1">
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Precio Mayorista
              </span>
              <p className="text-2xl font-black text-purple-900 dark:text-purple-100">
                {wholesalePrice > 0 ? formatPrice(wholesalePrice) : 'No asignado'}
              </p>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Tarifa para gremio / talleres</span>
            </div>
          </div>

          {/* Costo Base y Visibilidad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Costo Base Estimado
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                {formatPrice(costPrice)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                {getVisibilityIcon(service.visibility || 'public')} Visibilidad Web
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {getVisibilityLabel(service.visibility || 'public')}
              </p>
            </div>
          </div>

          {/* Margen de Ganancia Neto */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-200/60 dark:border-emerald-900/40">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                  Margen de Ganancia Estimado
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Beneficio neto de {formatPrice(netMargin)} por servicio realizado
                </p>
              </div>
            </div>

            <Badge
              className={cn(
                "px-3 py-1 text-sm font-extrabold shadow-sm rounded-full",
                marginPercent >= 50 ? 'bg-emerald-500 text-white' :
                marginPercent >= 30 ? 'bg-blue-500 text-white' :
                marginPercent >= 15 ? 'bg-amber-500 text-white' :
                'bg-red-500 text-white'
              )}
            >
              {marginPercent.toFixed(0)}%
            </Badge>
          </div>

          {/* Descripción / Notas */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-blue-500" /> Descripción Detallada
            </span>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {service.description || 'Sin notas ni especificaciones técnicas registradas para este servicio.'}
            </div>
          </div>
        </div>

        {/* Footer con Acciones */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
          >
            Cerrar
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false)
              onEdit(service)
            }}
            className="rounded-xl text-xs gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-md"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar Servicio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

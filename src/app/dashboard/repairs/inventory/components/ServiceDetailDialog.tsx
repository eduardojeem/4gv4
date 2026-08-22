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
  Calculator,
  Plus,
  Equal,
  Users,
  User,
  Zap,
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

  const laborAmount = Math.max(0, salePrice - costPrice)
  const wholesaleLaborAmount = wholesalePrice > 0 ? Math.max(0, wholesalePrice - costPrice) : 0
  const wholesaleDiscount = wholesalePrice > 0 && salePrice > wholesalePrice ? salePrice - wholesalePrice : 0

  const costPercent = salePrice > 0 ? Math.min(100, Math.round((costPrice / salePrice) * 100)) : 0
  const laborPercent = salePrice > 0 ? Math.max(0, 100 - costPercent) : 0
  const marginPercent = salePrice > 0 ? (laborAmount / salePrice) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl max-h-[92vh] flex flex-col">
        {/* Banner Superior con Gradiente */}
        <div className="bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-blue-600/10 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-blue-950/40 p-5 pb-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    {service.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">
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

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* CALCULADORA DE MANO DE OBRA Y DESGLOSE MATEMÁTICO */}
          <div className="p-4 bg-slate-50/90 dark:bg-slate-900/90 rounded-2xl border-2 border-emerald-500/20 dark:border-emerald-500/30 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Calculator className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Fórmula de Mano de Obra y Costos
              </span>
              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-[10px] font-extrabold gap-1">
                <TrendingUp className="h-3 w-3" /> Rentabilidad: {marginPercent.toFixed(0)}%
              </Badge>
            </div>

            {/* 3 Cajas Interactivas de la Ecuación: Repuesto + Mano de Obra = Total */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
              {/* 1. Costo Repuesto */}
              <div className="bg-amber-50/70 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/50">
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1 mb-0.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-600" /> Repuesto Base
                </span>
                <p className="text-lg font-black text-amber-950 dark:text-amber-100">
                  {formatPrice(costPrice)}
                </p>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium">
                  {costPercent}% del precio
                </span>
              </div>

              {/* 2. Mano de Obra */}
              <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-3 rounded-xl border-2 border-emerald-400/80 dark:border-emerald-600 shadow-sm">
                <span className="text-[11px] text-emerald-800 dark:text-emerald-200 font-extrabold flex items-center gap-1 mb-0.5">
                  <Wrench className="h-3.5 w-3.5 text-emerald-600" /> Mano de Obra
                </span>
                <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                  {formatPrice(laborAmount)}
                </p>
                <span className="text-[10px] text-emerald-700/90 dark:text-emerald-400/90 font-medium">
                  {laborPercent}% ganancia técnica
                </span>
              </div>

              {/* 3. Total Cliente */}
              <div className="bg-blue-50/70 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200/80 dark:border-blue-900/50">
                <span className="text-[11px] text-blue-800 dark:text-blue-200 font-bold flex items-center gap-1 mb-0.5">
                  <User className="h-3.5 w-3.5 text-blue-600" /> Total Cliente
                </span>
                <p className="text-lg font-black text-blue-900 dark:text-blue-100">
                  {formatPrice(salePrice)}
                </p>
                <span className="text-[10px] text-blue-700/80 dark:text-blue-400/80 font-medium">
                  Cobro final al cliente
                </span>
              </div>
            </div>

            {/* Barra de Composición Gráfica */}
            {salePrice > 0 && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-amber-700 dark:text-amber-400">
                    Costo Insumo: {formatPrice(costPrice)} ({costPercent}%)
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Mano de Obra: {formatPrice(laborAmount)} ({laborPercent}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="bg-amber-500 transition-all duration-300"
                    style={{ width: `${costPercent}%` }}
                    title={`Repuesto: ${costPercent}%`}
                  />
                  <div
                    className="bg-emerald-500 transition-all duration-300"
                    style={{ width: `${laborPercent}%` }}
                    title={`Mano de Obra: ${laborPercent}%`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tarifa Mayorista y Visibilidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tarifa Mayorista */}
            <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-2xl border border-purple-200/70 dark:border-purple-900/40 relative overflow-hidden">
              <span className="text-xs text-purple-700 dark:text-purple-300 font-bold flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" /> Tarifa Mayorista / Gremios
              </span>
              <p className="text-xl font-black text-purple-900 dark:text-purple-100">
                {wholesalePrice > 0 ? formatPrice(wholesalePrice) : 'No asignado'}
              </p>
              {wholesalePrice > 0 ? (
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-purple-600 text-white text-[9px] py-0 px-1 font-bold">
                    Mano de Obra: {formatPrice(wholesaleLaborAmount)}
                  </Badge>
                  {wholesaleDiscount > 0 && (
                    <span className="text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                      (Ahorro: {formatPrice(wholesaleDiscount)})
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[10px] text-purple-600/70 dark:text-purple-400/70">
                  Sin precio preferencial para técnicos
                </span>
              )}
            </div>

            {/* Visibilidad Web */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between">
              <div>
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  {getVisibilityIcon(service.visibility || 'public')} Visibilidad en Catálogo Web
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {getVisibilityLabel(service.visibility || 'public')}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {service.visibility === 'public' && 'Visible para todos los clientes en el portal web.'}
                {service.visibility === 'wholesale' && 'Solo accesible por clientes con cuenta mayorista.'}
                {service.visibility === 'hidden' && 'Uso exclusivamente interno en mostrador / taller.'}
              </p>
            </div>
          </div>

          {/* Descripción / Notas */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-blue-500" /> Descripción y Notas de Trabajo
            </span>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              {service.description || 'Sin notas ni especificaciones técnicas registradas para este servicio.'}
            </div>
          </div>
        </div>

        {/* Footer con Acciones */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-2 shrink-0">
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
            className="rounded-xl text-xs gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-md"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar Servicio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

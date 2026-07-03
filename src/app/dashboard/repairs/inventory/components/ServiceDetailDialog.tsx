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
import { Wrench, DollarSign, Eye, EyeOff, Globe, Lock, ShieldCheck } from 'lucide-react'
import type { Product } from '@/types/product-unified'
import { formatPrice } from '@/lib/utils'

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
      case 'wholesale': return <Lock className="h-4 w-4" />
      case 'hidden': return <EyeOff className="h-4 w-4" />
      default: return <Globe className="h-4 w-4" />
    }
  }

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'wholesale': return 'Solo Mayoristas'
      case 'hidden': return 'Oculto (Solo Admin)'
      default: return 'Público (Todos)'
    }
  }

  const margin = (service.sale_price || 0) - (service.purchase_price || 0)
  const marginPercent = service.sale_price ? (margin / service.sale_price) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-400/20 to-teal-600/20 rounded-xl">
              <Wrench className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                {service.name}
              </DialogTitle>
              <DialogDescription>
                Detalles del servicio
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-background/50 p-4 rounded-xl border border-border/50">
              <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-500" /> Precio Cliente
              </p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {formatPrice(service.sale_price || 0)}
              </p>
            </div>
            <div className="bg-background/50 p-4 rounded-xl border border-border/50">
              <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-purple-500" /> Precio Mayorista
              </p>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {service.wholesale_price ? formatPrice(service.wholesale_price) : '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-background/50 p-4 rounded-xl border border-border/50">
              <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-green-500" /> Costo Base
              </p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {formatPrice(service.purchase_price || 0)}
              </p>
            </div>
            <div className="bg-background/50 p-4 rounded-xl border border-border/50">
              <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                {getVisibilityIcon(service.visibility || 'public')} Visibilidad
              </p>
              <p className="text-lg font-bold text-foreground">
                {getVisibilityLabel(service.visibility || 'public')}
              </p>
            </div>
          </div>

          <div className="bg-background/50 p-4 rounded-xl border border-border/50">
            <p className="text-sm text-muted-foreground mb-2">Descripción y Notas</p>
            <p className="text-sm text-foreground">
              {service.description || 'No hay descripción disponible para este servicio.'}
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/30">
            <span className="text-sm font-medium">Margen de Ganancia:</span>
            <Badge 
              className={`px-3 py-1 text-sm font-bold ${
                marginPercent >= 50 ? 'bg-green-500 text-white' :
                marginPercent >= 30 ? 'bg-blue-500 text-white' :
                marginPercent >= 15 ? 'bg-amber-500 text-white' :
                'bg-red-500 text-white'
              }`}
            >
              {marginPercent.toFixed(1)}% ({formatPrice(margin)})
            </Badge>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-background/50">
            Cerrar
          </Button>
          <Button 
            onClick={() => {
              onOpenChange(false)
              onEdit(service)
            }}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all"
          >
            Editar Servicio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

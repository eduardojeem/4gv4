"use client"

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useInventory } from '../context/InventoryContext'
import { logger } from '@/lib/logger'
import type { Product } from '@/types/product-unified'
import { toast } from 'sonner'
import { DollarSign, Wrench, Info, HelpCircle, TrendingUp, Users, User, ShieldCheck } from 'lucide-react'
import { formatPrice, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface ServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: Product | null
}

export function ServiceDialog({ open, onOpenChange, service }: ServiceDialogProps) {
  const { createService, updateService } = useInventory()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    wholesalePrice: '',
    cost: '',
    description: '',
    // Los servicios nuevos quedan ocultos en la web por defecto.
    visibility: 'hidden',
    deviceType: '',
    brand: '',
    model: ''
  })

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        price: String(service.sale_price || ''),
        wholesalePrice: service.wholesale_price ? String(service.wholesale_price) : '',
        cost: String(service.purchase_price || ''),
        description: service.description || '',
        visibility: service.visibility || 'public',
        deviceType: service.tags?.find(t => t.startsWith('deviceType:'))?.split(':')[1] || '',
        brand: service.brand || '',
        model: service.tags?.find(t => t.startsWith('model:'))?.split(':')[1] || ''
      })
    } else {
      setFormData({
        name: '',
        price: '',
        wholesalePrice: '',
        cost: '',
        description: '',
        visibility: 'hidden',
        deviceType: '',
        brand: '',
        model: ''
      })
    }
  }, [service, open])

  // Cálculo en vivo de ganancia neta estimada
  const clientPriceNum = parseFloat(formData.price || '0')
  const costNum = parseFloat(formData.cost || '0')
  const estimatedProfit = clientPriceNum > 0 ? clientPriceNum - costNum : 0
  const profitMarginPercent = clientPriceNum > 0 && costNum > 0
    ? Math.round((estimatedProfit / clientPriceNum) * 100)
    : clientPriceNum > 0 && costNum === 0 ? 100 : 0

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      toast.error("Por favor completa el nombre y precio del servicio")
      return
    }

    setIsSubmitting(true)
    try {
      const tags: string[] = []
      if (formData.deviceType) tags.push(`deviceType:${formData.deviceType}`)
      if (formData.model) tags.push(`model:${formData.model}`)

      const serviceData: any = {
        name: formData.name,
        description: formData.description,
        sale_price: parseFloat(formData.price),
        wholesale_price: formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : null,
        purchase_price: formData.cost ? parseFloat(formData.cost) : 0,
        visibility: formData.visibility,
        brand: formData.brand || null,
        tags: tags.length > 0 ? tags : null
      }

      if (service) {
        await updateService(service.id, serviceData)
        toast.success("Servicio actualizado correctamente")
      } else {
        // Generar un SKU único para el nuevo servicio
        serviceData.sku = `SRV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`
        await createService(serviceData)
        toast.success("Servicio creado exitosamente")
      }

      onOpenChange(false)
    } catch (error) {
      logger.error('Error saving service', { error })
      toast.error("Ocurrió un error al guardar el servicio")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl max-h-[90vh] flex flex-col">
        {/* Encabezado */}
        <div className="p-6 pb-4 bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-blue-600/10 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-blue-950/40 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {service ? "Editar Servicio de Reparación" : "Agregar Nuevo Servicio"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Configura tarifas, costos de repuesto y opciones de visibilidad.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Nombre y Visibilidad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Nombre del Servicio <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Wrench className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Ej: Módulo Pantalla iPhone 13 Pro"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-9 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="visibility" className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Visibilidad Web
              </Label>
              <Select
                value={formData.visibility}
                onValueChange={(value) => setFormData({ ...formData, visibility: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="text-xs rounded-xl">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">🌐 Público (Todos)</SelectItem>
                  <SelectItem value="wholesale">🔒 Solo Mayoristas</SelectItem>
                  <SelectItem value="hidden">🙈 Oculto (Interno)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bloque Explicativo de Estructura de Precios */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ¿Qué significa cada precio?
              </span>
              {clientPriceNum > 0 && (
                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-[10px] font-extrabold gap-1">
                  <TrendingUp className="h-3 w-3" /> Ganancia: {formatPrice(estimatedProfit)} ({profitMarginPercent}%)
                </Badge>
              )}
            </div>

            {/* Tres Campos de Precio con Explicación Detallada */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Precio Cliente */}
              <div className="space-y-1.5 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center justify-between">
                  <Label htmlFor="price" className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <User className="h-3 w-3 text-blue-500" /> Precio Cliente
                  </Label>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2 h-3.5 w-3.5 text-blue-500" />
                  <Input
                    id="price"
                    type="number"
                    placeholder="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="pl-7 text-xs font-bold h-8 rounded-lg bg-white dark:bg-slate-950 border-blue-200 dark:border-blue-800 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 leading-tight">
                  Cobro final al cliente común (Mano de obra + Repuesto).
                </p>
              </div>

              {/* Precio Mayorista */}
              <div className="space-y-1.5 bg-purple-50/50 dark:bg-purple-950/20 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/30">
                <div className="flex items-center justify-between">
                  <Label htmlFor="wholesalePrice" className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                    <Users className="h-3 w-3 text-purple-500" /> Precio Mayorista
                  </Label>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2 h-3.5 w-3.5 text-purple-500" />
                  <Input
                    id="wholesalePrice"
                    type="number"
                    placeholder="0"
                    value={formData.wholesalePrice}
                    onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                    className="pl-7 text-xs font-bold h-8 rounded-lg bg-white dark:bg-slate-950 border-purple-200 dark:border-purple-800 focus:ring-purple-500"
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 leading-tight">
                  Tarifa especial para gremio, técnicos aliados o talleres.
                </p>
              </div>

              {/* Costo Estimado del Repuesto */}
              <div className="space-y-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cost" className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-500" /> Costo Base Repuesto
                  </Label>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2 h-3.5 w-3.5 text-emerald-500" />
                  <Input
                    id="cost"
                    type="number"
                    placeholder="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="pl-7 text-xs font-bold h-8 rounded-lg bg-white dark:bg-slate-950 border-emerald-200 dark:border-emerald-800 focus:ring-emerald-500"
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 leading-tight">
                  Lo que te cuesta el repuesto o insumo (uso interno).
                </p>
              </div>
            </div>
          </div>

          {/* Autocompletado de Dispositivo / Marca / Modelo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deviceType" className="text-xs font-semibold">Tipo de Dispositivo</Label>
              <Select
                value={formData.deviceType}
                onValueChange={(value) => setFormData({ ...formData, deviceType: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="text-xs rounded-xl">
                  <SelectValue placeholder="Ej: Smartphone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smartphone">📱 Smartphone</SelectItem>
                  <SelectItem value="laptop">💻 Laptop</SelectItem>
                  <SelectItem value="tablet">平板 Tablet</SelectItem>
                  <SelectItem value="desktop">🖥️ Desktop</SelectItem>
                  <SelectItem value="accessory">🎧 Accesorio</SelectItem>
                  <SelectItem value="other">🔧 Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brand" className="text-xs font-semibold">Marca</Label>
              <Input
                id="brand"
                placeholder="Ej: Apple, Samsung..."
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="text-xs rounded-xl focus:ring-2 focus:ring-emerald-500"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model" className="text-xs font-semibold">Modelo Compatibilidad</Label>
              <Input
                id="model"
                placeholder="Ej: iPhone 13 Pro"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="text-xs rounded-xl focus:ring-2 focus:ring-emerald-500"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Descripción / Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">Descripción o Notas de Trabajo</Label>
            <Input
              id="description"
              placeholder="Ej: Incluye pegamento B7000 y garantía de 3 meses en repuesto"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="text-xs rounded-xl focus:ring-2 focus:ring-emerald-500"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md"
          >
            {isSubmitting ? "Guardando..." : service ? "Actualizar Servicio" : "Crear Servicio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

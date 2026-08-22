"use client"

import { useState, useEffect, useMemo } from 'react'
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
import {
  DollarSign,
  Wrench,
  HelpCircle,
  TrendingUp,
  Users,
  User,
  ShieldCheck,
  Calculator,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Zap,
} from 'lucide-react'
import { formatPrice, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface ServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: Product | null
}

const LABOR_FIXED_PRESETS = [30000, 50000, 80000, 100000, 150000, 200000]
const LABOR_MARGIN_PRESETS = [
  { label: '+30%', factor: 0.3 },
  { label: '+50%', factor: 0.5 },
  { label: '+80%', factor: 0.8 },
  { label: '+100%', factor: 1.0 },
]

export function ServiceDialog({ open, onOpenChange, service }: ServiceDialogProps) {
  const { createService, updateService } = useInventory()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    labor: '',
    price: '',
    wholesaleLabor: '',
    wholesalePrice: '',
    description: '',
    visibility: 'hidden',
    deviceType: '',
    brand: '',
    model: ''
  })

  useEffect(() => {
    if (service) {
      const salePriceNum = service.sale_price || 0
      const costNum = service.purchase_price || 0
      const initialLabor = Math.max(0, salePriceNum - costNum)
      const wholesalePriceNum = service.wholesale_price || 0
      const initialWholesaleLabor = wholesalePriceNum > 0 ? Math.max(0, wholesalePriceNum - costNum) : 0

      setFormData({
        name: service.name || '',
        cost: costNum > 0 ? String(costNum) : '',
        labor: initialLabor > 0 ? String(initialLabor) : '',
        price: salePriceNum > 0 ? String(salePriceNum) : '',
        wholesaleLabor: initialWholesaleLabor > 0 ? String(initialWholesaleLabor) : '',
        wholesalePrice: wholesalePriceNum > 0 ? String(wholesalePriceNum) : '',
        description: service.description || '',
        visibility: service.visibility || 'public',
        deviceType: service.tags?.find(t => t.startsWith('deviceType:'))?.split(':')[1] || '',
        brand: service.brand || '',
        model: service.tags?.find(t => t.startsWith('model:'))?.split(':')[1] || ''
      })
    } else {
      setFormData({
        name: '',
        cost: '',
        labor: '',
        price: '',
        wholesaleLabor: '',
        wholesalePrice: '',
        description: '',
        visibility: 'hidden',
        deviceType: '',
        brand: '',
        model: ''
      })
    }
  }, [service, open])

  // Numéricos
  const costNum = parseFloat(formData.cost || '0')
  const laborNum = parseFloat(formData.labor || '0')
  const clientPriceNum = parseFloat(formData.price || '0')
  const wholesalePriceNum = parseFloat(formData.wholesalePrice || '0')
  const wholesaleLaborNum = parseFloat(formData.wholesaleLabor || '0')

  // Manejador: Cambia el Costo Base del Repuesto
  const handleCostChange = (val: string) => {
    const newCost = parseFloat(val || '0')
    const currentLabor = parseFloat(formData.labor || '0')
    const currentPrice = parseFloat(formData.price || '0')

    let newPriceStr = formData.price
    let newLaborStr = formData.labor

    if (currentLabor > 0) {
      // Si ya hay mano de obra definida, se preserva y se ajusta el precio total
      newPriceStr = String(newCost + currentLabor)
    } else if (currentPrice > 0) {
      // Si hay precio total pero no mano de obra, derivar mano de obra
      newLaborStr = String(Math.max(0, currentPrice - newCost))
    }

    // Ajustar también mayorista si tiene mano de obra mayorista
    const currentWsLabor = parseFloat(formData.wholesaleLabor || '0')
    let newWsPriceStr = formData.wholesalePrice
    if (currentWsLabor > 0) {
      newWsPriceStr = String(newCost + currentWsLabor)
    }

    setFormData(prev => ({
      ...prev,
      cost: val,
      labor: newLaborStr,
      price: newPriceStr,
      wholesalePrice: newWsPriceStr,
    }))
  }

  // Manejador: Cambia la Mano de Obra
  const handleLaborChange = (val: string) => {
    const newLabor = parseFloat(val || '0')
    const currentCost = parseFloat(formData.cost || '0')
    const newPrice = currentCost + newLabor

    setFormData(prev => ({
      ...prev,
      labor: val,
      price: newPrice > 0 ? String(newPrice) : '',
    }))
  }

  // Manejador: Cambia el Precio Cliente (Total)
  const handlePriceChange = (val: string) => {
    const newPrice = parseFloat(val || '0')
    const currentCost = parseFloat(formData.cost || '0')
    const newLabor = Math.max(0, newPrice - currentCost)

    setFormData(prev => ({
      ...prev,
      price: val,
      labor: newLabor > 0 ? String(newLabor) : '',
    }))
  }

  // Manejador: Cambia Mano de Obra Mayorista
  const handleWholesaleLaborChange = (val: string) => {
    const newWsLabor = parseFloat(val || '0')
    const currentCost = parseFloat(formData.cost || '0')
    const newWsPrice = currentCost + newWsLabor

    setFormData(prev => ({
      ...prev,
      wholesaleLabor: val,
      wholesalePrice: newWsPrice > 0 ? String(newWsPrice) : '',
    }))
  }

  // Manejador: Cambia Precio Mayorista (Total)
  const handleWholesalePriceChange = (val: string) => {
    const newWsPrice = parseFloat(val || '0')
    const currentCost = parseFloat(formData.cost || '0')
    const newWsLabor = Math.max(0, newWsPrice - currentCost)

    setFormData(prev => ({
      ...prev,
      wholesalePrice: val,
      wholesaleLabor: newWsLabor > 0 ? String(newWsLabor) : '',
    }))
  }

  // Aplicar Preset de Mano de Obra fija
  const applyFixedLabor = (amount: number) => {
    handleLaborChange(String(amount))
  }

  // Aplicar Preset de Margen porcentual sobre costo
  const applyMarginLabor = (factor: number) => {
    if (costNum > 0) {
      const calculatedLabor = Math.round(costNum * factor)
      handleLaborChange(String(calculatedLabor))
    } else {
      toast.info("Ingresa primero el Costo Base del repuesto para aplicar un % de margen")
    }
  }

  // Preset Mayorista: Mano de obra al 50% de la normal
  const applyWholesaleDiscountLabor = (percentage: number) => {
    const baseLabor = laborNum > 0 ? laborNum : Math.max(0, clientPriceNum - costNum)
    if (baseLabor > 0) {
      const wsLabor = Math.round(baseLabor * (percentage / 100))
      handleWholesaleLaborChange(String(wsLabor))
    } else if (costNum > 0) {
      const wsLabor = Math.round(costNum * 0.3)
      handleWholesaleLaborChange(String(wsLabor))
    } else {
      toast.info("Configura primero la mano de obra o precio cliente")
    }
  }

  // Métricas y porcentajes
  const estimatedProfit = clientPriceNum > 0 ? clientPriceNum - costNum : 0
  const profitMarginPercent = clientPriceNum > 0 && costNum > 0
    ? Math.round((estimatedProfit / clientPriceNum) * 100)
    : clientPriceNum > 0 && costNum === 0 ? 100 : 0

  const costPercent = clientPriceNum > 0 ? Math.min(100, Math.round((costNum / clientPriceNum) * 100)) : 0
  const laborPercent = clientPriceNum > 0 ? Math.max(0, 100 - costPercent) : 0
  const isLoss = clientPriceNum > 0 && costNum > clientPriceNum

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
        name: formData.name.trim(),
        description: formData.description.trim() || null,
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
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl max-h-[92vh] flex flex-col">
        {/* Encabezado */}
        <div className="p-5 pb-3.5 bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-blue-600/10 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-blue-950/40 border-b border-slate-100 dark:border-slate-800 shrink-0">
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
                  Calcula la mano de obra automáticamente según el costo del repuesto y la tarifa pactada.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Nombre y Visibilidad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Nombre del Servicio / Reparación <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Wrench className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Ej: Cambio de Módulo Pantalla OLED"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-9 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                  disabled={isSubmitting}
                  autoFocus
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

          {/* CALCULADORA DE COSTOS Y MANO DE OBRA */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-900/80 rounded-2xl border-2 border-emerald-500/20 dark:border-emerald-500/30 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Calculator className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Calculadora de Mano de Obra y Tarifas
              </span>
              {clientPriceNum > 0 && !isLoss && (
                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-[10px] font-extrabold gap-1">
                  <TrendingUp className="h-3 w-3" /> Mano de Obra: {formatPrice(estimatedProfit)} ({profitMarginPercent}%)
                </Badge>
              )}
              {isLoss && (
                <Badge variant="destructive" className="text-[10px] font-bold gap-1 animate-pulse">
                  <AlertTriangle className="h-3 w-3" /> ¡Precio menor al costo del repuesto!
                </Badge>
              )}
            </div>

            {/* Tres Columnas Sincronizadas: Costo Repuesto + Mano de Obra = Precio Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Costo Base del Repuesto */}
              <div className="space-y-1.5 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                <Label htmlFor="cost" className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-600" /> 1. Costo Repuesto
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-amber-600" />
                  <Input
                    id="cost"
                    type="number"
                    placeholder="0"
                    value={formData.cost}
                    onChange={(e) => handleCostChange(e.target.value)}
                    className="pl-8 text-xs font-bold h-9 rounded-lg bg-white dark:bg-slate-950 border-amber-300 dark:border-amber-800 focus:ring-amber-500"
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 leading-tight">
                  Costo de compra del módulo/repuesto físico.
                </p>
              </div>

              {/* 2. Mano de Obra (Labor) */}
              <div className="space-y-1.5 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-xl border-2 border-emerald-400/80 dark:border-emerald-700 shadow-sm">
                <div className="flex items-center justify-between">
                  <Label htmlFor="labor" className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                    <Wrench className="h-3.5 w-3.5 text-emerald-600" /> 2. Mano de Obra
                  </Label>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded">
                    Ganancia
                  </span>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-emerald-600 font-bold" />
                  <Input
                    id="labor"
                    type="number"
                    placeholder="0"
                    value={formData.labor}
                    onChange={(e) => handleLaborChange(e.target.value)}
                    className="pl-8 text-xs font-black h-9 rounded-lg bg-white dark:bg-slate-950 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 focus:ring-emerald-500"
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-[10px] text-emerald-700/90 dark:text-emerald-400/90 leading-tight">
                  Cobro por el trabajo y servicio técnico realizado.
                </p>
              </div>

              {/* 3. Precio Cliente (Público / Total) */}
              <div className="space-y-1.5 bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200/80 dark:border-blue-900/50">
                <div className="flex items-center justify-between">
                  <Label htmlFor="price" className="text-xs font-bold text-blue-800 dark:text-blue-200 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-blue-600" /> 3. Precio Cliente <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-[9px] font-bold text-blue-700 bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.2 rounded">
                    Total
                  </span>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-blue-600" />
                  <Input
                    id="price"
                    type="number"
                    placeholder="0"
                    value={formData.price}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className="pl-8 text-xs font-black h-9 rounded-lg bg-white dark:bg-slate-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-[10px] text-blue-700/80 dark:text-blue-400/80 leading-tight">
                  Total cobrado en mostrador (Repuesto + Mano de obra).
                </p>
              </div>
            </div>

            {/* Presets Rápidos de Mano de Obra */}
            <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500" /> Presets rápidos de Mano de Obra:
                </span>
                <span className="text-[10px] text-muted-foreground">1-clic para auto-calcular total</span>
              </div>

              {/* Botones Fijos */}
              <div className="flex flex-wrap items-center gap-1.5">
                {LABOR_FIXED_PRESETS.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyFixedLabor(amount)}
                    className={cn(
                      "h-6 text-[10px] font-bold px-2 py-0 rounded-lg transition-all",
                      laborNum === amount
                        ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                        : "hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700"
                    )}
                  >
                    +{formatPrice(amount)}
                  </Button>
                ))}

                {/* Botones Porcentuales sobre Costo */}
                {LABOR_MARGIN_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyMarginLabor(preset.factor)}
                    className="h-6 text-[10px] font-bold px-2 py-0 rounded-lg bg-teal-50/60 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-100"
                  >
                    {preset.label} s/costo
                  </Button>
                ))}
              </div>
            </div>

            {/* Tarifa Mayorista con cálculo de Mano de Obra Mayorista */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200/70 dark:border-purple-900/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-purple-600" />
                    Tarifa Mayorista / Gremios
                  </span>
                  {wholesalePriceNum > 0 && (
                    <Badge variant="outline" className="text-[10px] bg-purple-100/60 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300">
                      Mano de Obra Mayorista: {formatPrice(Math.max(0, wholesalePriceNum - costNum))}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="wholesaleLabor" className="text-[11px] font-bold text-purple-800 dark:text-purple-300">
                      Mano de Obra Mayorista
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-2 h-3.5 w-3.5 text-purple-500" />
                      <Input
                        id="wholesaleLabor"
                        type="number"
                        placeholder="0"
                        value={formData.wholesaleLabor}
                        onChange={(e) => handleWholesaleLaborChange(e.target.value)}
                        className="pl-8 text-xs font-bold h-8 rounded-lg bg-white dark:bg-slate-950 border-purple-300 dark:border-purple-800"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="wholesalePrice" className="text-[11px] font-bold text-purple-800 dark:text-purple-300">
                      Precio Mayorista Total
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-2 h-3.5 w-3.5 text-purple-500" />
                      <Input
                        id="wholesalePrice"
                        type="number"
                        placeholder="0"
                        value={formData.wholesalePrice}
                        onChange={(e) => handleWholesalePriceChange(e.target.value)}
                        className="pl-8 text-xs font-black h-8 rounded-lg bg-white dark:bg-slate-950 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                {/* Presets Rápidos Mayorista */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-purple-700 dark:text-purple-400 font-medium">Atajos:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyWholesaleDiscountLabor(50)}
                    className="h-5 text-[9px] font-bold px-2 py-0 rounded bg-white dark:bg-slate-900 border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    50% Mano de Obra
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyWholesaleDiscountLabor(70)}
                    className="h-5 text-[9px] font-bold px-2 py-0 rounded bg-white dark:bg-slate-900 border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    70% Mano de Obra
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (clientPriceNum > 0) handleWholesalePriceChange(String(clientPriceNum))
                    }}
                    className="h-5 text-[9px] font-bold px-2 py-0 rounded bg-white dark:bg-slate-900 border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    Igual a Cliente
                  </Button>
                </div>
              </div>
            </div>

            {/* Barra de Composición Gráfica */}
            {clientPriceNum > 0 && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-amber-700 dark:text-amber-400">
                    Repuesto: {formatPrice(costNum)} ({costPercent}%)
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Mano de Obra: {formatPrice(laborNum > 0 ? laborNum : Math.max(0, clientPriceNum - costNum))} ({laborPercent}%)
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
                placeholder="Ej: Apple, Samsung, Xiaomi..."
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="text-xs rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model" className="text-xs font-semibold">Modelo Compatibilidad</Label>
              <Input
                id="model"
                placeholder="Ej: iPhone 13 Pro / A2638"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="text-xs rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Descripción / Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">Descripción o Notas de Trabajo</Label>
            <Input
              id="description"
              placeholder="Ej: Incluye pegamento B7000, limpieza interna y garantía de 3 meses"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="text-xs rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
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
            disabled={isSubmitting || !formData.name.trim() || !formData.price.trim()}
            className="rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md gap-1.5"
          >
            {isSubmitting ? "Guardando..." : service ? "Actualizar Servicio" : "Crear Servicio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

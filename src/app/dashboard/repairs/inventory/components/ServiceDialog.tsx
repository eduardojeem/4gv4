
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
import { DollarSign, Wrench, Info } from 'lucide-react'

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
        // Nuevo servicio: oculto en la web por defecto.
        visibility: 'hidden',
        deviceType: '',
        brand: '',
        model: ''
      })
    }
  }, [service, open])

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
      <DialogContent className="sm:max-w-[600px] bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {service ? "Editar Servicio" : "Agregar Nuevo Servicio"}
          </DialogTitle>
          <DialogDescription>
            {service 
              ? "Modifica los detalles del servicio." 
              : "Crea un nuevo servicio de reparación para usar en órdenes de trabajo."}
          </DialogDescription>
        </DialogHeader>

        {!service && (
          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300 mt-2">
            <div className="font-semibold flex items-center gap-1.5 mb-1">
              <Info className="w-4 h-4" /> ¿Cómo funciona esto?
            </div>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>SKU:</strong> Se genera automáticamente al crear.</li>
              <li><strong>Visibilidad:</strong> Por defecto es "Oculto" para que no aparezca en la web hasta que estés listo.</li>
              <li><strong>Precios:</strong> El sistema usará el <em>Precio Mayorista</em> si el cliente tiene cuenta mayorista. El <em>Costo</em> es solo interno para medir tus ganancias.</li>
            </ul>
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-sm font-semibold">
                Nombre del Servicio
              </Label>
              <div className="relative">
                <Wrench className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Ej: Cambio Pantalla iPhone 13"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-9 focus:ring-2 focus:ring-blue-500 bg-background/50"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="visibility" className="text-sm font-semibold">
                Visibilidad
              </Label>
              <Select
                value={formData.visibility}
                onValueChange={(value) => setFormData({ ...formData, visibility: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Público (Todos)</SelectItem>
                  <SelectItem value="wholesale">Solo Mayoristas</SelectItem>
                  <SelectItem value="hidden">Oculto (Solo Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="price" className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                Precio Cliente
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-blue-500/70" />
                <Input
                  id="price"
                  type="number"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="pl-9 focus:ring-2 focus:ring-blue-500 bg-background/50"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wholesalePrice" className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                Precio Mayorista
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-purple-500/70" />
                <Input
                  id="wholesalePrice"
                  type="number"
                  placeholder="0.00"
                  value={formData.wholesalePrice}
                  onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                  className="pl-9 focus:ring-2 focus:ring-purple-500 bg-background/50"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cost" className="text-sm font-semibold text-green-600 dark:text-green-400">
                Costo Estimado
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-green-500/70" />
                <Input
                  id="cost"
                  type="number"
                  placeholder="0.00"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="pl-9 focus:ring-2 focus:ring-green-500 bg-background/50"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="deviceType" className="text-sm font-semibold">
                Tipo (Autocompletar)
              </Label>
              <Select
                value={formData.deviceType}
                onValueChange={(value) => setFormData({ ...formData, deviceType: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Ej: Smartphone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smartphone">Smartphone</SelectItem>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="accessory">Accesorio</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="brand" className="text-sm font-semibold">
                Marca (Autocompletar)
              </Label>
              <Input
                id="brand"
                placeholder="Ej: Apple, Samsung..."
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="focus:ring-2 focus:ring-blue-500 bg-background/50"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="model" className="text-sm font-semibold">
                Modelo (Autocompletar)
              </Label>
              <Input
                id="model"
                placeholder="Ej: iPhone 13..."
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="focus:ring-2 focus:ring-blue-500 bg-background/50"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description" className="text-sm font-semibold">
              Descripción / Notas
            </Label>
            <Input
              id="description"
              placeholder="Detalles adicionales..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="focus:ring-2 focus:ring-blue-500 bg-background/50"
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="hover:bg-gray-100 dark:hover:bg-gray-800 bg-background/50"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md transition-all hover:shadow-lg"
          >
            {isSubmitting ? "Guardando..." : "Guardar Servicio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

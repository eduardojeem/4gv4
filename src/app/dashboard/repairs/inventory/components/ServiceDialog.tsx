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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useInventory } from '../context/InventoryContext'

interface ServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: any
}

export function ServiceDialog({ open, onOpenChange, service }: ServiceDialogProps) {
  const { createService, updateService } = useInventory()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    wholesalePrice: '',
    cost: '',
    description: ''
  })

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        price: String(service.sale_price || ''),
        wholesalePrice: service.wholesale_price ? String(service.wholesale_price) : '',
        cost: String(service.purchase_price || ''),
        description: service.description || ''
      })
    } else {
      setFormData({
        name: '',
        price: '',
        wholesalePrice: '',
        cost: '',
        description: ''
      })
    }
  }, [service, open])

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      alert("Por favor completa el nombre y precio del servicio")
      return
    }

    setIsSubmitting(true)
    try {
      const serviceData = {
        name: formData.name,
        description: formData.description,
        sale_price: parseFloat(formData.price),
        wholesale_price: formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : null,
        purchase_price: formData.cost ? parseFloat(formData.cost) : 0,
      }

      if (service) {
        await updateService(service.id, serviceData)
      } else {
        await createService(serviceData)
      }

      onOpenChange(false)
    } catch (error) {
      console.error('Error saving service:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-sm font-semibold">
              Nombre del Servicio
            </Label>
            <Input
              id="name"
              placeholder="Ej: Cambio Pantalla iPhone 13"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="price" className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                Precio Cliente ($)
              </Label>
              <Input
                id="price"
                type="number"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wholesalePrice" className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                Precio Mayorista ($)
              </Label>
              <Input
                id="wholesalePrice"
                type="number"
                placeholder="0.00"
                value={formData.wholesalePrice}
                onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                className="focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cost" className="text-sm font-semibold text-green-600 dark:text-green-400">
                Costo Estimado ($)
              </Label>
              <Input
                id="cost"
                type="number"
                placeholder="0.00"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                className="focus:ring-2 focus:ring-green-500"
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
              className="focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md"
          >
            {isSubmitting ? "Guardando..." : "Guardar Servicio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Tag, Palette, Hash, Eye, EyeOff, Save, X, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Category, CategoryFormData, ValidationErrors, ModalMode } from '@/lib/types/catalog'

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  mode: ModalMode
  category?: Category
  onSave: (category: Category) => void
  existingCategories: Category[]
}

const PREDEFINED_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
]

const CATEGORY_ICONS = [
  'Tag', 'Package', 'Smartphone', 'Tablet', 'Laptop', 'Headphones',
  'Camera', 'Battery', 'Wrench', 'Shield', 'Star', 'Heart'
]

export function CategoryModal({
  isOpen,
  onClose,
  mode,
  category,
  onSave,
  existingCategories
}: CategoryModalProps) {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    subcategories: '',
    color: '#3B82F6',
    icon: 'Tag'
  })
  
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [previewSubcategories, setPreviewSubcategories] = useState<string[]>([])

  // Inicializar formulario cuando cambia la categoría
  useEffect(() => {
    if (mode === 'edit' && category) {
      setFormData({
        name: category.name,
        description: category.description,
        subcategories: category.subcategories.join(', '),
        color: category.color,
        icon: category.icon || 'Tag'
      })
    } else {
      setFormData({
        name: '',
        description: '',
        subcategories: '',
        color: '#3B82F6',
        icon: 'Tag'
      })
    }
    setErrors({})
  }, [mode, category, isOpen])

  // Actualizar preview de subcategorías
  useEffect(() => {
    const subcats = formData.subcategories
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    setPreviewSubcategories(subcats)
  }, [formData.subcategories])

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    // Validar nombre
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    } else if (formData.name.length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres'
    } else {
      // Verificar duplicados
      const isDuplicate = existingCategories.some(cat => 
        cat.name.toLowerCase() === formData.name.toLowerCase() && 
        cat.id !== category?.id
      )
      if (isDuplicate) {
        newErrors.name = 'Ya existe una categoría con este nombre'
      }
    }

    // Validar descripción (opcional para creación rápida)
    if (formData.description && formData.description.length > 0 && formData.description.length < 3) {
      newErrors.description = 'La descripción debe tener al menos 3 caracteres'
    }

    // Validación de subcategorías opcional

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof CategoryFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Por favor corrige los errores en el formulario')
      return
    }

    setIsSubmitting(true)

    try {
      const categoryData: Category = {
        id: category?.id || `cat_${Date.now()}`,
        name: formData.name.trim(),
        description: formData.description.trim(),
        subcategories: previewSubcategories,
        color: formData.color,
        icon: formData.icon,
        isActive: category?.isActive ?? true,
        productCount: category?.productCount ?? 0,
        createdAt: category?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      onSave(categoryData)
      
      toast.success(
        mode === 'add' 
          ? 'Categoría creada exitosamente' 
          : 'Categoría actualizada exitosamente'
      )
      
      onClose()
    } catch (error) {
      toast.error('Error al guardar la categoría')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Tag className="w-5 h-5 text-blue-600" />
            {mode === 'add' ? 'Agregar Nueva Categoría' : 'Editar Categoría'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add' 
              ? 'Crea una nueva categoría para organizar tus productos'
              : 'Modifica la información de la categoría'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información básica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Información Básica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Nombre de la Categoría *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ej: Smartphones, Accesorios, Repuestos"
                  className={cn(errors.name && 'border-red-500')}
                />
                {errors.name && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Descripción
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe qué tipo de productos incluye esta categoría (opcional)"
                  rows={2}
                  className={cn(errors.description && 'border-red-500')}
                />
                {errors.description && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.description}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Subcategorías (opcional, colapsado por defecto) */}
          <details className="group">
            <summary className="cursor-pointer list-none">
              <Card className="group-open:rounded-b-none">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <Hash className="w-4 h-4" />
                    Subcategorías y personalización (opcional)
                  </CardTitle>
                </CardHeader>
              </Card>
            </summary>
            <Card className="rounded-t-none border-t-0">
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="subcategories" className="text-sm font-medium">
                    Lista de Subcategorías
                  </Label>
                  <Textarea
                    id="subcategories"
                    value={formData.subcategories}
                    onChange={(e) => handleInputChange('subcategories', e.target.value)}
                    placeholder="iPhone, Samsung Galaxy, Xiaomi, Huawei"
                    rows={2}
                    className={cn(errors.subcategories && 'border-red-500')}
                  />
                  <p className="text-xs text-muted-foreground">Separa con comas</p>
                </div>

                {previewSubcategories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {previewSubcategories.map((subcat, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {subcat}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Color */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Color</Label>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-7 h-7 rounded-lg border"
                      style={{ backgroundColor: formData.color }}
                    />
                    <div className="flex gap-1 flex-wrap">
                      {PREDEFINED_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="w-6 h-6 rounded border hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          onClick={() => handleInputChange('color', color)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </details>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {mode === 'add' ? 'Crear Categoría' : 'Actualizar Categoría'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Ejemplo de uso de las mejoras implementadas en RepairFormDialogV2
 * 
 * Este archivo muestra cómo integrar:
 * - useImageUpload: Upload con retry automático
 * - formatCurrency: Formateo de moneda configurable
 * - useConfirmDialog: Confirmaciones de eliminación
 * - useAutoSave: Auto-guardado de borradores
 * - useKeyboardShortcuts: Atajos de teclado
 */

'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash, Save, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Importar las nuevas utilidades
import { useImageUpload } from '@/hooks/useImageUpload'
import { formatCurrency, formatCurrencyCompact } from '@/lib/currency'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAutoSave, useDraftRecovery } from '@/hooks/useAutoSave'
import { useKeyboardShortcuts, commonShortcuts } from '@/hooks/useKeyboardShortcuts'

interface RepairFormData {
  customerName: string
  deviceBrand: string
  deviceModel: string
  estimatedCost: number
  images: string[]
}

export function RepairFormEnhanced() {
  const [images, setImages] = useState<string[]>([])
  
  // 1. Hook de formulario
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<RepairFormData>({
    defaultValues: {
      customerName: '',
      deviceBrand: '',
      deviceModel: '',
      estimatedCost: 0,
      images: []
    }
  })

  const formData = watch()

  // 2. Hook de upload de imágenes con retry
  const { uploadFiles, isUploading, uploadProgress } = useImageUpload({
    maxRetries: 3,
    retryDelay: 1000,
    onProgress: (progress) => {
      console.log('Upload progress:', progress)
    }
  })

  // 3. Hook de confirmación
  const { confirm, ConfirmDialog } = useConfirmDialog()

  // 4. Auto-save de borradores
  const { clearDraft, hasDraft, getDraftTimestamp } = useAutoSave({
    data: formData,
    key: 'repair-form-enhanced',
    interval: 30000, // 30 segundos
    enabled: true,
    onSave: (data) => {
      console.log('Draft saved:', data)
    }
  })

  // 5. Recuperación de borradores al montar
  useDraftRecovery<RepairFormData>('repair-form-enhanced', (data) => {
    reset(data)
  })

  // 6. Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      commonShortcuts.save(() => {
        handleSubmit(onSubmit)()
      }),
      commonShortcuts.close(() => {
        handleClose()
      }),
      {
        key: 'i',
        ctrl: true,
        callback: () => {
          document.getElementById('image-upload')?.click()
        },
        description: 'Subir imagen (Ctrl+I)'
      }
    ],
    enabled: true
  })

  // Handlers
  const onSubmit = async (data: RepairFormData) => {
    try {
      console.log('Submitting:', data)
      toast.success('Reparación guardada exitosamente')
      clearDraft()
      reset()
    } catch (error) {
      toast.error('Error al guardar la reparación')
    }
  }

  const handleClose = () => {
    if (hasDraft()) {
      confirm({
        title: '¿Cerrar sin guardar?',
        description: 'Tienes cambios sin guardar. ¿Estás seguro de que quieres cerrar?',
        confirmText: 'Cerrar',
        cancelText: 'Cancelar',
        variant: 'destructive',
        onConfirm: () => {
          clearDraft()
          reset()
        }
      })
    } else {
      reset()
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    try {
      const urls = await uploadFiles(files, 'repair-images')
      setImages(prev => [...prev, ...urls])
      toast.success(`${urls.length} imagen(es) subida(s) exitosamente`)
    } catch (error) {
      toast.error('Error al subir imágenes')
    }
  }

  const handleRemoveImage = (index: number) => {
    confirm({
      title: '¿Eliminar imagen?',
      description: 'Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'destructive',
      onConfirm: () => {
        setImages(prev => prev.filter((_, i) => i !== index))
        toast.success('Imagen eliminada')
      }
    })
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Nueva Reparación</h2>
          <p className="text-sm text-muted-foreground">
            Formulario con mejoras implementadas
          </p>
        </div>
        {hasDraft() && (
          <div className="text-xs text-muted-foreground">
            Borrador guardado: {getDraftTimestamp()?.toLocaleTimeString()}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Cliente */}
        <div className="space-y-2">
          <Label htmlFor="customerName">Nombre del Cliente</Label>
          <Input
            id="customerName"
            {...register('customerName', { required: 'Campo requerido' })}
            placeholder="Juan Pérez"
          />
          {errors.customerName && (
            <p className="text-sm text-red-500">{errors.customerName.message}</p>
          )}
        </div>

        {/* Dispositivo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="deviceBrand">Marca</Label>
            <Input
              id="deviceBrand"
              {...register('deviceBrand', { required: 'Campo requerido' })}
              placeholder="Apple"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deviceModel">Modelo</Label>
            <Input
              id="deviceModel"
              {...register('deviceModel', { required: 'Campo requerido' })}
              placeholder="iPhone 15 Pro"
            />
          </div>
        </div>

        {/* Costo - Usando formatCurrency */}
        <div className="space-y-2">
          <Label htmlFor="estimatedCost">Costo Estimado</Label>
          <Input
            id="estimatedCost"
            type="number"
            {...register('estimatedCost', { valueAsNumber: true })}
            placeholder="0"
          />
          {watch('estimatedCost') > 0 && (
            <p className="text-sm text-muted-foreground">
              Formato: {formatCurrency(watch('estimatedCost'))} 
              {' | '}
              Compacto: {formatCurrencyCompact(watch('estimatedCost'))}
            </p>
          )}
        </div>

        {/* Imágenes - Usando useImageUpload */}
        <div className="space-y-2">
          <Label htmlFor="image-upload">Imágenes del Dispositivo</Label>
          <Input
            id="image-upload"
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            disabled={isUploading}
          />
          
          {/* Progress de upload */}
          {isUploading && (
            <div className="space-y-2">
              {uploadProgress.map((progress, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{progress.fileName}</span>
                  <span className="text-muted-foreground">
                    {progress.status === 'uploading' && `${progress.progress}%`}
                    {progress.status === 'success' && '✓'}
                    {progress.status === 'error' && '✗'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Galería de imágenes */}
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {images.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Imagen ${index + 1}`}
                    className="w-full h-24 object-cover rounded border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveImage(index)}
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-2 justify-end pt-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button type="submit">
            <Save className="h-4 w-4 mr-2" />
            Guardar (Ctrl+S)
          </Button>
        </div>
      </form>

      {/* Ayuda de shortcuts */}
      <div className="border-t pt-4">
        <p className="text-sm font-medium mb-2">Atajos de teclado:</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Ctrl+S: Guardar</li>
          <li>• Esc: Cerrar</li>
          <li>• Ctrl+I: Subir imagen</li>
        </ul>
      </div>

      {/* Diálogo de confirmación */}
      <ConfirmDialog />
    </div>
  )
}

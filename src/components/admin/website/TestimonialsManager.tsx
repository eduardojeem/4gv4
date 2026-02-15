'use client'

import { useEffect, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Save, Plus, Trash2, Star, Check, GripVertical } from 'lucide-react'
import { Testimonial } from '@/types/website-settings'

export function TestimonialsManager() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [testimonials, setTestimonials] = useState<Testimonial[] | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (settings?.testimonials) {
      setTestimonials(settings.testimonials)
    }
  }, [settings?.testimonials])

  const handleSave = async () => {
    if (!testimonials) return

    // Validar que todos los testimonios tengan datos completos
    const invalidTestimonial = testimonials.find(
      t => !t.name.trim() || !t.comment.trim() || t.rating < 1 || t.rating > 5
    )
    
    if (invalidTestimonial) {
      toast.error('Testimonios incompletos', {
        description: 'Todos los testimonios deben tener nombre, comentario y rating válido'
      })
      return
    }

    // Validar longitud mínima de comentarios
    const shortComment = testimonials.find(t => t.comment.trim().length < 10)
    if (shortComment) {
      toast.error('Comentario muy corto', {
        description: 'Los comentarios deben tener al menos 10 caracteres'
      })
      return
    }

    const result = await updateSetting('testimonials', testimonials)
    if (result.success) {
      toast.success('Testimonios actualizados', {
        icon: <Check className="h-4 w-4" />
      })
      setHasChanges(false)
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleAdd = () => {
    const MAX_TESTIMONIALS = 20
    
    if (testimonials && testimonials.length >= MAX_TESTIMONIALS) {
      toast.error(`Máximo ${MAX_TESTIMONIALS} testimonios`, {
        description: 'Has alcanzado el límite de testimonios permitidos'
      })
      return
    }
    
    const newTestimonial: Testimonial = {
      id: Date.now().toString(),
      name: '',
      rating: 5,
      comment: ''
    }
    setTestimonials([...(testimonials || []), newTestimonial])
    setHasChanges(true)
  }

  const handleDelete = (id: string) => {
    if (!testimonials) return
    
    // Confirmación antes de eliminar
    if (!confirm('¿Estás seguro de eliminar este testimonio?')) {
      return
    }
    
    setTestimonials(testimonials.filter((t) => t.id !== id))
    setHasChanges(true)
  }

  const handleUpdate = (id: string, field: keyof Testimonial, value: string | number) => {
    if (!testimonials) return
    
    // Validar rating
    if (field === 'rating') {
      const rating = typeof value === 'number' ? value : parseInt(value as string)
      if (rating < 1 || rating > 5) {
        toast.error('Rating debe estar entre 1 y 5')
        return
      }
      value = rating
    }
    
    setTestimonials(
      testimonials.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    )
    setHasChanges(true)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Cargando testimonios...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-red-600">
        Error al cargar testimonios: {error}
      </div>
    )
  }

  if (!testimonials) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        No se encontraron testimonios configurados.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 p-6">
        <div>
          <h3 className="text-lg font-semibold">Testimonios de Clientes</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona las reseñas mostradas en el portal público ({testimonials.length} testimonios)
          </p>
        </div>
        <Button onClick={handleAdd} size="sm" className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700">
          <Plus className="mr-2 h-4 w-4" />
          Agregar Testimonio
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {testimonials.map((testimonial, index) => (
          <Card key={testimonial.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardHeader className="bg-gradient-to-r from-orange-50/50 to-red-50/50 dark:from-orange-950/10 dark:to-red-950/10 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">Testimonio #{index + 1}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(testimonial.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`name-${testimonial.id}`}>Nombre del Cliente</Label>
                  <Input
                    id={`name-${testimonial.id}`}
                    value={testimonial.name}
                    onChange={(e) => handleUpdate(testimonial.id, 'name', e.target.value)}
                    placeholder="Nombre Apellido"
                    maxLength={100}
                    className="border-gray-200 focus:border-orange-500 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`rating-${testimonial.id}`}>Calificación</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`rating-${testimonial.id}`}
                      type="number"
                      min="1"
                      max="5"
                      value={testimonial.rating}
                      onChange={(e) => handleUpdate(testimonial.id, 'rating', parseInt(e.target.value))}
                      className="w-20 border-gray-200 focus:border-orange-500 focus:ring-orange-500"
                    />
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 transition-colors ${
                            i < testimonial.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`comment-${testimonial.id}`}>Comentario</Label>
                <Textarea
                  id={`comment-${testimonial.id}`}
                  value={testimonial.comment}
                  onChange={(e) => handleUpdate(testimonial.id, 'comment', e.target.value)}
                  placeholder="Escribe el testimonio del cliente..."
                  rows={3}
                  maxLength={500}
                  className="border-gray-200 focus:border-orange-500 focus:ring-orange-500 resize-none"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {testimonials.length === 0 && (
        <div className="text-center py-12 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center">
            <Star className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-sm text-muted-foreground mb-4">No hay testimonios todavía</p>
            <Button onClick={handleAdd} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Primer Testimonio
            </Button>
          </div>
        </div>
      )}

      <div className="sticky bottom-6 flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !hasChanges}
          size="lg"
          className="shadow-lg bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 transition-all duration-300"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              Guardar Todos los Cambios
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

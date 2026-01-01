'use client'

import React, { useState } from 'react'
import { usePromotions } from '@/hooks/use-promotions'
import type { Promotion, PromotionType } from '@/types/promotion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Edit, Trash2, TrendingUp, Users, Target } from 'lucide-react'

interface PromotionFormData {
  code: string
  name: string
  description: string
  type: PromotionType
  value: number
  min_purchase?: number
  max_discount?: number
  start_date: string
  end_date: string
  is_active: boolean
}

const initialFormData: PromotionFormData = {
  code: '',
  name: '',
  description: '',
  type: 'percentage',
  value: 0,
  min_purchase: 0,
  is_active: true,
  start_date: new Date().toISOString().split('T')[0],
  end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
}

export function PromotionManager() {
  const {
    promotions: rawPromotions,
    loading,
    createPromotion,
    updatePromotion,
    deletePromotion
  } = usePromotions()

  // Adapter to convert HookPromotion[] to Promotion[]
  const promotions: Promotion[] = rawPromotions.map(p => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    type: p.type,
    value: p.value,
    min_purchase: p.min_purchase,
    max_discount: p.max_discount,
    start_date: p.start_date,
    end_date: p.end_date,
    is_active: p.is_active,
    usage_count: p.usage_count,
    usage_limit: p.usage_limit
  }))

  const [activeTab, setActiveTab] = useState('list')
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [formData, setFormData] = useState<PromotionFormData>(initialFormData)
  const [showForm, setShowForm] = useState(false)

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingPromotion) {
        await updatePromotion(editingPromotion.id, {
          ...formData,
          // Remove undefined values
          min_purchase: formData.min_purchase || undefined,
          max_discount: formData.max_discount || undefined
        })
      } else {
        await createPromotion({
          ...formData,
          min_purchase: formData.min_purchase || undefined,
          max_discount: formData.max_discount || undefined,
          usage_limit: undefined // Optional in form
        })
      }
      
      setShowForm(false)
      setEditingPromotion(null)
      setFormData(initialFormData)
    } catch (err) {
      console.error('Error saving promotion:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta promoción?')) {
      await deletePromotion(id)
    }
  }

  // Manejar edición
  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion)
    setFormData({
      code: promotion.code,
      name: promotion.name,
      description: promotion.description || '',
      type: promotion.type,
      value: promotion.value,
      min_purchase: promotion.min_purchase,
      max_discount: promotion.max_discount,
      start_date: promotion.start_date ? promotion.start_date.split('T')[0] : '',
      end_date: promotion.end_date ? promotion.end_date.split('T')[0] : '',
      is_active: promotion.is_active
    })
    setShowForm(true)
  }

  // Obtener color del badge según el tipo
  const getTypeColor = (type: PromotionType) => {
    const colors = {
      percentage: 'bg-blue-100 text-blue-800',
      fixed: 'bg-green-100 text-green-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  // Obtener estadísticas resumidas
  const getOverallStats = () => {
    const activePromotions = promotions.filter(p => p.is_active).length
    const totalUsage = promotions.reduce((sum, p) => sum + (p.usage_count || 0), 0)
    // Estimación simple del descuento total dado
    const totalDiscountGiven = totalUsage * 10 

    return {
      activePromotions,
      totalUsage,
      totalDiscountGiven
    }
  }

  const stats = getOverallStats()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Cargando promociones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Promociones Activas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activePromotions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Usos Totales</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsage}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Descuento Total Est.</p>
                <p className="text-2xl font-bold text-gray-900">${stats.totalDiscountGiven}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="list">Lista de Promociones</TabsTrigger>
            <TabsTrigger value="analytics">Analíticas</TabsTrigger>
          </TabsList>
          
          <Button 
            onClick={() => {
              setShowForm(true)
              setEditingPromotion(null)
              setFormData(initialFormData)
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva Promoción
          </Button>
        </div>

        <TabsContent value="list" className="space-y-4">
          {/* Lista de promociones */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promotions.map((promotion) => (
              <Card key={promotion.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {promotion.name}
                        <Badge className={getTypeColor(promotion.type)}>
                          {promotion.type}
                        </Badge>
                        {!promotion.is_active && (
                          <Badge variant="secondary">Inactiva</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {promotion.description}
                        <br />
                        <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                          {promotion.code}
                        </span>
                      </CardDescription>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(promotion)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(promotion.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-600">Valor</p>
                      <p className="text-lg font-semibold">
                        {promotion.type === 'percentage' ? `${promotion.value}%` : `$${promotion.value}`}
                      </p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-600">Mín. Compra</p>
                      <p className="text-lg font-semibold">
                        {promotion.min_purchase ? `$${promotion.min_purchase}` : '-'}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-gray-600">Inicio</p>
                      <p className="text-sm font-semibold">
                        {promotion.start_date ? new Date(promotion.start_date).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-600">Fin</p>
                      <p className="text-sm font-semibold">
                        {promotion.end_date 
                          ? new Date(promotion.end_date).toLocaleDateString()
                          : 'Sin límite'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analíticas de Promociones</CardTitle>
              <CardDescription>
                Estadísticas detalladas del rendimiento de las promociones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Las analíticas detalladas estarán disponibles próximamente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingPromotion ? 'Editar Promoción' : 'Nueva Promoción'}
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="code">Código</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Tipo</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: PromotionType) => 
                        setFormData(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Descuento Porcentual</SelectItem>
                        <SelectItem value="fixed">Descuento Fijo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="value">Valor ({formData.type === 'percentage' ? '%' : '$'})</Label>
                    <Input
                      id="value"
                      type="number"
                      value={formData.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) }))}
                      required
                      min="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_purchase">Compra Mínima ($)</Label>
                    <Input
                      id="min_purchase"
                      type="number"
                      value={formData.min_purchase}
                      onChange={(e) => setFormData(prev => ({ ...prev, min_purchase: parseFloat(e.target.value) }))}
                      min="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_discount">Tope de Descuento ($)</Label>
                    <Input
                      id="max_discount"
                      type="number"
                      value={formData.max_discount || ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        max_discount: e.target.value ? parseFloat(e.target.value) : undefined 
                      }))}
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Fecha de Inicio</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="end_date">Fecha de Fin</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="active">Promoción Activa</Label>
                </div>

                <Separator />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false)
                      setEditingPromotion(null)
                      setFormData(initialFormData)
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingPromotion ? 'Actualizar' : 'Crear'} Promoción
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

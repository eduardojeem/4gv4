'use client'

import { useState } from 'react'
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar as CalendarIcon, 
  Tag, 
  Percent, 
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  Edit,
  Copy,
  Download,
  TrendingUp,
  Users,
  AlertTriangle,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from '@/lib/currency'
import { usePromotions, type Promotion } from '@/hooks/use-promotions'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

export default function PromotionsPage() {
  const {
    promotions,
    loading,
    stats,
    filters,
    createPromotion,
    updatePromotion,
    deletePromotion,
    duplicatePromotion,
    togglePromotionStatus,
    updateFilters,
    clearFilters,
    getPromotionStatus,
    isPromotionExpiringSoon,
    getPromotionInsights,
    exportPromotions,
    cleanupExpiredPromotions,
    validatePromotionCode
  } = usePromotions()
  
  // Modal states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentPromotion, setCurrentPromotion] = useState<Promotion | null>(null)
  const [saving, setSaving] = useState(false)

  // Form states
  const [formData, setFormData] = useState<{
    name: string
    code: string
    description: string
    type: 'percentage' | 'fixed'
    value: string
    min_purchase: string
    max_discount: string
    start_date: Date | undefined
    end_date: Date | undefined
    is_active: boolean
    usage_limit: string
  }>({
    name: '',
    code: '',
    description: '',
    type: 'percentage',
    value: '',
    min_purchase: '',
    max_discount: '',
    start_date: undefined,
    end_date: undefined,
    is_active: true,
    usage_limit: ''
  })

  const getStatusBadge = (promo: Promotion) => {
    const status = getPromotionStatus(promo)
    const isExpiring = isPromotionExpiringSoon(promo)
    
    switch (status) {
      case 'active':
        return (
          <Badge className={`${isExpiring ? 'bg-orange-100 text-orange-800 hover:bg-orange-100' : 'bg-green-100 text-green-800 hover:bg-green-100'} dark:bg-green-900/30 dark:text-green-400`}>
            {isExpiring ? 'Expira Pronto' : 'Activo'}
          </Badge>
        )
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">Programado</Badge>
      case 'expired':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400">Expirado</Badge>
      case 'inactive':
        return <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      type: 'percentage',
      value: '',
      min_purchase: '',
      max_discount: '',
      start_date: undefined,
      end_date: undefined,
      is_active: true,
      usage_limit: ''
    })
    setIsEditing(false)
    setCurrentPromotion(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (promo: Promotion) => {
    setFormData({
      name: promo.name,
      code: promo.code,
      description: promo.description || '',
      type: promo.type,
      value: promo.value.toString(),
      min_purchase: promo.min_purchase?.toString() || '',
      max_discount: promo.max_discount?.toString() || '',
      start_date: promo.start_date ? parseISO(promo.start_date) : undefined,
      end_date: promo.end_date ? parseISO(promo.end_date) : undefined,
      is_active: promo.is_active,
      usage_limit: promo.usage_limit?.toString() || ''
    })
    setIsEditing(true)
    setCurrentPromotion(promo)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.code || !formData.value) {
      toast.error('Nombre, código y valor son requeridos')
      return
    }

    if (formData.type === 'percentage' && parseFloat(formData.value) > 100) {
      toast.error('El porcentaje no puede ser mayor a 100')
      return
    }

    // Validate unique code
    if (!isEditing || (currentPromotion && formData.code !== currentPromotion.code)) {
      const isCodeValid = await validatePromotionCode(formData.code, currentPromotion?.id)
      if (!isCodeValid) {
        toast.error('Ya existe una promoción con ese código')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        description: formData.description,
        type: formData.type,
        value: parseFloat(formData.value),
        min_purchase: formData.min_purchase ? parseFloat(formData.min_purchase) : undefined,
        max_discount: formData.max_discount ? parseFloat(formData.max_discount) : undefined,
        start_date: formData.start_date ? formData.start_date.toISOString() : null,
        end_date: formData.end_date ? formData.end_date.toISOString() : null,
        is_active: formData.is_active,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : undefined
      }

      let success = false
      if (isEditing && currentPromotion) {
        success = await updatePromotion(currentPromotion.id, payload)
      } else {
        success = await createPromotion(payload)
      }

      if (success) {
        setIsDialogOpen(false)
        resetForm()
      }
    } catch (error) {
      console.error('Error saving promotion:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta promoción?')) return
    await deletePromotion(id)
  }

  const handleDuplicate = async (promotion: Promotion) => {
    await duplicatePromotion(promotion)
  }

  const handleToggleStatus = async (promotion: Promotion) => {
    await togglePromotionStatus(promotion.id, promotion.is_active)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Promociones</h1>
          <p className="text-muted-foreground">
            Gestiona descuentos, cupones y ofertas especiales.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportPromotions('csv')}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
          <Button variant="outline" onClick={cleanupExpiredPromotions}>
            <AlertTriangle className="mr-2 h-4 w-4" /> Limpiar Expiradas
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nueva Promoción
          </Button>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Tag className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Promociones totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Promociones vigentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programadas</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduled}</div>
            <p className="text-xs text-muted-foreground">Por activar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uso Total</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsage}</div>
            <p className="text-xs text-muted-foreground">Veces utilizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiran Pronto</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiringSoon}</div>
            <p className="text-xs text-muted-foreground">En 7 días</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, código o descripción..."
              className="pl-8"
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filters.status} onValueChange={(value) => updateFilters({ status: value as any })}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Estado" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="scheduled">Programados</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.type} onValueChange={(value) => updateFilters({ type: value as any })}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="percentage">Porcentaje</SelectItem>
              <SelectItem value="fixed">Monto fijo</SelectItem>
            </SelectContent>
          </Select>

          {(filters.search || filters.status !== 'all' || filters.type !== 'all') && (
            <Button variant="outline" onClick={clearFilters}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Promotions Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Promoción</TableHead>
              <TableHead>Descuento</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead>Uso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                  </div>
                </TableCell>
              </TableRow>
            ) : promotions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No se encontraron promociones.
                </TableCell>
              </TableRow>
            ) : (
              promotions.map((promo) => {
                const insights = getPromotionInsights(promo)
                return (
                  <TableRow key={promo.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{promo.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                           <Badge variant="secondary" className="text-xs">{promo.code}</Badge>
                           {promo.min_purchase && promo.min_purchase > 0 && (
                             <span className="text-xs text-muted-foreground">
                               Min: {formatCurrency(promo.min_purchase)}
                             </span>
                           )}
                        </div>
                        {promo.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {promo.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {promo.type === 'percentage' ? (
                          <Percent className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <span className="text-xs text-muted-foreground">$</span>
                        )}
                        <span className="font-medium">
                          {promo.type === 'percentage' ? `${promo.value}%` : formatCurrency(promo.value)}
                        </span>
                      </div>
                      {promo.max_discount && (
                        <div className="text-xs text-muted-foreground">
                          Máx: {formatCurrency(promo.max_discount)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {promo.start_date ? format(parseISO(promo.start_date), 'dd/MM/yyyy') : 'Inicio'} - {promo.end_date ? format(parseISO(promo.end_date), 'dd/MM/yyyy') : 'Indefinido'}
                        </span>
                        {insights.daysRemaining !== null && insights.daysRemaining > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {insights.daysRemaining} días restantes
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="font-medium">{promo.usage_count || 0}</span>
                        {promo.usage_limit && (
                          <span className="text-xs text-muted-foreground">
                            de {promo.usage_limit}
                          </span>
                        )}
                        {insights.usageRate && (
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                            <div 
                              className="bg-blue-600 h-1 rounded-full" 
                              style={{ width: `${Math.min(insights.usageRate * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(promo)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleOpenEdit(promo)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(promo)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(promo)}>
                            {promo.is_active ? (
                              <>
                                <AlertCircle className="mr-2 h-4 w-4" /> Desactivar
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Activar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(promo.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Enhanced Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Promoción' : 'Nueva Promoción'}</DialogTitle>
            <DialogDescription>
              Configure los detalles de la promoción. Los campos marcados con * son obligatorios.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ej. Descuento Verano" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Código *</Label>
                <Input 
                  id="code" 
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  placeholder="Ej. VERANO2024" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea 
                id="description" 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Descripción detallada de la promoción"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo *</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(val: 'percentage' | 'fixed') => setFormData({...formData, type: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                    <SelectItem value="fixed">Monto Fijo ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Valor *</Label>
                <div className="relative">
                  <Input 
                    id="value" 
                    type="number" 
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: e.target.value})}
                    placeholder="0"
                    className="pl-8"
                  />
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">
                    {formData.type === 'percentage' ? '%' : '$'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_purchase">Compra Mínima</Label>
                <div className="relative">
                  <Input 
                    id="min_purchase" 
                    type="number" 
                    value={formData.min_purchase}
                    onChange={(e) => setFormData({...formData, min_purchase: e.target.value})}
                    placeholder="0"
                    className="pl-8"
                  />
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_discount">Descuento Máximo</Label>
                <div className="relative">
                  <Input 
                    id="max_discount" 
                    type="number" 
                    value={formData.max_discount}
                    onChange={(e) => setFormData({...formData, max_discount: e.target.value})}
                    placeholder="Sin límite"
                    className="pl-8"
                  />
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha Inicio</Label>
                <DatePicker 
                  date={formData.start_date}
                  onDateChange={(date) => setFormData({...formData, start_date: date})}
                  placeholder="Seleccionar fecha de inicio"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Fin</Label>
                <DatePicker 
                  date={formData.end_date}
                  onDateChange={(date) => setFormData({...formData, end_date: date})}
                  placeholder="Seleccionar fecha de fin"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="usage_limit">Límite de Uso</Label>
              <Input 
                id="usage_limit" 
                type="number" 
                value={formData.usage_limit}
                onChange={(e) => setFormData({...formData, usage_limit: e.target.value})}
                placeholder="Sin límite"
              />
              <p className="text-xs text-muted-foreground">
                Número máximo de veces que se puede usar esta promoción
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch 
                id="active" 
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label htmlFor="active">Promoción activa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
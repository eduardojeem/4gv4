'use client'

import { useState, useEffect } from 'react'
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
  Edit
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DatePicker } from "@/components/ui/date-picker"
import { formatCurrency } from '@/lib/currency'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format, isAfter, isBefore, parseISO } from 'date-fns'

interface Promotion {
  id: string
  name: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  min_purchase?: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
  usage_count?: number
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  
  // Modal states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form states
  const [formData, setFormData] = useState<{
    name: string
    code: string
    type: 'percentage' | 'fixed'
    value: string
    min_amount: string
    start_date: Date | undefined
    end_date: Date | undefined
    is_active: boolean
  }>({
    name: '',
    code: '',
    type: 'percentage',
    value: '',
    min_amount: '',
    start_date: undefined,
    end_date: undefined,
    is_active: true
  })

  const supabase = createClient()

  const fetchPromotions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setPromotions(data || [])
    } catch (error) {
      console.error('Error fetching promotions:', error)
      toast.error('Error al cargar promociones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPromotions()
  }, [])

  const filteredPromotions = promotions.filter(promo => {
    const matchesSearch = promo.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          promo.code.toLowerCase().includes(searchTerm.toLowerCase())
    
    let matchesStatus = true
    if (statusFilter !== 'all') {
      const now = new Date()
      const startDate = promo.start_date ? parseISO(promo.start_date) : null
      const endDate = promo.end_date ? parseISO(promo.end_date) : null
      
      if (statusFilter === 'active') {
        matchesStatus = promo.is_active && 
          (!startDate || isBefore(startDate, now) || startDate.getTime() === now.getTime()) && 
          (!endDate || isAfter(endDate, now))
      } else if (statusFilter === 'scheduled') {
        matchesStatus = promo.is_active && startDate !== null && isAfter(startDate, now)
      } else if (statusFilter === 'expired') {
        matchesStatus = endDate !== null && isBefore(endDate, now)
      } else if (statusFilter === 'inactive') {
        matchesStatus = !promo.is_active
      }
    }
    
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (promo: Promotion) => {
    const now = new Date()
    const startDate = promo.start_date ? parseISO(promo.start_date) : null
    const endDate = promo.end_date ? parseISO(promo.end_date) : null

    if (!promo.is_active) {
      return <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
    }

    if (endDate && isBefore(endDate, now)) {
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400">Expirado</Badge>
    }

    if (startDate && isAfter(startDate, now)) {
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">Programado</Badge>
    }

    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">Activo</Badge>
  }

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'percentage',
      value: '',
      min_amount: '',
      start_date: undefined,
      end_date: undefined,
      is_active: true
    })
    setIsEditing(false)
    setCurrentId(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (promo: Promotion) => {
    setFormData({
      name: promo.name,
      code: promo.code,
      type: promo.type,
      value: promo.value.toString(),
      min_amount: promo.min_purchase?.toString() || '',
      start_date: promo.start_date ? parseISO(promo.start_date) : undefined,
      end_date: promo.end_date ? parseISO(promo.end_date) : undefined,
      is_active: promo.is_active
    })
    setIsEditing(true)
    setCurrentId(promo.id)
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

    setSaving(true)
    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        type: formData.type,
        value: parseFloat(formData.value),
        min_purchase: formData.min_amount ? parseFloat(formData.min_amount) : 0,
        start_date: formData.start_date ? formData.start_date.toISOString() : null,
        end_date: formData.end_date ? formData.end_date.toISOString() : null,
        is_active: formData.is_active
      }

      if (isEditing && currentId) {
        const { error } = await supabase
          .from('promotions')
          .update(payload)
          .eq('id', currentId)
        if (error) throw error
        toast.success('Promoción actualizada')
      } else {
        const { error } = await supabase
          .from('promotions')
          .insert(payload)
        if (error) throw error
        toast.success('Promoción creada')
      }

      setIsDialogOpen(false)
      fetchPromotions()
    } catch (error: any) {
      console.error('Error saving promotion:', error)
      toast.error('Error al guardar: ' + (error.message || 'Error desconocido'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta promoción?')) return

    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      toast.success('Promoción eliminada')
      fetchPromotions()
    } catch (error) {
      console.error('Error deleting promotion:', error)
      toast.error('Error al eliminar')
    }
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={handleOpenCreate} className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Nueva Promoción
          </Button>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Editar Promoción' : 'Nueva Promoción'}</DialogTitle>
              <DialogDescription>
                Configure los detalles de la promoción.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input 
                    id="name" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ej. Descuento Verano" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Código</Label>
                  <Input 
                    id="code" 
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    placeholder="Ej. VERANO2024" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
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
                  <Label htmlFor="value">Valor</Label>
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

              <div className="space-y-2">
                <Label htmlFor="min_amount">Compra Mínima (Opcional)</Label>
                <div className="relative">
                  <Input 
                    id="min_amount" 
                    type="number" 
                    value={formData.min_amount}
                    onChange={(e) => setFormData({...formData, min_amount: e.target.value})}
                    placeholder="0"
                    className="pl-8"
                  />
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha Inicio</Label>
                  <DatePicker 
                    date={formData.start_date}
                    onDateChange={(date) => setFormData({...formData, start_date: date})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha Fin</Label>
                  <DatePicker 
                    date={formData.end_date}
                    onDateChange={(date) => setFormData({...formData, end_date: date})}
                  />
                </div>
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
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activas Ahora</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {promotions.filter(p => {
                 const now = new Date()
                 const start = p.start_date ? parseISO(p.start_date) : null
                 const end = p.end_date ? parseISO(p.end_date) : null
                 return p.is_active && (!start || isBefore(start, now)) && (!end || isAfter(end, now))
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Promociones vigentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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
        </div>
      </div>

      {/* Promotions Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Promoción</TableHead>
              <TableHead>Descuento</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPromotions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No se encontraron promociones.
                </TableCell>
              </TableRow>
            ) : (
              filteredPromotions.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{promo.name}</span>
                      <div className="flex items-center gap-2">
                         <Badge variant="secondary" className="text-xs">{promo.code}</Badge>
                         <span className="text-xs text-muted-foreground">
                            {promo.min_purchase && promo.min_purchase > 0 ? `Min: ${formatCurrency(promo.min_purchase)}` : 'Sin mínimo'}
                         </span>
                      </div>
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
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {promo.start_date ? format(parseISO(promo.start_date), 'dd/MM/yyyy') : 'Inicio'} - {promo.end_date ? format(parseISO(promo.end_date), 'dd/MM/yyyy') : 'Indefinido'}
                      </span>
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(promo.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

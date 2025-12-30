'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon,
  AlertTriangle,
  Clock,
  User,
  Smartphone
} from 'lucide-react'
import { KanbanFilters as KanbanFiltersType } from '@/hooks/use-kanban-analytics'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface KanbanFiltersProps {
  filters: KanbanFiltersType
  onFiltersChange: (filters: Partial<KanbanFiltersType>) => void
  technicians: Array<{ id: string; name: string }>
  deviceTypes: string[]
  totalItems: number
  filteredCount: number
}

export const KanbanFilters = memo(function KanbanFilters({
  filters,
  onFiltersChange,
  technicians,
  deviceTypes,
  totalItems,
  filteredCount
}: KanbanFiltersProps) {
  const activeFiltersCount = [
    filters.searchTerm,
    filters.minUrgency > 1 || filters.maxUrgency < 5,
    filters.technicianId,
    filters.deviceType,
    filters.showOverdueOnly,
    filters.showUrgentOnly,
    filters.dateRange
  ].filter(Boolean).length

  const clearAllFilters = () => {
    onFiltersChange({
      searchTerm: '',
      minUrgency: 1,
      maxUrgency: 5,
      technicianId: undefined,
      deviceType: undefined,
      showOverdueOnly: false,
      showUrgentOnly: false,
      dateRange: undefined
    })
  }

  return (
    <Card className="border-muted dark:border-muted/60 bg-card/60 dark:bg-card/40 backdrop-blur-sm shadow-sm dark:shadow-lg">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary dark:text-primary-foreground" />
              <span className="font-medium text-foreground dark:text-foreground">Filtros</span>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-foreground border-primary/20 dark:border-primary/30">{activeFiltersCount}</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground dark:text-muted-foreground/80">
                {filteredCount} de {totalItems} elementos
              </span>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="hover:bg-muted/60 dark:hover:bg-muted/40">
                  <X className="h-3 w-3 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          {/* Main filters row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-muted-foreground/80" />
              <Input
                placeholder="Buscar por cliente, dispositivo o problema..."
                value={filters.searchTerm}
                onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
                className="pl-10 border-muted dark:border-muted/60 bg-background dark:bg-background/80"
              />
            </div>

            {/* Technician filter */}
            <Select
              value={filters.technicianId || 'all'}
              onValueChange={(value) => onFiltersChange({ 
                technicianId: value === 'all' ? undefined : value 
              })}
            >
              <SelectTrigger className="border-muted dark:border-muted/60 bg-background dark:bg-background/80">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground dark:text-muted-foreground/80" />
                  <SelectValue placeholder="Técnico" />
                </div>
              </SelectTrigger>
              <SelectContent className="dark:bg-popover/95 dark:border-muted/60">
                <SelectItem value="all">Todos los técnicos</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Device type filter */}
            <Select
              value={filters.deviceType || 'all'}
              onValueChange={(value) => onFiltersChange({ 
                deviceType: value === 'all' ? undefined : value 
              })}
            >
              <SelectTrigger className="border-muted dark:border-muted/60 bg-background dark:bg-background/80">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground dark:text-muted-foreground/80" />
                  <SelectValue placeholder="Dispositivo" />
                </div>
              </SelectTrigger>
              <SelectContent className="dark:bg-popover/95 dark:border-muted/60">
                <SelectItem value="all">Todos los dispositivos</SelectItem>
                {deviceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start border-muted dark:border-muted/60 bg-background dark:bg-background/80 hover:bg-muted/60 dark:hover:bg-muted/40">
                  <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground dark:text-muted-foreground/80" />
                  {filters.dateRange ? (
                    `${format(filters.dateRange.from, 'dd/MM')} - ${format(filters.dateRange.to, 'dd/MM')}`
                  ) : (
                    'Fecha'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 dark:bg-popover/95 dark:border-muted/60" align="start">
                <Calendar
                  mode="range"
                  selected={filters.dateRange ? {
                    from: filters.dateRange.from,
                    to: filters.dateRange.to
                  } : undefined}
                  onSelect={(range) => onFiltersChange({
                    dateRange: range ? {
                      from: range.from!,
                      to: range.to || range.from!
                    } : undefined
                  })}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>

            {/* Quick filters */}
            <div className="flex gap-2">
              <Button
                variant={filters.showUrgentOnly ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ showUrgentOnly: !filters.showUrgentOnly })}
                className={cn(
                  "flex-1",
                  filters.showUrgentOnly && "bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 text-white"
                )}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Urgentes
              </Button>
              
              <Button
                variant={filters.showOverdueOnly ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ showOverdueOnly: !filters.showOverdueOnly })}
                className={cn(
                  "flex-1",
                  filters.showOverdueOnly && "bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600 text-white"
                )}
              >
                <Clock className="h-3 w-3 mr-1" />
                Atrasados
              </Button>
            </div>
          </div>

          {/* Urgency range slider */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground dark:text-foreground">
              Rango de Urgencia: {filters.minUrgency} - {filters.maxUrgency}
            </Label>
            <div className="px-2">
              <Slider
                value={[filters.minUrgency, filters.maxUrgency]}
                onValueChange={([min, max]) => onFiltersChange({ 
                  minUrgency: min, 
                  maxUrgency: max 
                })}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground dark:text-muted-foreground/80 mt-1">
                <span>Muy Baja</span>
                <span>Baja</span>
                <span>Media</span>
                <span>Alta</span>
                <span>Crítica</span>
              </div>
            </div>
          </div>

          {/* Active filters display */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-muted/40 dark:border-muted/50">
              {filters.searchTerm && (
                <Badge variant="secondary" className="gap-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700">
                  Búsqueda: "{filters.searchTerm}"
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-blue-600 dark:hover:text-blue-300" 
                    onClick={() => onFiltersChange({ searchTerm: '' })}
                  />
                </Badge>
              )}
              
              {filters.technicianId && (
                <Badge variant="secondary" className="gap-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700">
                  Técnico: {technicians.find(t => t.id === filters.technicianId)?.name}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-green-600 dark:hover:text-green-300" 
                    onClick={() => onFiltersChange({ technicianId: undefined })}
                  />
                </Badge>
              )}
              
              {filters.deviceType && (
                <Badge variant="secondary" className="gap-1 bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700">
                  Dispositivo: {filters.deviceType}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-purple-600 dark:hover:text-purple-300" 
                    onClick={() => onFiltersChange({ deviceType: undefined })}
                  />
                </Badge>
              )}
              
              {filters.showUrgentOnly && (
                <Badge variant="secondary" className="gap-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700">
                  Solo Urgentes
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-red-600 dark:hover:text-red-300" 
                    onClick={() => onFiltersChange({ showUrgentOnly: false })}
                  />
                </Badge>
              )}
              
              {filters.showOverdueOnly && (
                <Badge variant="secondary" className="gap-1 bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700">
                  Solo Atrasados
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-orange-600 dark:hover:text-orange-300" 
                    onClick={() => onFiltersChange({ showOverdueOnly: false })}
                  />
                </Badge>
              )}
              
              {filters.dateRange && (
                <Badge variant="secondary" className="gap-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700">
                  Fecha: {format(filters.dateRange.from, 'dd/MM')} - {format(filters.dateRange.to, 'dd/MM')}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-300" 
                    onClick={() => onFiltersChange({ dateRange: undefined })}
                  />
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
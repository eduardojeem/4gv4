"use client"

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence  } from '../../ui/motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  Users, 
  Target, 
  Sparkles, 
  TrendingUp, 
  Star, 
  Clock, 
  ShoppingBag,
  MapPin,
  Calendar,
  DollarSign,
  Zap,
  Brain,
  Filter,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  BarChart3,
  PieChart,
  Activity,
  Lightbulb,
  Wand2,
  Eye,
  Settings,
  Download,
  RefreshCw,
  Copy,
  Crown,
  Heart,
  UserPlus,
  UserX
} from 'lucide-react'
import { Customer } from '@/hooks/use-customer-state'
import { useSegmentationUnified, Segment, SegmentRule } from '@/hooks/use-segmentation-unified'
import { formatters, SEGMENT_COLORS } from '@/lib/formatters'
import { ChartWrapper } from '@/components/charts/ChartWrapper'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface SegmentationSystemProps {
  customers: Customer[]
  mode?: 'simple' | 'advanced' | 'ai'
  showTemplates?: boolean
  showAIInsights?: boolean
  onSegmentUpdate?: (segmentId: string, customers: Customer[]) => void
}

const ICON_MAP = {
  crown: Crown,
  star: Star,
  user: Users,
  'user-plus': UserPlus,
  'user-x': UserX,
  zap: Zap,
  heart: Heart,
  target: Target,
  activity: Activity
}

export function SegmentationSystem({
  customers,
  mode = 'advanced',
  showTemplates = true,
  showAIInsights = true,
  onSegmentUpdate
}: SegmentationSystemProps) {
  const {
    segments,
    selectedSegmentId,
    isCreating,
    isEditing,
    createSegment,
    updateSegment,
    deleteSegment,
    duplicateSegment,
    toggleSegment,
    generateAISegments,
    setSelectedSegmentId,
    setIsCreating,
    setIsEditing,
    insights
  } = useSegmentationUnified(customers, {
    enableAI: showAIInsights,
    autoUpdate: true,
    maxSegments: 20
  })

  const [activeTab, setActiveTab] = useState('segments')
  const [newSegment, setNewSegment] = useState<Partial<Segment>>({
    name: '',
    description: '',
    color: SEGMENT_COLORS[0],
    rules: [],
    isActive: true,
    autoUpdate: true,
    priority: 1,
    tags: []
  })

  // Renderizado según el modo
  if (mode === 'simple') {
    return <SimpleSegmentationView segments={segments} insights={insights} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sistema de Segmentación</h2>
          <p className="text-muted-foreground">
            Gestiona y analiza {segments.length} segmentos de {customers.length} clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showAIInsights && (
            <Button variant="outline" onClick={generateAISegments}>
              <Brain className="h-4 w-4 mr-2" />
              Generar con IA
            </Button>
          )}
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Segmento
          </Button>
        </div>
      </div>

      {/* Métricas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Segmentos</p>
                <p className="text-2xl font-bold">{insights.totalSegments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Segmentos Activos</p>
                <p className="text-2xl font-bold">{insights.activeSegments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Cobertura</p>
                <p className="text-2xl font-bold">{formatters.percentage(insights.coverageRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Top Segmento</p>
                <p className="text-sm font-bold truncate">{insights.topSegment}</p>
                <p className="text-xs text-muted-foreground">
                  {formatters.currency(insights.topSegmentValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de contenido */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="segments">Segmentos</TabsTrigger>
          {showAIInsights && <TabsTrigger value="insights">Insights IA</TabsTrigger>}
          <TabsTrigger value="analytics">Analíticas</TabsTrigger>
          {mode === 'advanced' && <TabsTrigger value="automation">Automatización</TabsTrigger>}
        </TabsList>

        <TabsContent value="segments" className="space-y-4">
          <SegmentsList 
            segments={segments}
            onSelect={setSelectedSegmentId}
            onEdit={(id) => {
              setSelectedSegmentId(id)
              setIsEditing(true)
            }}
            onDelete={deleteSegment}
            onDuplicate={duplicateSegment}
            onToggle={toggleSegment}
          />
        </TabsContent>

        {showAIInsights && (
          <TabsContent value="insights" className="space-y-4">
            <AIInsights segments={segments} onGenerateSegments={generateAISegments} />
          </TabsContent>
        )}

        <TabsContent value="analytics" className="space-y-4">
          <SegmentAnalytics segments={segments} />
        </TabsContent>

        {mode === 'advanced' && (
          <TabsContent value="automation" className="space-y-4">
            <SegmentAutomation segments={segments} onUpdateSegment={updateSegment} />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog para crear/editar segmento */}
      <SegmentDialog
        isOpen={isCreating || isEditing}
        onClose={() => {
          setIsCreating(false)
          setIsEditing(false)
          setSelectedSegmentId(null)
        }}
        segment={isEditing ? segments.find(s => s.id === selectedSegmentId) : undefined}
        onSave={(segmentData) => {
          if (isEditing && selectedSegmentId) {
            updateSegment(selectedSegmentId, segmentData)
          } else {
            createSegment(segmentData)
          }
          setIsCreating(false)
          setIsEditing(false)
          setSelectedSegmentId(null)
        }}
      />
    </div>
  )
}

// Componente para vista simple
function SimpleSegmentationView({ 
  segments, 
  insights 
}: { 
  segments: any[], 
  insights: any 
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Segmentos de Clientes</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {segments.slice(0, 6).map((segment) => (
          <Card key={segment.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: segment.color }}
                />
                <span className="font-medium">{segment.name}</span>
                <StatusBadge 
                  status={segment.isActive ? 'active' : 'inactive'} 
                  size="sm" 
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Clientes:</span>
                  <span className="font-medium">{segment.metrics.customerCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Valor:</span>
                  <span className="font-medium">{formatters.currency(segment.metrics.totalValue)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Componente para lista de segmentos
function SegmentsList({ 
  segments, 
  onSelect, 
  onEdit, 
  onDelete, 
  onDuplicate, 
  onToggle 
}: {
  segments: any[]
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onToggle: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {segments.map((segment, index) => {
        const IconComponent = ICON_MAP[segment.icon as keyof typeof ICON_MAP] || Target
        
        return (
          <motion.div
            key={segment.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              !segment.isActive && "opacity-60"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ 
                        backgroundColor: `${segment.color}20`,
                        color: segment.color 
                      }}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{segment.name}</CardTitle>
                      {segment.aiSuggested && (
                        <Badge variant="outline" className="text-xs mt-1">
                          <Brain className="h-3 w-3 mr-1" />
                          IA
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggle(segment.id)}
                    >
                      {segment.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(segment.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDuplicate(segment.id)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(segment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {segment.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-2xl font-bold">{segment.metrics.customerCount}</p>
                    <p className="text-xs text-muted-foreground">Clientes</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatters.compact(segment.metrics.totalValue)}</p>
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Valor Promedio:</span>
                    <span>{formatters.currency(segment.metrics.avgValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Retención:</span>
                    <span>{formatters.percentage(segment.metrics.retentionRate)}</span>
                  </div>
                  {segment.performance && (
                    <div className="flex justify-between text-sm">
                      <span>Crecimiento:</span>
                      <span className={cn(
                        segment.performance.growth > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {segment.performance.growth > 0 ? "+" : ""}{formatters.percentage(segment.performance.growth)}
                      </span>
                    </div>
                  )}
                </div>

                {segment.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {segment.tags.slice(0, 3).map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

// Componente para insights de IA
function AIInsights({ 
  segments, 
  onGenerateSegments 
}: { 
  segments: any[], 
  onGenerateSegments: () => void 
}) {
  const aiSegments = segments.filter(s => s.aiSuggested)
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Insights de Inteligencia Artificial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{aiSegments.length}</div>
              <p className="text-sm text-muted-foreground">Segmentos Sugeridos</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {aiSegments.reduce((sum, s) => sum + s.metrics.customerCount, 0)}
              </div>
              <p className="text-sm text-muted-foreground">Clientes Identificados</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {aiSegments.length > 0 ? formatters.percentage(
                  aiSegments.reduce((sum, s) => sum + (s.performance?.engagement || 0), 0) / aiSegments.length
                ) : "0%"}
              </div>
              <p className="text-sm text-muted-foreground">Engagement Promedio</p>
            </div>
          </div>

          <Button onClick={onGenerateSegments} className="w-full">
            <Wand2 className="h-4 w-4 mr-2" />
            Generar Nuevos Segmentos con IA
          </Button>
        </CardContent>
      </Card>

      {aiSegments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Segmentos Sugeridos por IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiSegments.map((segment) => (
                <div key={segment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: segment.color }}
                    />
                    <div>
                      <p className="font-medium">{segment.name}</p>
                      <p className="text-sm text-muted-foreground">{segment.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{segment.metrics.customerCount} clientes</p>
                      <p className="text-xs text-muted-foreground">
                        {formatters.percentage(segment.performance?.engagement || 0)} engagement
                      </p>
                    </div>
                    <StatusBadge 
                      status={segment.isActive ? 'active' : 'inactive'} 
                      size="sm" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Componente para analíticas de segmentos
function SegmentAnalytics({ segments }: { segments: any[] }) {
  const chartData = segments.map(segment => ({
    name: segment.name,
    customers: segment.metrics.customerCount,
    value: segment.metrics.totalValue,
    retention: segment.metrics.retentionRate
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartWrapper
            type="pie"
            data={chartData}
            config={[
              { dataKey: 'customers', name: 'Clientes', format: 'number' }
            ]}
            colors={segments.map(s => s.color)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valor por Segmento</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartWrapper
            type="bar"
            data={chartData}
            config={[
              { dataKey: 'name' },
              { dataKey: 'value', name: 'Valor Total', format: 'currency' }
            ]}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Métricas de Rendimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {segments.map((segment) => (
              <div key={segment.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="font-medium">{segment.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatters.percentage(segment.metrics.retentionRate)} retención
                  </span>
                </div>
                <Progress value={segment.metrics.retentionRate} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente para automatización
function SegmentAutomation({ 
  segments, 
  onUpdateSegment 
}: { 
  segments: any[], 
  onUpdateSegment: (id: string, updates: any) => void 
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Automatización</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {segments.map((segment) => (
              <div key={segment.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: segment.color }}
                  />
                  <div>
                    <p className="font-medium">{segment.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Actualización automática {segment.autoUpdate ? 'activada' : 'desactivada'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={segment.autoUpdate}
                  onCheckedChange={(checked) => 
                    onUpdateSegment(segment.id, { autoUpdate: checked })
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Dialog para crear/editar segmento
function SegmentDialog({
  isOpen,
  onClose,
  segment,
  onSave
}: {
  isOpen: boolean
  onClose: () => void
  segment?: Segment
  onSave: (segmentData: any) => void
}) {
  const [formData, setFormData] = useState({
    name: segment?.name || '',
    description: segment?.description || '',
    color: segment?.color || SEGMENT_COLORS[0],
    isActive: segment?.isActive ?? true,
    autoUpdate: segment?.autoUpdate ?? true
  })

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('El nombre del segmento es requerido')
      return
    }

    onSave(formData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {segment ? 'Editar Segmento' : 'Crear Nuevo Segmento'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre del segmento"
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción del segmento"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="color">Color</Label>
            <div className="flex gap-2 mt-2">
              {SEGMENT_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-8 h-8 rounded-full border-2",
                    formData.color === color ? "border-gray-900" : "border-gray-300"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
            <Label htmlFor="isActive">Segmento activo</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="autoUpdate"
              checked={formData.autoUpdate}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoUpdate: checked }))}
            />
            <Label htmlFor="autoUpdate">Actualización automática</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            {segment ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Exportar con alias para compatibilidad
export const ImprovedSegmentationSystem = SegmentationSystem
export const IntelligentSegmentation = SegmentationSystem
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  FileText, 
  Download, 
  Calendar, 
  Clock, 
  Filter, 
  Share2, 
  Mail, 
  Printer,
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  ShoppingCart,
  Eye,
  Settings,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'

// Interfaces para el sistema de reportes
interface Report {
  id: string
  name: string
  description: string
  type: 'sales' | 'customers' | 'products' | 'analytics' | 'custom'
  schedule: 'manual' | 'daily' | 'weekly' | 'monthly'
  format: 'pdf' | 'excel' | 'csv' | 'json'
  recipients: string[]
  lastGenerated?: Date
  nextScheduled?: Date
  status: 'active' | 'paused' | 'error'
  parameters: ReportParameters
}

interface ReportParameters {
  dateRange: {
    start: Date
    end: Date
    preset?: 'last7days' | 'last30days' | 'lastMonth' | 'lastQuarter' | 'custom'
  }
  filters: {
    categories?: string[]
    regions?: string[]
    customerSegments?: string[]
    priceRange?: { min: number; max: number }
  }
  metrics: string[]
  groupBy?: 'day' | 'week' | 'month' | 'category' | 'region'
  includeCharts: boolean
  includeRawData: boolean
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  type: string
  defaultParameters: ReportParameters
  sections: ReportSection[]
}

interface ReportSection {
  id: string
  name: string
  type: 'chart' | 'table' | 'metric' | 'text'
  config: any
}

// Componente principal del sistema de reportes
export function ReportsSystem() {
  const [reports, setReports] = useState<Report[]>([
    {
      id: '1',
      name: 'Reporte de Ventas Diario',
      description: 'Resumen diario de ventas y métricas clave',
      type: 'sales',
      schedule: 'daily',
      format: 'pdf',
      recipients: ['admin@empresa.com', 'ventas@empresa.com'],
      lastGenerated: new Date(Date.now() - 24 * 60 * 60 * 1000),
      nextScheduled: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'active',
      parameters: {
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(),
          preset: 'last7days'
        },
        filters: {},
        metrics: ['revenue', 'orders', 'conversion_rate'],
        groupBy: 'day',
        includeCharts: true,
        includeRawData: false
      }
    },
    {
      id: '2',
      name: 'Análisis de Clientes Mensual',
      description: 'Análisis detallado del comportamiento de clientes',
      type: 'customers',
      schedule: 'monthly',
      format: 'excel',
      recipients: ['marketing@empresa.com'],
      lastGenerated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      nextScheduled: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
      parameters: {
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
          preset: 'last30days'
        },
        filters: {},
        metrics: ['new_customers', 'retention_rate', 'lifetime_value'],
        groupBy: 'week',
        includeCharts: true,
        includeRawData: true
      }
    }
  ])

  const [templates] = useState<ReportTemplate[]>([
    {
      id: 'sales-summary',
      name: 'Resumen de Ventas',
      description: 'Template para reportes de ventas con métricas clave',
      type: 'sales',
      defaultParameters: {
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
          preset: 'last30days'
        },
        filters: {},
        metrics: ['revenue', 'orders', 'avg_order_value', 'conversion_rate'],
        groupBy: 'day',
        includeCharts: true,
        includeRawData: false
      },
      sections: [
        { id: '1', name: 'Métricas Clave', type: 'metric', config: {} },
        { id: '2', name: 'Tendencia de Ventas', type: 'chart', config: { chartType: 'line' } },
        { id: '3', name: 'Top Productos', type: 'table', config: {} }
      ]
    }
  ])

  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isGenerating, setIsGenerating] = useState<string | null>(null)

  // Componente para la lista de reportes
  const ReportsList = () => (
    <div className="space-y-4">
      {reports.map(report => (
        <Card key={report.id} className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{report.name}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={report.status === 'active' ? 'default' : 'secondary'}>
                  {report.status === 'active' ? 'Activo' : 
                   report.status === 'paused' ? 'Pausado' : 'Error'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateReport(report.id)}
                  disabled={isGenerating === report.id}
                >
                  {isGenerating === report.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Generar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Tipo</p>
                <p className="font-medium capitalize">{report.type}</p>
              </div>
              <div>
                <p className="text-gray-500">Frecuencia</p>
                <p className="font-medium capitalize">{report.schedule}</p>
              </div>
              <div>
                <p className="text-gray-500">Formato</p>
                <p className="font-medium uppercase">{report.format}</p>
              </div>
              <div>
                <p className="text-gray-500">Último generado</p>
                <p className="font-medium">
                  {report.lastGenerated ? 
                    report.lastGenerated.toLocaleDateString() : 
                    'Nunca'
                  }
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Mail className="h-4 w-4" />
                <span>{report.recipients.length} destinatarios</span>
              </div>
              <div className="flex space-x-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedReport(report)}>
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  // Componente para crear/editar reportes
  const ReportEditor = ({ report, onSave, onCancel }: {
    report?: Report
    onSave: (report: Report) => void
    onCancel: () => void
  }) => {
    const [formData, setFormData] = useState<Partial<Report>>(
      report || {
        name: '',
        description: '',
        type: 'sales',
        schedule: 'manual',
        format: 'pdf',
        recipients: [],
        status: 'active',
        parameters: {
          dateRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date(),
            preset: 'last30days'
          },
          filters: {},
          metrics: [],
          includeCharts: true,
          includeRawData: false
        }
      }
    )

    const handleSave = () => {
      const newReport: Report = {
        ...formData as Report,
        id: report?.id || Date.now().toString()
      }
      onSave(newReport)
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Nombre del Reporte</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Reporte de Ventas Semanal"
            />
          </div>
          <div>
            <Label htmlFor="type">Tipo de Reporte</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Ventas</SelectItem>
                <SelectItem value="customers">Clientes</SelectItem>
                <SelectItem value="products">Productos</SelectItem>
                <SelectItem value="analytics">Analytics</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe el propósito y contenido del reporte"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="schedule">Frecuencia</Label>
            <Select value={formData.schedule} onValueChange={(value) => setFormData({ ...formData, schedule: value as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="daily">Diario</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="format">Formato</Label>
            <Select value={formData.format} onValueChange={(value) => setFormData({ ...formData, format: value as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Estado</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="recipients">Destinatarios (emails separados por coma)</Label>
          <Input
            id="recipients"
            value={formData.recipients?.join(', ')}
            onChange={(e) => setFormData({ 
              ...formData, 
              recipients: e.target.value.split(',').map(email => email.trim()).filter(Boolean)
            })}
            placeholder="admin@empresa.com, ventas@empresa.com"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            {report ? 'Actualizar' : 'Crear'} Reporte
          </Button>
        </div>
      </div>
    )
  }

  // Funciones para manejar reportes
  const generateReport = async (reportId: string) => {
    setIsGenerating(reportId)
    
    // Simular generación de reporte
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    setReports(prev => prev.map(report => 
      report.id === reportId 
        ? { ...report, lastGenerated: new Date() }
        : report
    ))
    
    setIsGenerating(null)
  }

  const saveReport = (report: Report) => {
    if (reports.find(r => r.id === report.id)) {
      setReports(prev => prev.map(r => r.id === report.id ? report : r))
    } else {
      setReports(prev => [...prev, report])
    }
    setSelectedReport(null)
    setIsCreating(false)
  }

  // Componente de estadísticas de reportes
  const ReportsStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{reports.length}</p>
              <p className="text-sm text-gray-500">Reportes Totales</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{reports.filter(r => r.status === 'active').length}</p>
              <p className="text-sm text-gray-500">Activos</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">
                {reports.filter(r => r.schedule !== 'manual').length}
              </p>
              <p className="text-sm text-gray-500">Programados</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">
                {reports.filter(r => r.lastGenerated && 
                  r.lastGenerated > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                ).length}
              </p>
              <p className="text-sm text-gray-500">Esta Semana</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Sistema de Reportes</h2>
          <p className="text-gray-600">Gestiona y automatiza la generación de reportes</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <FileText className="h-4 w-4 mr-2" />
          Nuevo Reporte
        </Button>
      </div>

      <ReportsStats />

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="schedule">Programación</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <ReportsList />
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Badge variant="outline">{template.type}</Badge>
                    <p className="text-sm text-gray-600">
                      {template.sections.length} secciones
                    </p>
                  </div>
                  <Button className="w-full mt-4" variant="outline">
                    Usar Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>Reportes Programados</CardTitle>
              <CardDescription>Próximas ejecuciones automáticas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reports.filter(r => r.schedule !== 'manual').map(report => (
                  <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <p className="text-sm text-gray-500">
                        Próxima ejecución: {report.nextScheduled?.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{report.schedule}</Badge>
                      <Button variant="ghost" size="sm">
                        {report.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para crear/editar reportes */}
      <Dialog open={isCreating || !!selectedReport} onOpenChange={(open) => {
        if (!open) {
          setIsCreating(false)
          setSelectedReport(null)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedReport ? 'Editar Reporte' : 'Crear Nuevo Reporte'}
            </DialogTitle>
            <DialogDescription>
              {selectedReport ? 
                'Modifica la configuración del reporte existente' : 
                'Configura un nuevo reporte automatizado'
              }
            </DialogDescription>
          </DialogHeader>
          <ReportEditor
            report={selectedReport || undefined}
            onSave={saveReport}
            onCancel={() => {
              setIsCreating(false)
              setSelectedReport(null)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ReportsSystem

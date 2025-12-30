"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  FileText, Download, Calendar as CalendarIcon, Filter, 
  BarChart3, PieChart, TrendingUp, Users, Package, 
  ShoppingCart, AlertTriangle, Clock,
  FileSpreadsheet, File, FileImage, Mail, Share2,
  Eye, Settings, RefreshCw, Archive
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Report {
  id: string
  name: string
  description: string
  type: 'sales' | 'inventory' | 'users' | 'financial' | 'system'
  category: string
  lastGenerated: Date
  size: string
  status: 'ready' | 'generating' | 'error'
  downloadCount: number
  schedule?: 'daily' | 'weekly' | 'monthly'
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  type: 'sales' | 'inventory' | 'users' | 'financial' | 'system'
  fields: string[]
  filters: string[]
  charts: string[]
  icon: React.ReactNode
  color: string
}

// Datos mock
const mockReports: Report[] = [
  {
    id: '1',
    name: 'Reporte de Ventas Mensual',
    description: 'Análisis completo de ventas del mes actual',
    type: 'sales',
    category: 'Ventas',
    lastGenerated: new Date(),
    size: '2.4 MB',
    status: 'ready',
    downloadCount: 45,
    schedule: 'monthly'
  },
  {
    id: '2',
    name: 'Inventario Actual',
    description: 'Estado actual del inventario y alertas de stock',
    type: 'inventory',
    category: 'Inventario',
    lastGenerated: new Date(Date.now() - 86400000),
    size: '1.8 MB',
    status: 'ready',
    downloadCount: 23,
    schedule: 'daily'
  },
  {
    id: '3',
    name: 'Análisis de Usuarios',
    description: 'Estadísticas de usuarios activos y comportamiento',
    type: 'users',
    category: 'Usuarios',
    lastGenerated: new Date(Date.now() - 3600000),
    size: '956 KB',
    status: 'generating',
    downloadCount: 12,
    schedule: 'weekly'
  },
  {
    id: '4',
    name: 'Estado Financiero',
    description: 'Resumen financiero y análisis de rentabilidad',
    type: 'financial',
    category: 'Finanzas',
    lastGenerated: new Date(Date.now() - 7200000),
    size: '3.2 MB',
    status: 'ready',
    downloadCount: 67,
    schedule: 'monthly'
  }
]

const reportTemplates: ReportTemplate[] = [
  {
    id: '1',
    name: 'Reporte de Ventas',
    description: 'Análisis detallado de ventas por período',
    type: 'sales',
    fields: ['Fecha', 'Producto', 'Cantidad', 'Precio', 'Total', 'Cliente', 'Vendedor'],
    filters: ['Rango de fechas', 'Producto', 'Cliente', 'Vendedor', 'Método de pago'],
    charts: ['Ventas por día', 'Top productos', 'Ventas por vendedor'],
    icon: <BarChart3 className="h-6 w-6" />,
    color: 'blue'
  },
  {
    id: '2',
    name: 'Reporte de Inventario',
    description: 'Estado actual y movimientos de inventario',
    type: 'inventory',
    fields: ['SKU', 'Producto', 'Stock actual', 'Stock mínimo', 'Valor', 'Proveedor'],
    filters: ['Categoría', 'Proveedor', 'Estado de stock', 'Rango de precios'],
    charts: ['Stock por categoría', 'Productos más vendidos', 'Alertas de stock'],
    icon: <Package className="h-6 w-6" />,
    color: 'green'
  },
  {
    id: '3',
    name: 'Reporte de Usuarios',
    description: 'Análisis de usuarios y actividad',
    type: 'users',
    fields: ['Usuario', 'Email', 'Fecha registro', 'Último acceso', 'Rol', 'Estado'],
    filters: ['Rol', 'Estado', 'Fecha de registro', 'Actividad'],
    charts: ['Usuarios por mes', 'Actividad diaria', 'Distribución de roles'],
    icon: <Users className="h-6 w-6" />,
    color: 'purple'
  },
  {
    id: '4',
    name: 'Reporte Financiero',
    description: 'Análisis financiero y rentabilidad',
    type: 'financial',
    fields: ['Fecha', 'Ingresos', 'Gastos', 'Ganancia', 'Margen', 'Categoría'],
    filters: ['Período', 'Tipo de transacción', 'Categoría', 'Método de pago'],
    charts: ['Ingresos vs Gastos', 'Rentabilidad por producto', 'Flujo de caja'],
    icon: <GSIcon className="h-6 w-6" />,
    color: 'yellow'
  },
  {
    id: '5',
    name: 'Reporte del Sistema',
    description: 'Métricas de rendimiento y uso del sistema',
    type: 'system',
    fields: ['Fecha', 'Usuarios activos', 'Tiempo respuesta', 'Errores', 'Uso CPU', 'Memoria'],
    filters: ['Período', 'Tipo de métrica', 'Severidad'],
    charts: ['Rendimiento del sistema', 'Usuarios concurrentes', 'Errores por día'],
    icon: <Settings className="h-6 w-6" />,
    color: 'red'
  }
]

export default function ReportsSystem() {
  const [reports] = useState<Report[]>(mockReports)
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  })
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [selectedCharts, setSelectedCharts] = useState<string[]>([])
  const [exportFormat, setExportFormat] = useState('pdf')
  const [activeTab, setActiveTab] = useState('reports')

  const getStatusBadge = (status: string) => {
    const colors = {
      ready: 'bg-green-100 text-green-800',
      generating: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800'
    }
    return colors[status as keyof typeof colors] || colors.ready
  }

  const getStatusText = (status: string) => {
    const texts = {
      ready: 'Listo',
      generating: 'Generando...',
      error: 'Error'
    }
    return texts[status as keyof typeof texts] || 'Listo'
  }

  const getTypeIcon = (type: string) => {
    const icons = {
      sales: <BarChart3 className="h-5 w-5" />,
      inventory: <Package className="h-5 w-5" />,
      users: <Users className="h-5 w-5" />,
      financial: <GSIcon className="h-5 w-5" />,
      system: <Settings className="h-5 w-5" />
    }
    return icons[type as keyof typeof icons] || <FileText className="h-5 w-5" />
  }

  const getTypeColor = (type: string) => {
    const colors = {
      sales: 'text-blue-600',
      inventory: 'text-green-600',
      users: 'text-purple-600',
      financial: 'text-yellow-600',
      system: 'text-red-600'
    }
    return colors[type as keyof typeof colors] || 'text-gray-600'
  }

  const handleGenerateReport = () => {
    console.log('Generando reporte...', {
      template: selectedTemplate,
      dateRange,
      fields: selectedFields,
      charts: selectedCharts,
      format: exportFormat
    })
    // Aquí iría la lógica para generar el reporte
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center text-indigo-700">
              <FileText className="h-6 w-6 mr-2 text-indigo-700" />
              Sistema de Reportes
            </h2>
            <p className="text-indigo-600 mt-1">Genera y gestiona reportes personalizados</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
            >
              <Archive className="h-4 w-4 mr-2" />
              Historial
            </Button>
            
            <Button 
              variant="outline" 
              className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
            
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
              <FileText className="h-4 w-4 mr-2" />
              Nuevo Reporte
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-indigo-100 to-purple-100 p-1">
          <TabsTrigger 
            value="reports" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
          >
            <FileText className="h-4 w-4 mr-2" />
            Reportes
          </TabsTrigger>
          <TabsTrigger 
            value="generate" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Generar
          </TabsTrigger>
          <TabsTrigger 
            value="scheduled" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-pink-600 data-[state=active]:text-white"
          >
            <Clock className="h-4 w-4 mr-2" />
            Programados
          </TabsTrigger>
        </TabsList>

        {/* Tab: Reportes Existentes */}
        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reports.map((report) => (
              <Card key={report.id} className="border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg bg-gray-100 ${getTypeColor(report.type)}`}>
                        {getTypeIcon(report.type)}
                      </div>
                      <div>
                        <CardTitle className="text-gray-800">{report.name}</CardTitle>
                        <CardDescription className="text-gray-600">{report.description}</CardDescription>
                      </div>
                    </div>
                    <Badge className={getStatusBadge(report.status)}>
                      {getStatusText(report.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Última generación:</span>
                        <p className="font-medium">{format(report.lastGenerated, "dd/MM/yyyy HH:mm", { locale: es })}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Tamaño:</span>
                        <p className="font-medium">{report.size}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Descargas:</span>
                        <p className="font-medium">{report.downloadCount}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Programación:</span>
                        <p className="font-medium">{report.schedule || 'Manual'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                        <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800">
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Regenerar
                        </Button>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" className="border-gray-300">
                          <File className="h-4 w-4 mr-1 text-red-600" />
                          PDF
                        </Button>
                        <Button size="sm" variant="outline" className="border-gray-300">
                          <FileSpreadsheet className="h-4 w-4 mr-1 text-green-600" />
                          Excel
                        </Button>
                        <Button size="sm" variant="outline" className="border-gray-300">
                          <Mail className="h-4 w-4 mr-1 text-blue-600" />
                          Enviar
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Generar Reporte */}
        <TabsContent value="generate" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Selección de Plantilla */}
            <div className="lg:col-span-1">
              <Card className="border-purple-200 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200">
                  <CardTitle className="text-purple-800">Plantillas de Reporte</CardTitle>
                  <CardDescription className="text-purple-600">Selecciona el tipo de reporte</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {reportTemplates.map((template) => (
                      <div
                        key={template.id}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedTemplate?.id === template.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-25'
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg bg-${template.color}-100 text-${template.color}-600`}>
                            {template.icon}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{template.name}</p>
                            <p className="text-sm text-gray-500">{template.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Configuración del Reporte */}
            <div className="lg:col-span-2">
              {selectedTemplate ? (
                <Card className="border-gray-200 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                    <CardTitle className="text-gray-800">Configurar Reporte: {selectedTemplate.name}</CardTitle>
                    <CardDescription className="text-gray-600">Personaliza los datos y formato del reporte</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Rango de Fechas */}
                    <div>
                      <Label className="text-base font-medium">Período del Reporte</Label>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <Label htmlFor="from-date">Fecha Inicio</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : "Seleccionar fecha"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={dateRange.from}
                                onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label htmlFor="to-date">Fecha Fin</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : "Seleccionar fecha"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={dateRange.to}
                                onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>

                    {/* Campos a Incluir */}
                    <div>
                      <Label className="text-base font-medium">Campos a Incluir</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {selectedTemplate.fields.map((field) => (
                          <div key={field} className="flex items-center space-x-2">
                            <Checkbox
                              id={field}
                              checked={selectedFields.includes(field)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedFields([...selectedFields, field])
                                } else {
                                  setSelectedFields(selectedFields.filter(f => f !== field))
                                }
                              }}
                            />
                            <Label htmlFor={field} className="text-sm">{field}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Gráficos */}
                    <div>
                      <Label className="text-base font-medium">Gráficos a Incluir</Label>
                      <div className="grid grid-cols-1 gap-2 mt-2">
                        {selectedTemplate.charts.map((chart) => (
                          <div key={chart} className="flex items-center space-x-2">
                            <Checkbox
                              id={chart}
                              checked={selectedCharts.includes(chart)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedCharts([...selectedCharts, chart])
                                } else {
                                  setSelectedCharts(selectedCharts.filter(c => c !== chart))
                                }
                              }}
                            />
                            <Label htmlFor={chart} className="text-sm">{chart}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Formato de Exportación */}
                    <div>
                      <Label className="text-base font-medium">Formato de Exportación</Label>
                      <Select value={exportFormat} onValueChange={setExportFormat}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">
                            <div className="flex items-center">
                              <File className="h-4 w-4 mr-2 text-red-600" />
                              PDF
                            </div>
                          </SelectItem>
                          <SelectItem value="excel">
                            <div className="flex items-center">
                              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                              Excel
                            </div>
                          </SelectItem>
                          <SelectItem value="csv">
                            <div className="flex items-center">
                              <FileText className="h-4 w-4 mr-2 text-blue-600" />
                              CSV
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                      <Button variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        Vista Previa
                      </Button>
                      <Button 
                        onClick={handleGenerateReport}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Generar Reporte
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-gray-200 shadow-lg">
                  <CardContent className="p-12 text-center">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Selecciona una Plantilla</h3>
                    <p className="text-gray-500">Elige una plantilla de reporte para comenzar la configuración</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab: Reportes Programados */}
        <TabsContent value="scheduled" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.filter(r => r.schedule).map((report) => (
              <Card key={report.id} className="border-pink-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="bg-gradient-to-r from-pink-50 to-pink-100 border-b border-pink-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`p-2 rounded-lg bg-pink-100 ${getTypeColor(report.type)}`}>
                        {getTypeIcon(report.type)}
                      </div>
                      <div>
                        <CardTitle className="text-pink-800 text-sm">{report.name}</CardTitle>
                        <CardDescription className="text-pink-600 text-xs">{report.category}</CardDescription>
                      </div>
                    </div>
                    <Clock className="h-4 w-4 text-pink-600" />
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Frecuencia:</span>
                      <Badge className="bg-pink-100 text-pink-800">
                        {report.schedule === 'daily' ? 'Diario' : 
                         report.schedule === 'weekly' ? 'Semanal' : 'Mensual'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Próxima ejecución:</span>
                      <span className="font-medium">Mañana 09:00</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Estado:</span>
                      <Badge className={getStatusBadge(report.status)}>
                        {getStatusText(report.status)}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between pt-3 border-t">
                      <Button variant="ghost" size="sm" className="text-pink-600">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-green-600">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-blue-600">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

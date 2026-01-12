"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  FileText, Download, Calendar as CalendarIcon, 
  BarChart3, Users, Package, 
  Settings, Clock,
  FileSpreadsheet, File, Eye, Archive
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { format } from "date-fns"
import { es } from "date-fns/locale"
import AnalyticsDashboard from './analytics-dashboard'
import InventoryReports from './inventory-reports'

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
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  })
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [selectedCharts, setSelectedCharts] = useState<string[]>([])
  const [exportFormat, setExportFormat] = useState('pdf')
  const [activeTab, setActiveTab] = useState('dashboard')

  const handleGenerateReport = () => {
    console.log('Generando reporte...', {
      template: selectedTemplate,
      dateRange,
      fields: selectedFields,
      charts: selectedCharts,
      format: exportFormat
    })
    // Aquí iría la lógica para generar el reporte real
    alert("Funcionalidad de generación personalizada en desarrollo. Por favor use los dashboards predefinidos.")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold flex items-center text-gray-900 dark:text-white">
              <FileText className="h-8 w-8 mr-3 text-blue-600 dark:text-blue-400" />
              Sistema de Reportes
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Centro de inteligencia de negocios y análisis
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              className="border-gray-300 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Archive className="h-4 w-4 mr-2" />
              Historial
            </Button>
            
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <FileText className="h-4 w-4 mr-2" />
              Nuevo Reporte
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px] bg-gray-100 dark:bg-gray-800 p-1">
          <TabsTrigger 
            value="dashboard" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 shadow-sm"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Ventas y Analytics
          </TabsTrigger>
          <TabsTrigger 
            value="inventory" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 shadow-sm"
          >
            <Package className="h-4 w-4 mr-2" />
            Inventario
          </TabsTrigger>
          <TabsTrigger 
            value="custom" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 shadow-sm"
          >
            <Settings className="h-4 w-4 mr-2" />
            Personalizado
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dashboard (Analytics) */}
        <TabsContent value="dashboard" className="space-y-6 focus-visible:outline-none">
          <AnalyticsDashboard />
        </TabsContent>

        {/* Tab: Inventario */}
        <TabsContent value="inventory" className="space-y-6 focus-visible:outline-none">
          <InventoryReports />
        </TabsContent>

        {/* Tab: Personalizado */}
        <TabsContent value="custom" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Selección de Plantilla */}
            <div className="lg:col-span-1">
              <Card className="border-gray-200 dark:border-gray-700 shadow-lg dark:bg-gray-800">
                <CardHeader className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <CardTitle className="text-gray-800 dark:text-gray-100">Plantillas</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">Selecciona el tipo de reporte</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {reportTemplates.map((template) => (
                      <div
                        key={template.id}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedTemplate?.id === template.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg bg-${template.color}-100 text-${template.color}-600 dark:bg-gray-700 dark:text-${template.color}-400`}>
                            {template.icon}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{template.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{template.description}</p>
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
                <Card className="border-gray-200 dark:border-gray-700 shadow-lg dark:bg-gray-800">
                  <CardHeader className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <CardTitle className="text-gray-800 dark:text-gray-100">Configurar: {selectedTemplate.name}</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">Personaliza los datos y formato</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Rango de Fechas */}
                    <div>
                      <Label className="text-base font-medium dark:text-gray-200">Período</Label>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <Label htmlFor="from-date" className="text-sm text-gray-500 dark:text-gray-400">Desde</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal mt-1 dark:bg-gray-900 dark:border-gray-600">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : "Seleccionar"}
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
                          <Label htmlFor="to-date" className="text-sm text-gray-500 dark:text-gray-400">Hasta</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal mt-1 dark:bg-gray-900 dark:border-gray-600">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : "Seleccionar"}
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
                      <Label className="text-base font-medium dark:text-gray-200">Campos a Incluir</Label>
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
                            <Label htmlFor={field} className="text-sm dark:text-gray-300">{field}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Formato de Exportación */}
                    <div>
                      <Label className="text-base font-medium dark:text-gray-200">Formato</Label>
                      <Select value={exportFormat} onValueChange={setExportFormat}>
                        <SelectTrigger className="mt-2 dark:bg-gray-900 dark:border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">
                            <div className="flex items-center">
                              <File className="h-4 w-4 mr-2 text-red-600" />
                              PDF Document (.pdf)
                            </div>
                          </SelectItem>
                          <SelectItem value="excel">
                            <div className="flex items-center">
                              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                              Excel Spreadsheet (.xlsx)
                            </div>
                          </SelectItem>
                          <SelectItem value="csv">
                            <div className="flex items-center">
                              <FileText className="h-4 w-4 mr-2 text-blue-600" />
                              CSV File (.csv)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                      <Button variant="outline" className="dark:border-gray-600 dark:text-gray-300">
                        <Eye className="h-4 w-4 mr-2" />
                        Vista Previa
                      </Button>
                      <Button 
                        onClick={handleGenerateReport}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Generar Reporte
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-gray-200 dark:border-gray-700 shadow-lg dark:bg-gray-800 h-full">
                  <CardContent className="p-12 text-center h-full flex flex-col justify-center items-center">
                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                      <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Selecciona una Plantilla</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                      Elige una plantilla del menú de la izquierda para comenzar a configurar tu reporte personalizado.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

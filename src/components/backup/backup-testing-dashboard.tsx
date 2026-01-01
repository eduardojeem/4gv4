'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  Play, 
  Square, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  FileText,
  Settings,
  Plus,
  Eye,
  Download,
  Filter,
  Search,
  Shield,
  Database,
  Zap,
  Target,
  Activity
} from 'lucide-react'
import { 
  backupTesting, 
  BackupTest, 
  TestExecution, 
  TestSuite 
} from '@/lib/backup/backup-testing'

export function BackupTestingDashboard() {
  const [tests, setTests] = useState<BackupTest[]>([])
  const [executions, setExecutions] = useState<TestExecution[]>([])
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTest, setSelectedTest] = useState<string | null>(null)
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      
      // Cargar tests
      const testsData = await backupTesting.listTests()
      setTests(testsData)

      // Simular datos de ejecuciones
      const mockExecutions: TestExecution[] = [
        {
          id: 'exec_1',
          testIds: ['test_1', 'test_2'],
          status: 'completed',
          startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
          duration: 1800,
          totalTests: 2,
          passedTests: 2,
          failedTests: 0,
          skippedTests: 0,
          progress: 100,
          results: [],
          summary: {
            overallStatus: 'passed',
            successRate: 100,
            averageDuration: 900,
            criticalIssues: 0,
            recommendations: [],
            nextActions: []
          }
        },
        {
          id: 'exec_2',
          testIds: ['test_3'],
          status: 'running',
          startTime: new Date(Date.now() - 30 * 60 * 1000),
          totalTests: 1,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
          progress: 65,
          currentTest: 'test_3',
          results: [],
          summary: {
            overallStatus: 'failed',
            successRate: 0,
            averageDuration: 0,
            criticalIssues: 0,
            recommendations: [],
            nextActions: []
          }
        }
      ]
      setExecutions(mockExecutions)

      // Simular suites de test
      const mockSuites: TestSuite[] = [
        {
          id: 'suite_1',
          name: 'Suite de Integridad Completa',
          description: 'Tests completos de integridad de backups',
          category: 'backup_integrity',
          tests: ['test_1', 'test_2'],
          schedule: {
            enabled: true,
            frequency: 'daily',
            time: '02:00',
            timezone: 'UTC'
          },
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      setSuites(mockSuites)

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Componente de métricas generales
  const OverviewMetrics = () => {
    const totalTests = tests.length
    const passedTests = tests.filter(t => t.status === 'passed').length
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0

    const runningExecutions = executions.filter(e => e.status === 'running').length

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{totalTests}</p>
                <p className="text-sm text-gray-500">Tests Totales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{successRate.toFixed(1)}%</p>
                <p className="text-sm text-gray-500">Tasa de Éxito</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{runningExecutions}</p>
                <p className="text-sm text-gray-500">Ejecutándose</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Target className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{suites.length}</p>
                <p className="text-sm text-gray-500">Suites Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Componente de lista de tests
  const TestsList = () => {
    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'passed': return <CheckCircle className="h-5 w-5 text-green-500" />
        case 'failed': return <XCircle className="h-5 w-5 text-red-500" />
        case 'running': return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
        case 'pending': return <Clock className="h-5 w-5 text-gray-500" />
        default: return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      }
    }

    const getStatusBadge = (status: string) => {
      const variants = {
        passed: 'default',
        failed: 'destructive',
        running: 'secondary',
        pending: 'outline'
      } as const

      const labels = {
        passed: 'Exitoso',
        failed: 'Fallido',
        running: 'Ejecutando',
        pending: 'Pendiente'
      }

      return (
        <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
          {labels[status as keyof typeof labels] || status}
        </Badge>
      )
    }

    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'integrity': return <Shield className="h-4 w-4" />
        case 'restoration': return <Database className="h-4 w-4" />
        case 'performance': return <Zap className="h-4 w-4" />
        case 'security': return <Shield className="h-4 w-4" />
        case 'compliance': return <FileText className="h-4 w-4" />
        default: return <Activity className="h-4 w-4" />
      }
    }

    const handleRunTest = async (testId: string) => {
      try {
        await backupTesting.executeTest(testId)
        await loadDashboardData()
      } catch (error) {
        console.error('Error running test:', error)
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar tests..." 
              className="px-3 py-2 border rounded-md"
            />
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Test
          </Button>
        </div>

        {tests.map(test => (
          <Card 
            key={test.id} 
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedTest === test.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedTest(selectedTest === test.id ? null : test.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(test.status)}
                  <div>
                    <CardTitle className="text-lg">{test.name}</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      {getTypeIcon(test.type)}
                      <span className="text-sm text-gray-500 capitalize">
                        {test.type}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {test.priority}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(test.status)}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRunTest(test.id)
                    }}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">{test.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Backup ID</p>
                  <p className="font-medium">{test.backupId}</p>
                </div>
                <div>
                  <p className="text-gray-500">Timeout</p>
                  <p className="font-medium">{test.configuration.timeout}s</p>
                </div>
                <div>
                  <p className="text-gray-500">Reintentos</p>
                  <p className="font-medium">{test.configuration.retryAttempts}</p>
                </div>
                <div>
                  <p className="text-gray-500">Última Ejecución</p>
                  <p className="font-medium">
                    {test.lastRun ? test.lastRun.toLocaleDateString() : 'Nunca'}
                  </p>
                </div>
              </div>

              {selectedTest === test.id && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium mb-3">Configuración Detallada</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Ejecución Paralela</p>
                      <p className="font-medium">
                        {test.configuration.parallelExecution ? 'Sí' : 'No'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Limpiar Después</p>
                      <p className="font-medium">
                        {test.configuration.cleanupAfterTest ? 'Sí' : 'No'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Notificar Fallos</p>
                      <p className="font-medium">
                        {test.configuration.notifyOnFailure ? 'Sí' : 'No'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Notificar Éxitos</p>
                      <p className="font-medium">
                        {test.configuration.notifyOnSuccess ? 'Sí' : 'No'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Componente de ejecuciones
  const ExecutionsList = () => {
    const getExecutionStatusIcon = (status: string) => {
      switch (status) {
        case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />
        case 'failed': return <XCircle className="h-5 w-5 text-red-500" />
        case 'running': return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
        case 'pending': return <Clock className="h-5 w-5 text-gray-500" />
        case 'cancelled': return <Square className="h-5 w-5 text-gray-500" />
        default: return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      }
    }

    const handleViewResults = (executionId: string) => {
      setSelectedExecution(executionId)
    }

    const handleGenerateReport = async (executionId: string) => {
      try {
        const reportId = await backupTesting.generateReport(executionId)
        console.log('Report generated:', reportId)
      } catch (error) {
        console.error('Error generating report:', error)
      }
    }

    return (
      <div className="space-y-4">
        {executions.map(execution => (
          <Card key={execution.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getExecutionStatusIcon(execution.status)}
                  <div>
                    <CardTitle className="text-lg">
                      Ejecución {execution.id.slice(-8)}
                    </CardTitle>
                    <CardDescription>
                      {execution.testIds.length} test(s) • Iniciado: {execution.startTime.toLocaleString()}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={execution.status === 'completed' ? 'default' : 'secondary'}>
                    {execution.status}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewResults(execution.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {execution.status === 'completed' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleGenerateReport(execution.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {/* Progreso */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progreso</span>
                    <span className="text-sm text-gray-500">{execution.progress}%</span>
                  </div>
                  <Progress value={execution.progress} className="h-2" />
                  {execution.currentTest && (
                    <p className="text-xs text-gray-500 mt-1">
                      Ejecutando: {execution.currentTest}
                    </p>
                  )}
                </div>

                {/* Estadísticas */}
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{execution.passedTests}</p>
                    <p className="text-gray-500">Exitosos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{execution.failedTests}</p>
                    <p className="text-gray-500">Fallidos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-600">{execution.skippedTests}</p>
                    <p className="text-gray-500">Omitidos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{execution.totalTests}</p>
                    <p className="text-gray-500">Total</p>
                  </div>
                </div>

                {/* Duración */}
                {execution.duration && (
                  <div className="text-sm">
                    <span className="text-gray-500">Duración: </span>
                    <span className="font-medium">{Math.floor(execution.duration / 60)}m {execution.duration % 60}s</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Componente de suites
  const SuitesList = () => {
    const handleRunSuite = async (suiteId: string) => {
      try {
        await backupTesting.executeSuite(suiteId)
        await loadDashboardData()
      } catch (error) {
        console.error('Error running suite:', error)
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Suites de Test</h3>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Suite
          </Button>
        </div>

        {suites.map(suite => (
          <Card key={suite.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{suite.name}</CardTitle>
                  <CardDescription>{suite.description}</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={suite.enabled ? 'default' : 'secondary'}>
                    {suite.enabled ? 'Activa' : 'Inactiva'}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleRunSuite(suite.id)}
                    disabled={!suite.enabled}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Categoría</p>
                  <p className="font-medium capitalize">{suite.category.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-gray-500">Tests</p>
                  <p className="font-medium">{suite.tests.length}</p>
                </div>
                <div>
                  <p className="text-gray-500">Frecuencia</p>
                  <p className="font-medium capitalize">{suite.schedule.frequency}</p>
                </div>
                <div>
                  <p className="text-gray-500">Próxima Ejecución</p>
                  <p className="font-medium">
                    {suite.schedule.enabled ? suite.schedule.time || 'Programada' : 'Deshabilitada'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Componente de gráficos
  const TestingCharts = () => {
    // Datos simulados para gráficos
    const successRateData = Array.from({ length: 7 }, (_, i) => ({
      day: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][i],
      successRate: 85 + Math.random() * 15,
      totalTests: Math.floor(Math.random() * 20) + 10
    }))

    const testTypeData = [
      { name: 'Integridad', value: 35, color: '#10b981' },
      { name: 'Restauración', value: 25, color: '#3b82f6' },
      { name: 'Rendimiento', value: 20, color: '#f59e0b' },
      { name: 'Seguridad', value: 15, color: '#ef4444' },
      { name: 'Cumplimiento', value: 5, color: '#8b5cf6' }
    ]

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tasa de Éxito por Día</CardTitle>
            <CardDescription>Porcentaje de tests exitosos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={successRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="successRate" 
                  stroke="#10b981" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución por Tipo</CardTitle>
            <CardDescription>Tests por categoría</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={testTypeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {testTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando sistema de testing...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Testing de Backups</h2>
          <p className="text-gray-600">Sistema automático de validación y testing de backups</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={loadDashboardData}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Métricas generales */}
      <OverviewMetrics />

      {/* Tabs principales */}
      <Tabs defaultValue="tests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tests">Tests</TabsTrigger>
          <TabsTrigger value="executions">Ejecuciones</TabsTrigger>
          <TabsTrigger value="suites">Suites</TabsTrigger>
          <TabsTrigger value="analytics">Analíticas</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="tests">
          <TestsList />
        </TabsContent>

        <TabsContent value="executions">
          <ExecutionsList />
        </TabsContent>

        <TabsContent value="suites">
          <SuitesList />
        </TabsContent>

        <TabsContent value="analytics">
          <TestingCharts />
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <p className="text-lg font-medium">Generación de Reportes</p>
              <p className="text-gray-500">Funcionalidad en desarrollo</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default BackupTestingDashboard
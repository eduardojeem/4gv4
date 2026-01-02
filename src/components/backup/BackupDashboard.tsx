'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence  } from '../ui/motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { BarChart } from 'recharts/es6/chart/BarChart';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { XAxis } from 'recharts/es6/cartesian/XAxis';
import { YAxis } from 'recharts/es6/cartesian/YAxis';
import { CartesianGrid } from 'recharts/es6/cartesian/CartesianGrid';
import { Tooltip } from 'recharts/es6/component/Tooltip';
import { ResponsiveContainer } from 'recharts/es6/component/ResponsiveContainer';
import { LineChart } from 'recharts/es6/chart/LineChart';
import { Line } from 'recharts/es6/cartesian/Line';
import { PieChart } from 'recharts/es6/chart/PieChart';
import { Pie } from 'recharts/es6/polar/Pie';
import { Cell } from 'recharts/es6/component/Cell';
import { AreaChart } from 'recharts/es6/chart/AreaChart';
import { Area } from 'recharts/es6/cartesian/Area';
import {
  Database,
  HardDrive,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Settings,
  Calendar,
  FileText,
  Server,
  Cloud,
  Archive,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Eye,
  Activity,
  Zap,
  Target,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import { 
  useBackupSystem, 
  type BackupConfig, 
  type BackupJob, 
  type BackupMetrics,
  type RestoreJob 
} from '@/lib/backup/backup-system'
import { formatBytes, formatDuration } from '@/lib/utils'

interface BackupDashboardProps {
  className?: string
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

export default function BackupDashboard({ className }: BackupDashboardProps) {
  const { metrics, jobs, configs, createConfig, executeBackup, restoreBackup, loadBackupData } = useBackupSystem()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<BackupJob | null>(null)
  const [showCreateConfig, setShowCreateConfig] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Estados para formularios
  const [newConfig, setNewConfig] = useState<Partial<BackupConfig>>({
    name: '',
    description: '',
    enabled: true,
    schedule: {
      frequency: 'daily',
      time: '02:00'
    },
    retention: {
      keepDaily: 7,
      keepWeekly: 4,
      keepMonthly: 12,
      keepYearly: 3
    },
    targets: [],
    compression: true,
    encryption: true,
    notifications: {
      onSuccess: true,
      onFailure: true
    }
  })

  const [restoreOptions, setRestoreOptions] = useState<RestoreJob['options']>({
    overwrite: false,
    validateIntegrity: true,
    testRestore: false
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      await loadBackupData()
    } catch (error) {
      console.error('Error loading backup data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleCreateConfig = async () => {
    try {
      if (!newConfig.name || !newConfig.description) {
        throw new Error('Nombre y descripción son requeridos')
      }

      await createConfig(newConfig as Omit<BackupConfig, 'id' | 'createdAt' | 'updatedAt'>)
      setShowCreateConfig(false)
      setNewConfig({
        name: '',
        description: '',
        enabled: true,
        schedule: { frequency: 'daily', time: '02:00' },
        retention: { keepDaily: 7, keepWeekly: 4, keepMonthly: 12, keepYearly: 3 },
        targets: [],
        compression: true,
        encryption: true,
        notifications: { onSuccess: true, onFailure: true }
      })
      await loadData()
    } catch (error) {
      console.error('Error creating backup config:', error)
    }
  }

  const handleExecuteBackup = async (configId: string) => {
    try {
      await executeBackup(configId)
      await loadData()
    } catch (error) {
      console.error('Error executing backup:', error)
    }
  }

  const handleRestoreBackup = async () => {
    try {
      if (!selectedJob) return
      
      await restoreBackup(selectedJob.id, restoreOptions)
      setShowRestoreDialog(false)
      setSelectedJob(null)
      await loadData()
    } catch (error) {
      console.error('Error restoring backup:', error)
    }
  }

  // Componente de KPI Card
  const KPICard = ({ 
    title, 
    value, 
    change, 
    trend, 
    icon: Icon, 
    color = 'blue',
    format = 'number'
  }: {
    title: string
    value: number | string
    change?: number
    trend?: 'up' | 'down' | 'stable'
    icon: React.ElementType
    color?: string
    format?: 'number' | 'bytes' | 'duration' | 'percentage'
  }) => {
    const formatValue = (val: number | string) => {
      if (typeof val === 'string') return val
      
      switch (format) {
        case 'bytes':
          return formatBytes(val)
        case 'duration':
          return formatDuration(val)
        case 'percentage':
          return `${val.toFixed(1)}%`
        default:
          return val.toLocaleString()
      }
    }

    const getTrendColor = () => {
      switch (trend) {
        case 'up': return 'text-green-600'
        case 'down': return 'text-red-600'
        default: return 'text-gray-600'
      }
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold">{formatValue(value)}</p>
                {change !== undefined && (
                  <div className={`flex items-center space-x-1 text-sm ${getTrendColor()}`}>
                    <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
                  </div>
                )}
              </div>
              <div className={`p-3 rounded-full bg-${color}-100 text-${color}-600`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Componente de estado de backup
  const BackupStatusBadge = ({ status }: { status: BackupJob['status'] }) => {
    const getStatusConfig = () => {
      switch (status) {
        case 'completed':
          return { variant: 'default' as const, color: 'bg-green-100 text-green-800', icon: CheckCircle }
        case 'failed':
          return { variant: 'destructive' as const, color: 'bg-red-100 text-red-800', icon: XCircle }
        case 'running':
          return { variant: 'secondary' as const, color: 'bg-blue-100 text-blue-800', icon: Activity }
        case 'pending':
          return { variant: 'outline' as const, color: 'bg-yellow-100 text-yellow-800', icon: Clock }
        default:
          return { variant: 'outline' as const, color: 'bg-gray-100 text-gray-800', icon: AlertCircle }
      }
    }

    const config = getStatusConfig()
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  // Componente de tabla de trabajos de backup
  const BackupJobsTable = ({ jobs }: { jobs: BackupJob[] }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Archive className="h-5 w-5 mr-2" />
          Trabajos de Backup Recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {jobs.slice(0, 10).map((job) => (
            <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Database className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Backup {job.configId}</p>
                  <p className="text-sm text-gray-600">
                    {job.startTime.toLocaleDateString()} {job.startTime.toLocaleTimeString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {job.size ? formatBytes(job.size) : 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {job.duration ? formatDuration(job.duration) : 'N/A'}
                  </p>
                </div>
                
                <BackupStatusBadge status={job.status} />
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedJob(job)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {job.status === 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedJob(job)
                        setShowRestoreDialog(true)
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  // Componente de configuraciones de backup
  const BackupConfigsTable = ({ configs }: { configs: BackupConfig[] }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Configuraciones de Backup
          </div>
          <Button onClick={() => setShowCreateConfig(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Configuración
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {configs.map((config) => (
            <div key={config.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  config.enabled ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <Shield className={`h-5 w-5 ${
                    config.enabled ? 'text-green-600' : 'text-gray-600'
                  }`} />
                </div>
                <div>
                  <p className="font-medium">{config.name}</p>
                  <p className="text-sm text-gray-600">{config.description}</p>
                  <p className="text-sm text-gray-500">
                    {config.schedule.frequency} a las {config.schedule.time}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Badge variant={config.enabled ? 'default' : 'secondary'}>
                  {config.enabled ? 'Activo' : 'Inactivo'}
                </Badge>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExecuteBackup(config.id)}
                    disabled={!config.enabled}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando sistema de backup...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Sistema de Backup</h1>
          <p className="text-muted-foreground">Gestión y monitoreo de backups automatizados</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          
          <Button onClick={() => setShowCreateConfig(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Configuración
          </Button>
        </div>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Resumen</span>
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center space-x-2">
            <Archive className="h-4 w-4" />
            <span>Trabajos</span>
          </TabsTrigger>
          <TabsTrigger value="configs" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Configuraciones</span>
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center space-x-2">
            <Target className="h-4 w-4" />
            <span>Monitoreo</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPIs principales */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard
                title="Total Backups"
                value={metrics.totalBackups}
                change={5.2}
                trend="up"
                icon={Archive}
                color="blue"
              />
              <KPICard
                title="Tasa de Éxito"
                value={(metrics.successfulBackups / metrics.totalBackups) * 100}
                change={2.1}
                trend="up"
                icon={CheckCircle}
                color="green"
                format="percentage"
              />
              <KPICard
                title="Tamaño Total"
                value={metrics.totalSize}
                change={8.3}
                trend="up"
                icon={HardDrive}
                color="purple"
                format="bytes"
              />
              <KPICard
                title="Tiempo Promedio"
                value={metrics.averageDuration}
                change={-3.1}
                trend="up"
                icon={Clock}
                color="orange"
                format="duration"
              />
            </div>
          )}

          {/* Gráficos de resumen */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Uso de Almacenamiento</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Usado</span>
                      <span className="font-semibold">
                        {formatBytes(metrics.storageUsage.used)}
                      </span>
                    </div>
                    <Progress value={metrics.storageUsage.percentage} />
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{formatBytes(metrics.storageUsage.used)} usado</span>
                      <span>{formatBytes(metrics.storageUsage.available)} disponible</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estado del Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Último Backup</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {metrics?.lastBackupTime?.toLocaleString() || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-blue-500" />
                      <span>Próximo Backup</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {metrics?.nextScheduledBackup?.toLocaleString() || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-purple-500" />
                      <span>Cumplimiento</span>
                    </div>
                    <Badge variant={metrics?.retentionCompliance.compliant ? 'default' : 'destructive'}>
                      {metrics?.retentionCompliance.compliant ? 'Completo' : 'Pendiente'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trabajos recientes */}
          <BackupJobsTable jobs={jobs} />
        </TabsContent>

        {/* Tab: Trabajos */}
        <TabsContent value="jobs" className="space-y-6">
          <BackupJobsTable jobs={jobs} />
        </TabsContent>

        {/* Tab: Configuraciones */}
        <TabsContent value="configs" className="space-y-6">
          <BackupConfigsTable configs={configs} />
        </TabsContent>

        {/* Tab: Monitoreo */}
        <TabsContent value="monitoring" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tendencia de Backups</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={[
                    { date: '2024-01-01', successful: 45, failed: 2 },
                    { date: '2024-01-02', successful: 48, failed: 1 },
                    { date: '2024-01-03', successful: 52, failed: 3 },
                    { date: '2024-01-04', successful: 47, failed: 1 },
                    { date: '2024-01-05', successful: 51, failed: 2 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="successful" stackId="1" stroke="#10b981" fill="#10b981" />
                    <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#ef4444" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribución por Tamaño</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Pequeño (<100MB)', value: 35 },
                        { name: 'Mediano (100MB-1GB)', value: 45 },
                        { name: 'Grande (1GB-10GB)', value: 15 },
                        { name: 'Muy Grande (>10GB)', value: 5 }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[0, 1, 2, 3].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Crear configuración */}
      <Dialog open={showCreateConfig} onOpenChange={setShowCreateConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva Configuración de Backup</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={newConfig.name || ''}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre de la configuración"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="frequency">Frecuencia</Label>
                <Select
                  value={newConfig.schedule?.frequency}
                  onValueChange={(value) => setNewConfig(prev => ({
                    ...prev,
                    schedule: { ...prev.schedule!, frequency: value as any }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Cada hora</SelectItem>
                    <SelectItem value="daily">Diario</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={newConfig.description || ''}
                onChange={(e) => setNewConfig(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción de la configuración"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newConfig.compression}
                  onCheckedChange={(checked) => setNewConfig(prev => ({ ...prev, compression: checked }))}
                />
                <Label>Compresión</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newConfig.encryption}
                  onCheckedChange={(checked) => setNewConfig(prev => ({ ...prev, encryption: checked }))}
                />
                <Label>Encriptación</Label>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowCreateConfig(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateConfig}>
                Crear Configuración
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Restaurar backup */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar Backup</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={restoreOptions.overwrite}
                onCheckedChange={(checked) => setRestoreOptions(prev => ({ ...prev, overwrite: checked }))}
              />
              <Label>Sobrescribir archivos existentes</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={restoreOptions.validateIntegrity}
                onCheckedChange={(checked) => setRestoreOptions(prev => ({ ...prev, validateIntegrity: checked }))}
              />
              <Label>Validar integridad</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={restoreOptions.testRestore}
                onCheckedChange={(checked) => setRestoreOptions(prev => ({ ...prev, testRestore: checked }))}
              />
              <Label>Restauración de prueba</Label>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRestoreBackup}>
                Restaurar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
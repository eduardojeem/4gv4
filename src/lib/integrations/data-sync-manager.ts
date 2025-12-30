'use client'

import { createClient } from '@/lib/supabase/client'

// Interfaces para sincronización de datos
export interface SyncConfiguration {
  id: string
  name: string
  description: string
  sourceSystem: string
  targetSystem: string
  syncType: 'full' | 'incremental' | 'real-time' | 'scheduled'
  direction: 'bidirectional' | 'source-to-target' | 'target-to-source'
  schedule?: SyncSchedule
  mapping: FieldMapping[]
  filters: SyncFilter[]
  transformations: DataTransformation[]
  conflictResolution: ConflictResolutionStrategy
  validation: ValidationRule[]
  active: boolean
  lastSyncAt?: Date
  nextSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface SyncSchedule {
  type: 'interval' | 'cron' | 'event-driven'
  interval?: number // en minutos
  cronExpression?: string
  timezone?: string
  enabled: boolean
}

export interface FieldMapping {
  id: string
  sourceField: string
  targetField: string
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array'
  required: boolean
  defaultValue?: unknown
  transformation?: string // JavaScript code
}

export interface SyncFilter {
  id: string
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in' | 'exists' | 'not_exists'
  value: unknown
  logicalOperator?: 'AND' | 'OR'
}

export interface DataTransformation {
  id: string
  name: string
  type: 'field' | 'record' | 'batch'
  script: string // JavaScript code
  order: number
  enabled: boolean
}

export interface ConflictResolutionStrategy {
  strategy: 'source-wins' | 'target-wins' | 'newest-wins' | 'manual' | 'merge' | 'custom'
  customScript?: string // JavaScript code para estrategia personalizada
  fields?: { [field: string]: 'source' | 'target' | 'newest' | 'merge' }
}

export interface ValidationRule {
  id: string
  field: string
  type: 'required' | 'format' | 'range' | 'custom'
  parameters: Record<string, unknown>
  errorMessage: string
  severity: 'error' | 'warning'
}

export interface SyncJob {
  id: string
  configurationId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  type: 'manual' | 'scheduled' | 'triggered'
  startedAt: Date
  completedAt?: Date
  progress: SyncProgress
  statistics: SyncStatistics
  errors: SyncError[]
  logs: SyncLog[]
  metadata: Record<string, any>
}

export interface SyncProgress {
  totalRecords: number
  processedRecords: number
  successfulRecords: number
  failedRecords: number
  skippedRecords: number
  percentage: number
  currentPhase: 'initializing' | 'extracting' | 'transforming' | 'loading' | 'validating' | 'finalizing'
  estimatedTimeRemaining?: number
}

export interface SyncStatistics {
  duration: number
  throughput: number // registros por segundo
  dataVolume: number // bytes transferidos
  apiCalls: number
  cacheHits: number
  cacheMisses: number
  retries: number
  conflicts: number
  validationErrors: number
}

export interface SyncError {
  id: string
  jobId: string
  type: 'extraction' | 'transformation' | 'loading' | 'validation' | 'conflict' | 'system'
  severity: 'error' | 'warning'
  message: string
  details: Record<string, unknown>
  recordId?: string
  field?: string
  timestamp: Date
  resolved: boolean
  resolution?: string
}

export interface SyncLog {
  id: string
  jobId: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  details?: Record<string, unknown>
  timestamp: Date
  component: string
}

export interface DataRecord {
  id: string
  sourceId: string
  targetId?: string
  data: Record<string, unknown>
  metadata: {
    sourceSystem: string
    targetSystem: string
    lastModified: Date
    version: number
    checksum: string
    tags: string[]
  }
  syncStatus: 'pending' | 'synced' | 'conflict' | 'error'
  lastSyncAt?: Date
  conflicts?: DataConflict[]
}

export interface DataConflict {
  id: string
  recordId: string
  field: string
  sourceValue: unknown
  targetValue: unknown
  conflictType: 'value' | 'type' | 'missing' | 'extra'
  detectedAt: Date
  resolvedAt?: Date
  resolution?: 'source' | 'target' | 'merge' | 'manual'
  resolvedBy?: string
}

export interface SyncMetrics {
  configurationId: string
  period: {
    start: Date
    end: Date
  }
  totalJobs: number
  successfulJobs: number
  failedJobs: number
  totalRecords: number
  successRate: number
  avgDuration: number
  avgThroughput: number
  errorRate: number
  conflictRate: number
  dataQualityScore: number
  systemLoad: {
    cpu: number
    memory: number
    network: number
  }
}

class DataSyncManager {
  private supabase = createClient()
  private configurations: Map<string, SyncConfiguration> = new Map()
  private activeJobs: Map<string, SyncJob> = new Map()
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map()
  private isInitialized = false

  // Inicializar manager
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    await this.loadConfigurations()
    await this.scheduleJobs()
    this.startMonitoring()
    
    this.isInitialized = true
  }

  // Cargar configuraciones desde la base de datos
  private async loadConfigurations(): Promise<void> {
    try {
      const { data: configs } = await this.supabase
        .from('sync_configurations')
        .select('*')
        .eq('active', true)

      if (configs) {
        for (const config of configs) {
          this.configurations.set(config.id, {
            ...config,
            createdAt: new Date(config.created_at),
            updatedAt: new Date(config.updated_at),
            lastSyncAt: config.last_sync_at ? new Date(config.last_sync_at) : undefined,
            nextSyncAt: config.next_sync_at ? new Date(config.next_sync_at) : undefined
          })
        }
      }
    } catch (error) {
      console.error('Error loading sync configurations:', error)
    }
  }

  // Crear nueva configuración de sincronización
  async createConfiguration(config: Omit<SyncConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date()

      const newConfig: SyncConfiguration = {
        ...config,
        id,
        createdAt: now,
        updatedAt: now
      }

      // Guardar en base de datos
      await this.supabase
        .from('sync_configurations')
        .insert({
          id,
          name: config.name,
          description: config.description,
          source_system: config.sourceSystem,
          target_system: config.targetSystem,
          sync_type: config.syncType,
          direction: config.direction,
          schedule: config.schedule,
          mapping: config.mapping,
          filters: config.filters,
          transformations: config.transformations,
          conflict_resolution: config.conflictResolution,
          validation: config.validation,
          active: config.active,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })

      // Agregar a memoria
      this.configurations.set(id, newConfig)

      // Programar si es necesario
      if (config.active && config.schedule?.enabled) {
        this.scheduleJob(newConfig)
      }

      return id
    } catch (error) {
      console.error('Error creating sync configuration:', error)
      throw error
    }
  }

  // Ejecutar sincronización manual
  async executeSync(configurationId: string, options?: { force?: boolean; dryRun?: boolean }): Promise<string> {
    try {
      const configuration = this.configurations.get(configurationId)
      if (!configuration) {
        throw new Error('Configuration not found')
      }

      if (!configuration.active && !options?.force) {
        throw new Error('Configuration is inactive')
      }

      // Crear job
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const job: SyncJob = {
        id: jobId,
        configurationId,
        status: 'pending',
        type: 'manual',
        startedAt: new Date(),
        progress: {
          totalRecords: 0,
          processedRecords: 0,
          successfulRecords: 0,
          failedRecords: 0,
          skippedRecords: 0,
          percentage: 0,
          currentPhase: 'initializing'
        },
        statistics: {
          duration: 0,
          throughput: 0,
          dataVolume: 0,
          apiCalls: 0,
          cacheHits: 0,
          cacheMisses: 0,
          retries: 0,
          conflicts: 0,
          validationErrors: 0
        },
        errors: [],
        logs: [],
        metadata: { dryRun: options?.dryRun || false }
      }

      // Guardar job
      await this.saveSyncJob(job)
      this.activeJobs.set(jobId, job)

      // Ejecutar en background
      this.executeSyncJob(job, configuration).catch(error => {
        console.error('Error executing sync job:', error)
      })

      return jobId
    } catch (error) {
      console.error('Error starting sync:', error)
      throw error
    }
  }

  // Ejecutar job de sincronización
  private async executeSyncJob(job: SyncJob, configuration: SyncConfiguration): Promise<void> {
    const startTime = Date.now()

    try {
      job.status = 'running'
      await this.updateSyncJob(job)

      this.addLog(job, 'info', 'Sync job started', { configurationId: configuration.id })

      // Fase 1: Extracción
      job.progress.currentPhase = 'extracting'
      await this.updateSyncJob(job)
      
      const sourceData = await this.extractData(configuration, job)
      job.progress.totalRecords = sourceData.length
      
      this.addLog(job, 'info', `Extracted ${sourceData.length} records from source`)

      // Fase 2: Transformación
      job.progress.currentPhase = 'transforming'
      await this.updateSyncJob(job)
      
      const transformedData = await this.transformData(sourceData, configuration, job)
      
      this.addLog(job, 'info', `Transformed ${transformedData.length} records`)

      // Fase 3: Validación
      job.progress.currentPhase = 'validating'
      await this.updateSyncJob(job)
      
      const validatedData = await this.validateData(transformedData, configuration, job)
      
      this.addLog(job, 'info', `Validated ${validatedData.length} records`)

      // Fase 4: Carga (si no es dry run)
      if (!job.metadata.dryRun) {
        job.progress.currentPhase = 'loading'
        await this.updateSyncJob(job)
        
        await this.loadData(validatedData, configuration, job)
        
        this.addLog(job, 'info', `Loaded ${job.progress.successfulRecords} records to target`)
      }

      // Fase 5: Finalización
      job.progress.currentPhase = 'finalizing'
      job.progress.percentage = 100
      job.status = 'completed'
      job.completedAt = new Date()
      job.statistics.duration = Date.now() - startTime

      // Actualizar configuración
      configuration.lastSyncAt = new Date()
      if (configuration.schedule?.enabled) {
        configuration.nextSyncAt = this.calculateNextSync(configuration.schedule)
      }

      await this.updateConfiguration(configuration)
      await this.updateSyncJob(job)

      this.addLog(job, 'info', 'Sync job completed successfully')

    } catch (error) {
      job.status = 'failed'
      job.completedAt = new Date()
      job.statistics.duration = Date.now() - startTime

      const syncError: SyncError = {
        id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        jobId: job.id,
        type: 'system',
        severity: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        timestamp: new Date(),
        resolved: false
      }

      job.errors.push(syncError)
      await this.updateSyncJob(job)

      this.addLog(job, 'error', 'Sync job failed', { error: syncError.message })
    } finally {
      this.activeJobs.delete(job.id)
    }
  }

  // Extraer datos del sistema fuente
  private async extractData(configuration: SyncConfiguration, job: SyncJob): Promise<any[]> {
    try {
      // Simular extracción de datos
      // En implementación real, aquí se conectaría al sistema fuente
      const data = []
      
      // Aplicar filtros
      const filteredData = this.applyFilters(data, configuration.filters)
      
      job.statistics.apiCalls++
      
      return filteredData
    } catch (error) {
      throw new Error(`Data extraction failed: ${error}`)
    }
  }

  // Transformar datos según mapping y transformaciones
  private async transformData(data: Array<Record<string, unknown>>, configuration: SyncConfiguration, job: SyncJob): Promise<Array<Record<string, unknown>>> {
    const transformedData = []

    for (const record of data) {
      try {
        // Aplicar mapping de campos
        let transformedRecord = this.applyFieldMapping(record, configuration.mapping)

        // Aplicar transformaciones
        transformedRecord = await this.applyTransformations(transformedRecord, configuration.transformations)

        transformedData.push(transformedRecord)
        job.progress.processedRecords++

      } catch (error) {
        const syncError: SyncError = {
          id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          jobId: job.id,
          type: 'transformation',
          severity: 'error',
          message: `Transformation failed for record: ${error}`,
          details: { record, error },
          recordId: record.id,
          timestamp: new Date(),
          resolved: false
        }

        job.errors.push(syncError)
        job.progress.failedRecords++
      }

      // Actualizar progreso
      job.progress.percentage = Math.round((job.progress.processedRecords / data.length) * 50) + 25
      if (job.progress.processedRecords % 100 === 0) {
        await this.updateSyncJob(job)
      }
    }

    return transformedData
  }

  // Validar datos
  private async validateData(data: Array<Record<string, unknown>>, configuration: SyncConfiguration, job: SyncJob): Promise<Array<Record<string, unknown>>> {
    const validatedData = []

    for (const record of data) {
      const validationErrors = this.validateRecord(record, configuration.validation)
      
      if (validationErrors.length === 0) {
        validatedData.push(record)
      } else {
        // Determinar si son errores críticos o advertencias
        const criticalErrors = validationErrors.filter(e => e.severity === 'error')
        
        if (criticalErrors.length === 0) {
          // Solo advertencias, incluir el registro
          validatedData.push(record)
          job.statistics.validationErrors += validationErrors.length
        } else {
          // Errores críticos, rechazar el registro
          for (const validationError of criticalErrors) {
            const syncError: SyncError = {
              id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              jobId: job.id,
              type: 'validation',
              severity: 'error',
              message: validationError.errorMessage,
              details: { record, validationError },
              recordId: record.id,
              field: validationError.field,
              timestamp: new Date(),
              resolved: false
            }

            job.errors.push(syncError)
          }
          
          job.progress.failedRecords++
        }
      }
    }

    return validatedData
  }

  // Cargar datos al sistema destino
  private async loadData(data: Array<Record<string, unknown>>, configuration: SyncConfiguration, job: SyncJob): Promise<void> {
    for (const record of data) {
      try {
        // Verificar si el registro ya existe
        const existingRecord = await this.findExistingRecord(record, configuration)
        
        if (existingRecord) {
          // Manejar conflicto
          const resolution = await this.resolveConflict(record, existingRecord, configuration)
          
          if (resolution.action === 'update') {
            await this.updateRecord(resolution.data, configuration)
            job.progress.successfulRecords++
          } else if (resolution.action === 'skip') {
            job.progress.skippedRecords++
          } else if (resolution.action === 'conflict') {
            job.statistics.conflicts++
            // Guardar conflicto para resolución manual
            await this.saveConflict(record, existingRecord, configuration, job)
          }
        } else {
          // Crear nuevo registro
          await this.createRecord(record, configuration)
          job.progress.successfulRecords++
        }

        job.statistics.apiCalls++

      } catch (error) {
        const syncError: SyncError = {
          id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          jobId: job.id,
          type: 'loading',
          severity: 'error',
          message: `Failed to load record: ${error}`,
          details: { record, error },
          recordId: record.id,
          timestamp: new Date(),
          resolved: false
        }

        job.errors.push(syncError)
        job.progress.failedRecords++
      }

      // Actualizar progreso
      const totalProcessed = job.progress.successfulRecords + job.progress.failedRecords + job.progress.skippedRecords
      job.progress.percentage = Math.round((totalProcessed / data.length) * 25) + 75
      
      if (totalProcessed % 50 === 0) {
        await this.updateSyncJob(job)
      }
    }
  }

  // Aplicar filtros
  private applyFilters(data: Array<Record<string, unknown>>, filters: SyncFilter[]): Array<Record<string, unknown>> {
    if (filters.length === 0) return data

    return data.filter(record => {
      return filters.every(filter => {
        const value = this.getNestedValue(record, filter.field)
        
        switch (filter.operator) {
          case 'equals':
            return value === filter.value
          case 'not_equals':
            return value !== filter.value
          case 'greater_than':
            return value > filter.value
          case 'less_than':
            return value < filter.value
          case 'contains':
            return String(value).includes(String(filter.value))
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value)
          case 'not_in':
            return Array.isArray(filter.value) && !filter.value.includes(value)
          case 'exists':
            return value !== undefined && value !== null
          case 'not_exists':
            return value === undefined || value === null
          default:
            return false
        }
      })
    })
  }

  // Aplicar mapping de campos
  private applyFieldMapping(record: Record<string, unknown>, mapping: FieldMapping[]): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const map of mapping) {
      try {
        let value = this.getNestedValue(record, map.sourceField)

        // Aplicar valor por defecto si es necesario
        if ((value === undefined || value === null) && map.defaultValue !== undefined) {
          value = map.defaultValue
        }

        // Validar campo requerido
        if (map.required && (value === undefined || value === null)) {
          throw new Error(`Required field ${map.sourceField} is missing`)
        }

        // Convertir tipo de dato
        value = this.convertDataType(value, map.dataType)

        // Aplicar transformación personalizada
        if (map.transformation) {
          try {
            const func = new Function('value', 'record', map.transformation)
            value = func(value, record)
          } catch (error) {
            console.error('Field transformation error:', error)
          }
        }

        this.setNestedValue(result, map.targetField, value)
      } catch (error) {
        console.error(`Field mapping error for ${map.sourceField}:`, error)
      }
    }

    return result
  }

  // Aplicar transformaciones
  private async applyTransformations(record: Record<string, unknown>, transformations: DataTransformation[]): Promise<Record<string, unknown>> {
    let result = JSON.parse(JSON.stringify(record)) // Deep clone

    // Ordenar transformaciones por orden
    const sortedTransformations = transformations
      .filter(t => t.enabled)
      .sort((a, b) => a.order - b.order)

    for (const transformation of sortedTransformations) {
      try {
        switch (transformation.type) {
          case 'field':
            // Transformación a nivel de campo
            const func = new Function('record', transformation.script)
            result = func(result) || result
            break
          case 'record':
            // Transformación a nivel de registro
            const recordFunc = new Function('record', transformation.script)
            result = recordFunc(result) || result
            break
          case 'batch':
            // Transformación a nivel de lote (se aplicaría en el nivel superior)
            break
        }
      } catch (error) {
        console.error(`Transformation error for ${transformation.name}:`, error)
      }
    }

    return result
  }

  // Validar registro
  private validateRecord(record: Record<string, unknown>, rules: ValidationRule[]): ValidationRule[] {
    const errors: ValidationRule[] = []

    for (const rule of rules) {
      const value = this.getNestedValue(record, rule.field)
      let isValid = true

      switch (rule.type) {
        case 'required':
          isValid = value !== undefined && value !== null && value !== ''
          break
        case 'format':
          if (value && rule.parameters.pattern) {
            const regex = new RegExp(rule.parameters.pattern)
            isValid = regex.test(String(value))
          }
          break
        case 'range':
          if (value !== undefined && value !== null) {
            const numValue = Number(value)
            if (!isNaN(numValue)) {
              if (rule.parameters.min !== undefined) {
                isValid = isValid && numValue >= rule.parameters.min
              }
              if (rule.parameters.max !== undefined) {
                isValid = isValid && numValue <= rule.parameters.max
              }
            }
          }
          break
        case 'custom':
          if (rule.parameters.script) {
            try {
              const func = new Function('value', 'record', rule.parameters.script)
              isValid = func(value, record)
            } catch (error) {
              isValid = false
            }
          }
          break
      }

      if (!isValid) {
        errors.push(rule)
      }
    }

    return errors
  }

  // Resolver conflictos
  private async resolveConflict(
    newRecord: Record<string, unknown>,
    existingRecord: Record<string, unknown>,
    configuration: SyncConfiguration
  ): Promise<{ action: 'update' | 'skip' | 'conflict'; data?: Record<string, unknown> }> {
    const strategy = configuration.conflictResolution

    switch (strategy.strategy) {
      case 'source-wins':
        return { action: 'update', data: newRecord }
      case 'target-wins':
        return { action: 'skip' }
      case 'newest-wins':
        const newTimestamp = new Date(newRecord.updated_at || newRecord.created_at)
        const existingTimestamp = new Date(existingRecord.updated_at || existingRecord.created_at)
        return newTimestamp > existingTimestamp 
          ? { action: 'update', data: newRecord }
          : { action: 'skip' }
      case 'merge':
        const mergedData = this.mergeRecords(newRecord, existingRecord, strategy.fields)
        return { action: 'update', data: mergedData }
      case 'custom':
        if (strategy.customScript) {
          try {
            const func = new Function('newRecord', 'existingRecord', strategy.customScript)
            const result = func(newRecord, existingRecord)
            return result || { action: 'conflict' }
          } catch (error) {
            console.error('Custom conflict resolution error:', error)
            return { action: 'conflict' }
          }
        }
        return { action: 'conflict' }
      case 'manual':
      default:
        return { action: 'conflict' }
    }
  }

  // Fusionar registros
  private mergeRecords(newRecord: Record<string, unknown>, existingRecord: Record<string, unknown>, fieldStrategies?: { [field: string]: string }): Record<string, unknown> {
    const merged = JSON.parse(JSON.stringify(existingRecord)) // Start with existing

    for (const [field, value] of Object.entries(newRecord)) {
      const strategy = fieldStrategies?.[field] || 'source'
      
      switch (strategy) {
        case 'source':
          merged[field] = value
          break
        case 'target':
          // Keep existing value
          break
        case 'newest':
          // Implementar lógica de timestamp por campo si es necesario
          merged[field] = value
          break
        case 'merge':
          if (Array.isArray(value) && Array.isArray(merged[field])) {
            merged[field] = [...new Set([...merged[field], ...value])]
          } else if (typeof value === 'object' && typeof merged[field] === 'object') {
            merged[field] = { ...merged[field], ...value }
          } else {
            merged[field] = value
          }
          break
      }
    }

    return merged
  }

  // Programar jobs
  private async scheduleJobs(): Promise<void> {
    for (const [id, config] of this.configurations) {
      if (config.active && config.schedule?.enabled) {
        this.scheduleJob(config)
      }
    }
  }

  private scheduleJob(configuration: SyncConfiguration): void {
    if (!configuration.schedule?.enabled) return

    const schedule = configuration.schedule

    if (schedule.type === 'interval' && schedule.interval) {
      const intervalMs = schedule.interval * 60 * 1000 // Convertir minutos a ms
      
      const timeout = setInterval(async () => {
        try {
          await this.executeSync(configuration.id)
        } catch (error) {
          console.error(`Scheduled sync failed for ${configuration.id}:`, error)
        }
      }, intervalMs)

      this.scheduledJobs.set(configuration.id, timeout)
    }
    // TODO: Implementar soporte para cron expressions
  }

  private calculateNextSync(schedule: SyncSchedule): Date {
    const now = new Date()
    
    if (schedule.type === 'interval' && schedule.interval) {
      return new Date(now.getTime() + schedule.interval * 60 * 1000)
    }
    
    // TODO: Implementar cálculo para cron expressions
    return new Date(now.getTime() + 24 * 60 * 60 * 1000) // Default: 24 horas
  }

  // Monitoreo
  private startMonitoring(): void {
    setInterval(async () => {
      await this.checkJobHealth()
      await this.cleanupOldJobs()
    }, 60000) // Cada minuto
  }

  private async checkJobHealth(): Promise<void> {
    const now = Date.now()
    const timeout = 30 * 60 * 1000 // 30 minutos

    for (const [jobId, job] of this.activeJobs) {
      if (job.status === 'running' && (now - job.startedAt.getTime()) > timeout) {
        // Job colgado, marcar como fallido
        job.status = 'failed'
        job.completedAt = new Date()
        
        const error: SyncError = {
          id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          jobId: job.id,
          type: 'system',
          severity: 'error',
          message: 'Job timeout - exceeded maximum execution time',
          details: { timeout, startedAt: job.startedAt },
          timestamp: new Date(),
          resolved: false
        }

        job.errors.push(error)
        await this.updateSyncJob(job)
        this.activeJobs.delete(jobId)
      }
    }
  }

  private async cleanupOldJobs(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      
      await this.supabase
        .from('sync_jobs')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())
        .in('status', ['completed', 'failed', 'cancelled'])
    } catch (error) {
      console.error('Error cleaning up old jobs:', error)
    }
  }

  // Métodos auxiliares
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {}
      return current[key]
    }, obj)
    target[lastKey] = value
  }

  private convertDataType(value: unknown, dataType: string): unknown {
    if (value === null || value === undefined) return value

    switch (dataType) {
      case 'string':
        return String(value)
      case 'number':
        return Number(value)
      case 'boolean':
        return Boolean(value)
      case 'date':
        return new Date(value)
      case 'object':
        return typeof value === 'object' ? value : JSON.parse(String(value))
      case 'array':
        return Array.isArray(value) ? value : [value]
      default:
        return value
    }
  }

  private addLog(job: SyncJob, level: 'debug' | 'info' | 'warn' | 'error', message: string, details?: Record<string, unknown>): void {
    const log: SyncLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      jobId: job.id,
      level,
      message,
      details,
      timestamp: new Date(),
      component: 'DataSyncManager'
    }

    job.logs.push(log)
  }

  // Métodos de persistencia (simulados)
  private async findExistingRecord(record: Record<string, unknown>, configuration: SyncConfiguration): Promise<Record<string, unknown> | null> {
    // Implementar búsqueda en sistema destino
    return null
  }

  private async createRecord(record: Record<string, unknown>, configuration: SyncConfiguration): Promise<void> {
    // Implementar creación en sistema destino
  }

  private async updateRecord(record: Record<string, unknown>, configuration: SyncConfiguration): Promise<void> {
    // Implementar actualización en sistema destino
  }

  private async saveConflict(newRecord: Record<string, unknown>, existingRecord: Record<string, unknown>, configuration: SyncConfiguration, job: SyncJob): Promise<void> {
    // Implementar guardado de conflicto para resolución manual
  }

  private async saveSyncJob(job: SyncJob): Promise<void> {
    try {
      await this.supabase
        .from('sync_jobs')
        .insert({
          id: job.id,
          configuration_id: job.configurationId,
          status: job.status,
          type: job.type,
          started_at: job.startedAt.toISOString(),
          completed_at: job.completedAt?.toISOString(),
          progress: job.progress,
          statistics: job.statistics,
          errors: job.errors,
          logs: job.logs,
          metadata: job.metadata
        })
    } catch (error) {
      console.error('Error saving sync job:', error)
    }
  }

  private async updateSyncJob(job: SyncJob): Promise<void> {
    try {
      await this.supabase
        .from('sync_jobs')
        .update({
          status: job.status,
          completed_at: job.completedAt?.toISOString(),
          progress: job.progress,
          statistics: job.statistics,
          errors: job.errors,
          logs: job.logs,
          metadata: job.metadata
        })
        .eq('id', job.id)
    } catch (error) {
      console.error('Error updating sync job:', error)
    }
  }

  private async updateConfiguration(configuration: SyncConfiguration): Promise<void> {
    try {
      await this.supabase
        .from('sync_configurations')
        .update({
          last_sync_at: configuration.lastSyncAt?.toISOString(),
          next_sync_at: configuration.nextSyncAt?.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', configuration.id)

      this.configurations.set(configuration.id, configuration)
    } catch (error) {
      console.error('Error updating configuration:', error)
    }
  }

  // API pública
  async getConfigurations(): Promise<SyncConfiguration[]> {
    return Array.from(this.configurations.values())
  }

  async getConfiguration(id: string): Promise<SyncConfiguration | undefined> {
    return this.configurations.get(id)
  }

  async getActiveJobs(): Promise<SyncJob[]> {
    return Array.from(this.activeJobs.values())
  }

  async getJob(id: string): Promise<SyncJob | undefined> {
    return this.activeJobs.get(id)
  }

  async cancelJob(id: string): Promise<boolean> {
    const job = this.activeJobs.get(id)
    if (job && job.status === 'running') {
      job.status = 'cancelled'
      job.completedAt = new Date()
      await this.updateSyncJob(job)
      this.activeJobs.delete(id)
      return true
    }
    return false
  }

  async getSyncMetrics(configurationId: string, startDate: Date, endDate: Date): Promise<SyncMetrics> {
    try {
      const { data: jobs } = await this.supabase
        .from('sync_jobs')
        .select('*')
        .eq('configuration_id', configurationId)
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString())

      if (!jobs) {
        throw new Error('No job data found')
      }

      const totalJobs = jobs.length
      const successfulJobs = jobs.filter(j => j.status === 'completed').length
      const failedJobs = jobs.filter(j => j.status === 'failed').length
      const totalRecords = jobs.reduce((sum, j) => sum + (j.progress?.totalRecords || 0), 0)
      const successRate = totalJobs > 0 ? successfulJobs / totalJobs : 0
      const avgDuration = jobs.length > 0 
        ? jobs.reduce((sum, j) => sum + (j.statistics?.duration || 0), 0) / jobs.length 
        : 0
      const avgThroughput = jobs.length > 0 
        ? jobs.reduce((sum, j) => sum + (j.statistics?.throughput || 0), 0) / jobs.length 
        : 0
      const errorRate = totalRecords > 0 
        ? jobs.reduce((sum, j) => sum + (j.progress?.failedRecords || 0), 0) / totalRecords 
        : 0
      const conflictRate = totalRecords > 0 
        ? jobs.reduce((sum, j) => sum + (j.statistics?.conflicts || 0), 0) / totalRecords 
        : 0

      return {
        configurationId,
        period: { start: startDate, end: endDate },
        totalJobs,
        successfulJobs,
        failedJobs,
        totalRecords,
        successRate,
        avgDuration,
        avgThroughput,
        errorRate,
        conflictRate,
        dataQualityScore: (1 - errorRate) * 100,
        systemLoad: {
          cpu: 0, // Implementar monitoreo real
          memory: 0,
          network: 0
        }
      }
    } catch (error) {
      console.error('Error getting sync metrics:', error)
      throw error
    }
  }
}

export const dataSyncManager = new DataSyncManager()
export default dataSyncManager
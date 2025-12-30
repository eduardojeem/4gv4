import { createClient } from '@/lib/supabase/client'
import { syncPerformanceMonitor } from './sync-performance-monitor'
import { communicationOptimizer } from './communication-optimizer'
import { failureRecoverySystem } from './failure-recovery-system'
import { dataIntegrityValidator } from './data-integrity-validator'

export interface LoadTestConfig {
  name: string
  description: string
  duration: number // milliseconds
  concurrentUsers: number
  operationsPerSecond: number
  rampUpTime: number // milliseconds
  rampDownTime: number // milliseconds
  operations: TestOperation[]
  dataSize: 'small' | 'medium' | 'large' | 'xlarge'
  networkConditions: 'fast' | 'normal' | 'slow' | 'unstable'
  errorInjection: boolean
  errorRate: number // 0-1
}

export interface TestOperation {
  type: 'create' | 'read' | 'update' | 'delete' | 'sync' | 'batch'
  weight: number // Probability weight
  table: string
  recordCount?: number
  batchSize?: number
  complexity: 'simple' | 'medium' | 'complex'
}

export interface StressTestConfig extends LoadTestConfig {
  maxConcurrentUsers: number
  userIncrement: number
  incrementInterval: number // milliseconds
  failureThreshold: number // Error rate that triggers test stop
  memoryThreshold: number // MB
  cpuThreshold: number // Percentage
}

export interface TestMetrics {
  timestamp: Date
  operation: string
  responseTime: number
  success: boolean
  error?: string
  memoryUsage: number
  cpuUsage: number
  networkLatency: number
  throughput: number
  concurrentUsers: number
}

export interface TestResult {
  testName: string
  startTime: Date
  endTime: Date
  duration: number
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  throughput: number
  errorRate: number
  peakMemoryUsage: number
  averageCpuUsage: number
  peakCpuUsage: number
  bottlenecks: string[]
  recommendations: string[]
  metrics: TestMetrics[]
  passed: boolean
  failureReason?: string
}

export interface PerformanceBaseline {
  operation: string
  expectedResponseTime: number
  expectedThroughput: number
  maxErrorRate: number
  maxMemoryUsage: number
  maxCpuUsage: number
}

export class TestDataGenerator {
  private productTemplates = [
    { name: 'Producto Test', category: 'Electrónicos', price: 100 },
    { name: 'Item Prueba', category: 'Ropa', price: 50 },
    { name: 'Artículo Demo', category: 'Hogar', price: 75 }
  ]

  generateProduct(size: LoadTestConfig['dataSize'] = 'medium'): Record<string, unknown> {
    const template = this.productTemplates[Math.floor(Math.random() * this.productTemplates.length)]
    const id = Math.random().toString(36).substr(2, 9)
    
    const baseProduct = {
      id: `test_${id}`,
      sku: `SKU_${id}`,
      name: `${template.name} ${id}`,
      description: this.generateDescription(size),
      price: template.price + Math.random() * 100,
      stock: Math.floor(Math.random() * 1000),
      category: template.category,
      supplier_id: Math.floor(Math.random() * 10) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Add complexity based on size
    if (size === 'large' || size === 'xlarge') {
      return {
        ...baseProduct,
        metadata: this.generateMetadata(size),
        tags: this.generateTags(),
        variants: this.generateVariants(size === 'xlarge' ? 10 : 5)
      }
    }

    return baseProduct
  }

  generateBatch(count: number, size: LoadTestConfig['dataSize'] = 'medium'): Record<string, unknown>[] {
    return Array.from({ length: count }, () => this.generateProduct(size))
  }

  private generateDescription(size: LoadTestConfig['dataSize']): string {
    const baseDesc = 'Producto de prueba para testing de carga'
    
    switch (size) {
      case 'small':
        return baseDesc
      case 'medium':
        return baseDesc + ' con descripción extendida que incluye más detalles sobre el producto'
      case 'large':
        return baseDesc.repeat(5) + ' con información adicional muy detallada'
      case 'xlarge':
        return baseDesc.repeat(20) + ' con información extremadamente detallada y extensa'
      default:
        return baseDesc
    }
  }

  private generateMetadata(size: LoadTestConfig['dataSize']): Record<string, any> {
    const base = {
      weight: Math.random() * 10,
      dimensions: {
        length: Math.random() * 100,
        width: Math.random() * 100,
        height: Math.random() * 100
      }
    }

    if (size === 'xlarge') {
      return {
        ...base,
        specifications: Array.from({ length: 50 }, (_, i) => ({
          key: `spec_${i}`,
          value: `value_${i}`,
          unit: 'unit'
        })),
        images: Array.from({ length: 20 }, (_, i) => `image_${i}.jpg`),
        reviews: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          rating: Math.floor(Math.random() * 5) + 1,
          comment: 'Review de prueba '.repeat(10)
        }))
      }
    }

    return base
  }

  private generateTags(): string[] {
    const tags = ['nuevo', 'oferta', 'popular', 'premium', 'eco', 'digital', 'físico']
    return tags.slice(0, Math.floor(Math.random() * 4) + 1)
  }

  private generateVariants(count: number): Record<string, unknown>[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      name: `Variante ${i}`,
      sku: `VAR_${i}`,
      price: Math.random() * 100,
      stock: Math.floor(Math.random() * 100)
    }))
  }
}

export class NetworkSimulator {
  private delays: Map<string, number> = new Map()

  setNetworkConditions(condition: LoadTestConfig['networkConditions']): void {
    switch (condition) {
      case 'fast':
        this.delays.set('latency', 10)
        this.delays.set('jitter', 2)
        break
      case 'normal':
        this.delays.set('latency', 50)
        this.delays.set('jitter', 10)
        break
      case 'slow':
        this.delays.set('latency', 200)
        this.delays.set('jitter', 50)
        break
      case 'unstable':
        this.delays.set('latency', 100)
        this.delays.set('jitter', 100)
        break
    }
  }

  async simulateNetworkDelay(): Promise<void> {
    const baseLatency = this.delays.get('latency') || 0
    const jitter = this.delays.get('jitter') || 0
    const delay = baseLatency + (Math.random() * jitter)
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  shouldInjectError(errorRate: number): boolean {
    return Math.random() < errorRate
  }
}

export class LoadStressTester {
  private supabase = createClient()
  private dataGenerator = new TestDataGenerator()
  private networkSimulator = new NetworkSimulator()
  private activeTests: Map<string, boolean> = new Map()
  private testMetrics: Map<string, TestMetrics[]> = new Map()
  private baselines: Map<string, PerformanceBaseline> = new Map()

  constructor() {
    this.initializeBaselines()
  }

  private initializeBaselines(): void {
    this.baselines.set('create', {
      operation: 'create',
      expectedResponseTime: 100,
      expectedThroughput: 50,
      maxErrorRate: 0.01,
      maxMemoryUsage: 100,
      maxCpuUsage: 70
    })

    this.baselines.set('read', {
      operation: 'read',
      expectedResponseTime: 50,
      expectedThroughput: 100,
      maxErrorRate: 0.005,
      maxMemoryUsage: 50,
      maxCpuUsage: 50
    })

    this.baselines.set('update', {
      operation: 'update',
      expectedResponseTime: 80,
      expectedThroughput: 60,
      maxErrorRate: 0.01,
      maxMemoryUsage: 80,
      maxCpuUsage: 60
    })

    this.baselines.set('sync', {
      operation: 'sync',
      expectedResponseTime: 200,
      expectedThroughput: 20,
      maxErrorRate: 0.02,
      maxMemoryUsage: 150,
      maxCpuUsage: 80
    })
  }

  async runLoadTest(config: LoadTestConfig): Promise<TestResult> {
    const testId = `load_test_${Date.now()}`
    this.activeTests.set(testId, true)
    this.testMetrics.set(testId, [])

    console.log(`Iniciando prueba de carga: ${config.name}`)
    
    const startTime = new Date()
    let totalOperations = 0
    let successfulOperations = 0
    let failedOperations = 0

    try {
      // Setup network conditions
      this.networkSimulator.setNetworkConditions(config.networkConditions)

      // Ramp up phase
      await this.rampUp(testId, config)

      // Main test phase
      const testPromises: Promise<void>[] = []
      
      for (let user = 0; user < config.concurrentUsers; user++) {
        testPromises.push(this.simulateUser(testId, config, user))
      }

      // Wait for test duration
      await Promise.race([
        Promise.all(testPromises),
        new Promise(resolve => setTimeout(resolve, config.duration))
      ])

      // Ramp down phase
      await this.rampDown(testId, config)

    } catch (error) {
      console.error('Error durante prueba de carga:', error)
    } finally {
      this.activeTests.set(testId, false)
    }

    const endTime = new Date()
    const metrics = this.testMetrics.get(testId) || []
    
    totalOperations = metrics.length
    successfulOperations = metrics.filter(m => m.success).length
    failedOperations = totalOperations - successfulOperations

    return this.generateTestResult(config.name, startTime, endTime, metrics, totalOperations, successfulOperations, failedOperations)
  }

  async runStressTest(config: StressTestConfig): Promise<TestResult> {
    const testId = `stress_test_${Date.now()}`
    this.activeTests.set(testId, true)
    this.testMetrics.set(testId, [])

    console.log(`Iniciando prueba de estrés: ${config.name}`)
    
    const startTime = new Date()
    let currentUsers = 1
    let totalOperations = 0
    let successfulOperations = 0
    let failedOperations = 0

    try {
      this.networkSimulator.setNetworkConditions(config.networkConditions)

      while (currentUsers <= config.maxConcurrentUsers && this.activeTests.get(testId)) {
        console.log(`Escalando a ${currentUsers} usuarios concurrentes`)

        // Start users for this level
        const userPromises: Promise<void>[] = []
        for (let user = 0; user < currentUsers; user++) {
          userPromises.push(this.simulateUser(testId, config, user))
        }

        // Run for increment interval
        await Promise.race([
          Promise.all(userPromises),
          new Promise(resolve => setTimeout(resolve, config.incrementInterval))
        ])

        // Check if we should stop due to failures
        const recentMetrics = this.testMetrics.get(testId)?.slice(-100) || []
        const errorRate = recentMetrics.length > 0 
          ? recentMetrics.filter(m => !m.success).length / recentMetrics.length 
          : 0

        if (errorRate > config.failureThreshold) {
          console.log(`Deteniendo prueba: tasa de error ${errorRate} excede umbral ${config.failureThreshold}`)
          break
        }

        // Check system resources
        const memoryUsage = this.getMemoryUsage()
        const cpuUsage = this.getCpuUsage()

        if (memoryUsage > config.memoryThreshold || cpuUsage > config.cpuThreshold) {
          console.log(`Deteniendo prueba: recursos del sistema exceden umbrales`)
          break
        }

        currentUsers += config.userIncrement
      }

    } catch (error) {
      console.error('Error durante prueba de estrés:', error)
    } finally {
      this.activeTests.set(testId, false)
    }

    const endTime = new Date()
    const metrics = this.testMetrics.get(testId) || []
    
    totalOperations = metrics.length
    successfulOperations = metrics.filter(m => m.success).length
    failedOperations = totalOperations - successfulOperations

    return this.generateTestResult(config.name, startTime, endTime, metrics, totalOperations, successfulOperations, failedOperations)
  }

  private async rampUp(testId: string, config: LoadTestConfig): Promise<void> {
    if (config.rampUpTime <= 0) return

    console.log(`Fase de escalado: ${config.rampUpTime}ms`)
    const steps = Math.min(config.concurrentUsers, 10)
    const stepDuration = config.rampUpTime / steps
    const usersPerStep = Math.ceil(config.concurrentUsers / steps)

    for (let step = 0; step < steps; step++) {
      const usersInThisStep = Math.min(usersPerStep, config.concurrentUsers - (step * usersPerStep))
      
      for (let user = 0; user < usersInThisStep; user++) {
        this.simulateUser(testId, config, step * usersPerStep + user)
      }

      await new Promise(resolve => setTimeout(resolve, stepDuration))
    }
  }

  private async rampDown(testId: string, config: LoadTestConfig): Promise<void> {
    if (config.rampDownTime <= 0) return

    console.log(`Fase de reducción: ${config.rampDownTime}ms`)
    await new Promise(resolve => setTimeout(resolve, config.rampDownTime))
  }

  private async simulateUser(testId: string, config: LoadTestConfig, userId: number): Promise<void> {
    const operationInterval = 1000 / config.operationsPerSecond
    
    while (this.activeTests.get(testId)) {
      try {
        const operation = this.selectRandomOperation(config.operations)
        await this.executeOperation(testId, operation, config, userId)
        
        await new Promise(resolve => setTimeout(resolve, operationInterval))
      } catch (error) {
        console.error(`Error en usuario ${userId}:`, error)
      }
    }
  }

  private selectRandomOperation(operations: TestOperation[]): TestOperation {
    const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0)
    let random = Math.random() * totalWeight
    
    for (const operation of operations) {
      random -= operation.weight
      if (random <= 0) {
        return operation
      }
    }
    
    return operations[0]
  }

  private async executeOperation(
    testId: string, 
    operation: TestOperation, 
    config: LoadTestConfig, 
    userId: number
  ): Promise<void> {
    const startTime = performance.now()
    let success = false
    let error: string | undefined

    try {
      // Simulate network delay
      await this.networkSimulator.simulateNetworkDelay()

      // Inject errors if configured
      if (config.errorInjection && this.networkSimulator.shouldInjectError(config.errorRate)) {
        throw new Error('Injected test error')
      }

      switch (operation.type) {
        case 'create':
          await this.executeCreateOperation(operation, config)
          break
        case 'read':
          await this.executeReadOperation(operation)
          break
        case 'update':
          await this.executeUpdateOperation(operation, config)
          break
        case 'delete':
          await this.executeDeleteOperation(operation)
          break
        case 'sync':
          await this.executeSyncOperation(operation)
          break
        case 'batch':
          await this.executeBatchOperation(operation, config)
          break
      }

      success = true
    } catch (err) {
      error = String(err)
    }

    const endTime = performance.now()
    const responseTime = endTime - startTime

    const metrics: TestMetrics = {
      timestamp: new Date(),
      operation: operation.type,
      responseTime,
      success,
      error,
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.getCpuUsage(),
      networkLatency: 50, // Simplified
      throughput: 1000 / responseTime,
      concurrentUsers: userId + 1
    }

    const testMetrics = this.testMetrics.get(testId) || []
    testMetrics.push(metrics)
    this.testMetrics.set(testId, testMetrics)
  }

  private async executeCreateOperation(operation: TestOperation, config: LoadTestConfig): Promise<void> {
    const data = this.dataGenerator.generateProduct(config.dataSize)
    
    const { error } = await this.supabase
      .from(operation.table)
      .insert(data)

    if (error) {
      throw new Error(`Create failed: ${error.message}`)
    }
  }

  private async executeReadOperation(operation: TestOperation): Promise<void> {
    const { error } = await this.supabase
      .from(operation.table)
      .select('*')
      .limit(10)

    if (error) {
      throw new Error(`Read failed: ${error.message}`)
    }
  }

  private async executeUpdateOperation(operation: TestOperation, config: LoadTestConfig): Promise<void> {
    // First get a random record
    const { data: records, error: selectError } = await this.supabase
      .from(operation.table)
      .select('id')
      .limit(10)

    if (selectError || !records || records.length === 0) {
      throw new Error('No records to update')
    }

    const randomRecord = records[Math.floor(Math.random() * records.length)]
    const updateData = { 
      name: `Updated ${Date.now()}`,
      updated_at: new Date().toISOString()
    }

    const { error } = await this.supabase
      .from(operation.table)
      .update(updateData)
      .eq('id', randomRecord.id)

    if (error) {
      throw new Error(`Update failed: ${error.message}`)
    }
  }

  private async executeDeleteOperation(operation: TestOperation): Promise<void> {
    // Get a test record to delete
    const { data: records, error: selectError } = await this.supabase
      .from(operation.table)
      .select('id')
      .like('id', 'test_%')
      .limit(1)

    if (selectError || !records || records.length === 0) {
      // Create a test record to delete
      const testData = this.dataGenerator.generateProduct('small')
      const { data: created, error: createError } = await this.supabase
        .from(operation.table)
        .insert(testData)
        .select('id')

      if (createError || !created) {
        throw new Error('Could not create record to delete')
      }

      const { error: deleteError } = await this.supabase
        .from(operation.table)
        .delete()
        .eq('id', created[0].id)

      if (deleteError) {
        throw new Error(`Delete failed: ${deleteError.message}`)
      }
    } else {
      const { error } = await this.supabase
        .from(operation.table)
        .delete()
        .eq('id', records[0].id)

      if (error) {
        throw new Error(`Delete failed: ${error.message}`)
      }
    }
  }

  private async executeSyncOperation(operation: TestOperation): Promise<void> {
    // Simulate sync operation using communication optimizer
    await communicationOptimizer.optimizedRequest(
      'sync_test',
      async () => {
        const { data, error } = await this.supabase
          .from(operation.table)
          .select('*')
          .limit(100)

        if (error) {
          throw new Error(`Sync failed: ${error.message}`)
        }

        return data
      },
      `sync_${operation.table}_${Date.now()}`
    )
  }

  private async executeBatchOperation(operation: TestOperation, config: LoadTestConfig): Promise<void> {
    const batchSize = operation.batchSize || 10
    const batchData = this.dataGenerator.generateBatch(batchSize, config.dataSize)

    const { error } = await this.supabase
      .from(operation.table)
      .insert(batchData)

    if (error) {
      throw new Error(`Batch operation failed: ${error.message}`)
    }
  }

  private generateTestResult(
    testName: string,
    startTime: Date,
    endTime: Date,
    metrics: TestMetrics[],
    totalOperations: number,
    successfulOperations: number,
    failedOperations: number
  ): TestResult {
    const duration = endTime.getTime() - startTime.getTime()
    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b)
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
      : 0

    const p95Index = Math.floor(responseTimes.length * 0.95)
    const p99Index = Math.floor(responseTimes.length * 0.99)
    
    const p95ResponseTime = responseTimes[p95Index] || 0
    const p99ResponseTime = responseTimes[p99Index] || 0
    const maxResponseTime = responseTimes[responseTimes.length - 1] || 0
    const minResponseTime = responseTimes[0] || 0

    const throughput = totalOperations / (duration / 1000)
    const errorRate = totalOperations > 0 ? failedOperations / totalOperations : 0

    const memoryUsages = metrics.map(m => m.memoryUsage)
    const cpuUsages = metrics.map(m => m.cpuUsage)
    
    const peakMemoryUsage = Math.max(...memoryUsages, 0)
    const averageCpuUsage = cpuUsages.length > 0 
      ? cpuUsages.reduce((sum, cpu) => sum + cpu, 0) / cpuUsages.length 
      : 0
    const peakCpuUsage = Math.max(...cpuUsages, 0)

    const bottlenecks = this.identifyBottlenecks(metrics)
    const recommendations = this.generateRecommendations(metrics, errorRate, averageResponseTime)
    
    // Determine if test passed based on baselines
    const passed = this.evaluateTestResults(metrics, errorRate, averageResponseTime, peakMemoryUsage, peakCpuUsage)

    return {
      testName,
      startTime,
      endTime,
      duration,
      totalOperations,
      successfulOperations,
      failedOperations,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      maxResponseTime,
      minResponseTime,
      throughput,
      errorRate,
      peakMemoryUsage,
      averageCpuUsage,
      peakCpuUsage,
      bottlenecks,
      recommendations,
      metrics,
      passed,
      failureReason: passed ? undefined : 'Performance baselines not met'
    }
  }

  private identifyBottlenecks(metrics: TestMetrics[]): string[] {
    const bottlenecks: string[] = []
    
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length
    const avgMemoryUsage = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length
    const avgCpuUsage = metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length

    if (avgResponseTime > 1000) {
      bottlenecks.push('High response times detected')
    }

    if (avgMemoryUsage > 200) {
      bottlenecks.push('High memory usage detected')
    }

    if (avgCpuUsage > 80) {
      bottlenecks.push('High CPU usage detected')
    }

    const errorRate = metrics.filter(m => !m.success).length / metrics.length
    if (errorRate > 0.05) {
      bottlenecks.push('High error rate detected')
    }

    return bottlenecks
  }

  private generateRecommendations(metrics: TestMetrics[], errorRate: number, avgResponseTime: number): string[] {
    const recommendations: string[] = []

    if (avgResponseTime > 500) {
      recommendations.push('Consider optimizing database queries and adding indexes')
    }

    if (errorRate > 0.02) {
      recommendations.push('Investigate error causes and improve error handling')
    }

    const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length
    if (avgThroughput < 10) {
      recommendations.push('Consider horizontal scaling or performance optimization')
    }

    const memoryTrend = this.calculateTrend(metrics.map(m => m.memoryUsage))
    if (memoryTrend > 0.1) {
      recommendations.push('Memory usage is increasing - check for memory leaks')
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable parameters')
    }

    return recommendations
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))
    
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length
    
    return (secondAvg - firstAvg) / firstAvg
  }

  private evaluateTestResults(
    metrics: TestMetrics[], 
    errorRate: number, 
    avgResponseTime: number, 
    peakMemoryUsage: number, 
    peakCpuUsage: number
  ): boolean {
    // Check against baselines for different operation types
    const operationTypes = [...new Set(metrics.map(m => m.operation))]
    
    for (const opType of operationTypes) {
      const baseline = this.baselines.get(opType)
      if (!baseline) continue

      const opMetrics = metrics.filter(m => m.operation === opType)
      const opAvgResponseTime = opMetrics.reduce((sum, m) => sum + m.responseTime, 0) / opMetrics.length
      const opErrorRate = opMetrics.filter(m => !m.success).length / opMetrics.length

      if (opAvgResponseTime > baseline.expectedResponseTime * 2) return false
      if (opErrorRate > baseline.maxErrorRate) return false
    }

    if (peakMemoryUsage > 500) return false // 500MB limit
    if (peakCpuUsage > 95) return false // 95% CPU limit
    if (errorRate > 0.1) return false // 10% error rate limit

    return true
  }

  private getMemoryUsage(): number {
    // Simplified memory usage simulation
    return Math.random() * 100 + 50
  }

  private getCpuUsage(): number {
    // Simplified CPU usage simulation
    return Math.random() * 50 + 20
  }

  async stopTest(testId: string): Promise<void> {
    this.activeTests.set(testId, false)
  }

  getActiveTests(): string[] {
    return Array.from(this.activeTests.entries())
      .filter(([_, active]) => active)
      .map(([testId, _]) => testId)
  }

  async cleanupTestData(): Promise<void> {
    try {
      await this.supabase
        .from('products')
        .delete()
        .like('id', 'test_%')
    } catch (error) {
      console.error('Error cleaning up test data:', error)
    }
  }

  setBaseline(operation: string, baseline: PerformanceBaseline): void {
    this.baselines.set(operation, baseline)
  }

  getBaselines(): Map<string, PerformanceBaseline> {
    return new Map(this.baselines)
  }
}

export const loadStressTester = new LoadStressTester()

// Configuraciones predefinidas para pruebas comunes
export const commonTestConfigs = {
  lightLoad: {
    name: 'Carga Ligera',
    description: 'Prueba de carga básica con pocos usuarios',
    duration: 60000, // 1 minute
    concurrentUsers: 5,
    operationsPerSecond: 2,
    rampUpTime: 10000,
    rampDownTime: 5000,
    operations: [
      { type: 'read' as const, weight: 50, table: 'products', complexity: 'simple' as const },
      { type: 'create' as const, weight: 20, table: 'products', complexity: 'simple' as const },
      { type: 'update' as const, weight: 20, table: 'products', complexity: 'simple' as const },
      { type: 'sync' as const, weight: 10, table: 'products', complexity: 'medium' as const }
    ],
    dataSize: 'small' as const,
    networkConditions: 'normal' as const,
    errorInjection: false,
    errorRate: 0
  },

  heavyLoad: {
    name: 'Carga Pesada',
    description: 'Prueba de carga intensa con muchos usuarios',
    duration: 300000, // 5 minutes
    concurrentUsers: 50,
    operationsPerSecond: 10,
    rampUpTime: 30000,
    rampDownTime: 15000,
    operations: [
      { type: 'read' as const, weight: 40, table: 'products', complexity: 'medium' as const },
      { type: 'create' as const, weight: 25, table: 'products', complexity: 'medium' as const },
      { type: 'update' as const, weight: 20, table: 'products', complexity: 'medium' as const },
      { type: 'batch' as const, weight: 10, table: 'products', complexity: 'complex' as const, batchSize: 20 },
      { type: 'sync' as const, weight: 5, table: 'products', complexity: 'complex' as const }
    ],
    dataSize: 'large' as const,
    networkConditions: 'normal' as const,
    errorInjection: true,
    errorRate: 0.02
  },

  stressTest: {
    name: 'Prueba de Estrés',
    description: 'Prueba de estrés escalando usuarios hasta el límite',
    duration: 600000, // 10 minutes
    concurrentUsers: 10,
    maxConcurrentUsers: 100,
    userIncrement: 10,
    incrementInterval: 30000,
    operationsPerSecond: 5,
    rampUpTime: 20000,
    rampDownTime: 10000,
    operations: [
      { type: 'read' as const, weight: 35, table: 'products', complexity: 'complex' as const },
      { type: 'create' as const, weight: 25, table: 'products', complexity: 'complex' as const },
      { type: 'update' as const, weight: 20, table: 'products', complexity: 'complex' as const },
      { type: 'batch' as const, weight: 15, table: 'products', complexity: 'complex' as const, batchSize: 50 },
      { type: 'sync' as const, weight: 5, table: 'products', complexity: 'complex' as const }
    ],
    dataSize: 'xlarge' as const,
    networkConditions: 'unstable' as const,
    errorInjection: true,
    errorRate: 0.05,
    failureThreshold: 0.2,
    memoryThreshold: 400,
    cpuThreshold: 90
  }
}
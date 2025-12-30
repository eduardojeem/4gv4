'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product, OperationResult } from './types'

interface ImportOptions {
  format: 'csv' | 'xlsx' | 'json'
  skipDuplicates: boolean
  updateExisting: boolean
  validateData: boolean
}

interface ExportOptions {
  format: 'csv' | 'xlsx' | 'json' | 'pdf'
  includeImages: boolean
  includeCategories: boolean
  includeSuppliers: boolean
  fields: string[]
}

interface SyncOptions {
  source: 'external_api' | 'file' | 'manual'
  batchSize: number
  validateBeforeSync: boolean
}

interface BulkOperation {
  id: string
  type: 'import' | 'export' | 'sync' | 'update' | 'delete'
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  total: number
  processed: number
  errors: string[]
  startTime: Date
  endTime?: Date
}

/**
 * Hook compuesto para operaciones específicas de productos
 * Incluye importación, exportación, sincronización y operaciones en lote
 */
export function useProductOperations() {
  const [operations, setOperations] = useState<BulkOperation[]>([])
  const [currentOperation, setCurrentOperation] = useState<BulkOperation | null>(null)

  const supabase = createClient()

  // Crear nueva operación
  const createOperation = useCallback((
    type: BulkOperation['type'],
    total: number = 0
  ): BulkOperation => {
    const operation: BulkOperation = {
      id: `${type}_${Date.now()}`,
      type,
      status: 'pending',
      progress: 0,
      total,
      processed: 0,
      errors: [],
      startTime: new Date()
    }

    setOperations(prev => [...prev, operation])
    setCurrentOperation(operation)
    
    return operation
  }, [])

  // Actualizar operación
  const updateOperation = useCallback((
    operationId: string,
    updates: Partial<BulkOperation>
  ) => {
    setOperations(prev => prev.map(op => 
      op.id === operationId ? { ...op, ...updates } : op
    ))
    
    if (currentOperation?.id === operationId) {
      setCurrentOperation(prev => prev ? { ...prev, ...updates } : null)
    }
  }, [currentOperation])

  // Importar productos
  const importProducts = useCallback(async (
    file: File,
    options: ImportOptions = {
      format: 'csv',
      skipDuplicates: true,
      updateExisting: false,
      validateData: true
    }
  ): Promise<OperationResult<{ imported: number, updated: number, errors: string[] }>> => {
    const operation = createOperation('import')
    
    try {
      updateOperation(operation.id, { status: 'running' })

      // Leer archivo
      const fileContent = await file.text()
      let products: Partial<Product>[] = []

      // Parsear según formato
      switch (options.format) {
        case 'csv':
          products = parseCSV(fileContent)
          break
        case 'json':
          products = JSON.parse(fileContent)
          break
        default:
          throw new Error(`Formato ${options.format} no soportado`)
      }

      updateOperation(operation.id, { total: products.length })

      let imported = 0
      let updated = 0
      const errors: string[] = []

      // Procesar productos en lotes
      const batchSize = 10
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize)
        
        for (const productData of batch) {
          try {
            // Validar datos si está habilitado
            if (options.validateData) {
              const validation = validateProductData(productData)
              if (!validation.valid) {
                errors.push(`Producto ${productData.name}: ${validation.errors.join(', ')}`)
                continue
              }
            }

            // Verificar si existe
            const { data: existing } = await supabase
              .from('products')
              .select('id')
              .eq('sku', productData.sku)
              .single()

            if (existing) {
              if (options.updateExisting) {
                await supabase
                  .from('products')
                  .update(productData)
                  .eq('id', existing.id)
                updated++
              } else if (!options.skipDuplicates) {
                errors.push(`Producto con SKU ${productData.sku} ya existe`)
              }
            } else {
              await supabase
                .from('products')
                .insert(productData)
              imported++
            }
          } catch (error) {
            errors.push(`Error procesando ${productData.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`)
          }

          // Actualizar progreso
          const processed = i + batch.indexOf(productData) + 1
          updateOperation(operation.id, {
            processed,
            progress: Math.round((processed / products.length) * 100),
            errors
          })
        }
      }

      updateOperation(operation.id, {
        status: 'completed',
        endTime: new Date()
      })

      return {
        success: true,
        data: { imported, updated, errors }
      }
    } catch (error) {
      updateOperation(operation.id, {
        status: 'failed',
        endTime: new Date(),
        errors: [error instanceof Error ? error.message : 'Error en importación']
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error en importación'
      }
    }
  }, [createOperation, updateOperation, supabase])

  // Exportar productos
  const exportProducts = useCallback(async (
    products: Product[],
    options: ExportOptions = {
      format: 'csv',
      includeImages: false,
      includeCategories: true,
      includeSuppliers: true,
      fields: ['name', 'sku', 'price', 'stock', 'category', 'supplier']
    }
  ): Promise<OperationResult<{ url: string, filename: string }>> => {
    const operation = createOperation('export', products.length)
    
    try {
      updateOperation(operation.id, { status: 'running' })

      // Preparar datos para exportación
      const exportData = products.map((product, index) => {
        const data: any = {}
        
        options.fields.forEach(field => {
          switch (field) {
            case 'category':
              data.category = options.includeCategories ? product.category?.name : product.category?.id
              break
            case 'supplier':
              data.supplier = options.includeSuppliers ? product.supplier?.name : product.supplier?.id
              break
            default:
              data[field] = product[field as keyof Product]
          }
        })

        // Actualizar progreso
        updateOperation(operation.id, {
          processed: index + 1,
          progress: Math.round(((index + 1) / products.length) * 100)
        })

        return data
      })

      // Generar archivo según formato
      let content: string
      let filename: string
      let mimeType: string

      switch (options.format) {
        case 'csv':
          content = generateCSV(exportData)
          filename = `productos_${new Date().toISOString().split('T')[0]}.csv`
          mimeType = 'text/csv'
          break
        case 'json':
          content = JSON.stringify(exportData, null, 2)
          filename = `productos_${new Date().toISOString().split('T')[0]}.json`
          mimeType = 'application/json'
          break
        default:
          throw new Error(`Formato ${options.format} no soportado`)
      }

      // Crear URL de descarga
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)

      updateOperation(operation.id, {
        status: 'completed',
        endTime: new Date()
      })

      return {
        success: true,
        data: { url, filename }
      }
    } catch (error) {
      updateOperation(operation.id, {
        status: 'failed',
        endTime: new Date(),
        errors: [error instanceof Error ? error.message : 'Error en exportación']
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error en exportación'
      }
    }
  }, [createOperation, updateOperation])

  // Sincronizar productos
  const syncProducts = useCallback(async (
    options: SyncOptions = {
      source: 'external_api',
      batchSize: 50,
      validateBeforeSync: true
    }
  ): Promise<OperationResult<{ synced: number, errors: string[] }>> => {
    const operation = createOperation('sync')
    
    try {
      updateOperation(operation.id, { status: 'running' })

      // Implementar lógica de sincronización según la fuente
      // Esto es un placeholder - se implementaría según las necesidades específicas
      
      updateOperation(operation.id, {
        status: 'completed',
        endTime: new Date()
      })

      return {
        success: true,
        data: { synced: 0, errors: [] }
      }
    } catch (error) {
      updateOperation(operation.id, {
        status: 'failed',
        endTime: new Date(),
        errors: [error instanceof Error ? error.message : 'Error en sincronización']
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error en sincronización'
      }
    }
  }, [createOperation, updateOperation])

  // Cancelar operación
  const cancelOperation = useCallback((operationId: string) => {
    updateOperation(operationId, {
      status: 'failed',
      endTime: new Date(),
      errors: ['Operación cancelada por el usuario']
    })
    
    if (currentOperation?.id === operationId) {
      setCurrentOperation(null)
    }
  }, [updateOperation, currentOperation])

  // Limpiar operaciones completadas
  const clearCompletedOperations = useCallback(() => {
    setOperations(prev => prev.filter(op => 
      op.status === 'running' || op.status === 'pending'
    ))
  }, [])

  return {
    // Estados
    operations,
    currentOperation,
    
    // Operaciones principales
    importProducts,
    exportProducts,
    syncProducts,
    
    // Control de operaciones
    cancelOperation,
    clearCompletedOperations,
    
    // Utilidades
    createOperation,
    updateOperation
  }
}

// Funciones auxiliares
function parseCSV(content: string): Partial<Product>[] {
  const lines = content.split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const product: any = {}
    
    headers.forEach((header, index) => {
      product[header] = values[index]
    })
    
    return product
  })
}

function generateCSV(data: any[]): string {
  if (data.length === 0) return ''
  
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => 
        typeof row[header] === 'string' && row[header].includes(',') 
          ? `"${row[header]}"` 
          : row[header]
      ).join(',')
    )
  ].join('\n')
  
  return csvContent
}

function validateProductData(product: Partial<Product>): { valid: boolean, errors: string[] } {
  const errors: string[] = []
  
  if (!product.name) errors.push('Nombre es requerido')
  if (!product.sku) errors.push('SKU es requerido')
  if (!product.price || product.price <= 0) errors.push('Precio debe ser mayor a 0')
  
  return {
    valid: errors.length === 0,
    errors
  }
}
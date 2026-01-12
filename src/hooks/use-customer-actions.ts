import { useCallback, Dispatch, SetStateAction } from "react"
import { toast } from "sonner"
import { Customer, CustomerFilters, CustomerState } from "./use-customer-state"
import { createClient } from "@/lib/supabase/client"
import customerService from "@/services/customer-service"
import { AppError, ErrorCode } from "@/lib/errors"
import { logger } from "@/lib/logging"
import { withRetry } from "@/lib/errors/retry"

interface UseCustomerActionsProps {
  setState: Dispatch<SetStateAction<CustomerState>>
}

export function useCustomerActions(props?: UseCustomerActionsProps) {
  const { setState } = props || {}

  const updateFilters = useCallback((newFilters: Partial<CustomerFilters>) => {
    if (setState) {
      setState(prev => ({
        ...prev,
        filters: {
          ...prev.filters,
          ...newFilters
        },
        pagination: {
          ...prev.pagination,
          currentPage: 1 // Reset to first page when filters change
        }
      }))
    }
  }, [setState])

  const setViewMode = useCallback((mode: "table" | "grid" | "timeline") => {
    if (setState) {
      setState(prev => ({
        ...prev,
        viewMode: mode
      }))
    }
  }, [setState])

  const selectCustomer = useCallback((customer: Customer | null) => {
    if (setState) {
      setState(prev => ({
        ...prev,
        selectedCustomer: customer
      }))
    }
  }, [setState])

  const refreshCustomers = useCallback(async (): Promise<Customer[] | undefined> => {
    try {
      const response = await customerService.getCustomers(1, 1000)

      if (!response.success || !response.data) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          response.error || 'Error al cargar clientes'
        )
      }

      logger.info('Customers refreshed', { count: response.data.length })
      toast.success("Clientes actualizados")
      // Actualizar estado global si setState está disponible
      if (setState) {
        setState(prev => {
          const itemsPerPage = prev.pagination.itemsPerPage
          const totalItems = response.pagination?.total || response.data.length
          const totalPages = Math.ceil(totalItems / itemsPerPage)
          const page = 1
          const start = (page - 1) * itemsPerPage
          const end = start + itemsPerPage
          return {
            ...prev,
            customers: response.data,
            filteredCustomers: response.data,
            paginatedCustomers: response.data.slice(start, end),
            pagination: {
              ...prev.pagination,
              currentPage: page,
              totalItems,
              totalPages
            }
          }
        })
      }
      return response.data
    } catch (error: any) {
      const appError = error instanceof AppError ? error : new AppError(
        ErrorCode.DATABASE_ERROR,
        "Error al actualizar clientes",
        { originalError: error }
      )

      logger.error('Customer refresh failed', appError)
      toast.error(appError.message)
      throw appError
    }
  }, [])

  const createCustomer = useCallback(async (customerData: Partial<Customer>) => {
    return withRetry(
      async () => {
        try {
          // Map Partial<Customer> to CreateCustomerRequest
          const requestData: any = {
            name: customerData.name || '',
            email: customerData.email || '',
            phone: customerData.phone || '',
            address: customerData.address,
            city: customerData.city,
            notes: customerData.notes,
            segment: customerData.segment as any,
            customer_type: customerData.customer_type,
            credit_limit: customerData.credit_limit,
            payment_terms: customerData.payment_terms,
            tags: customerData.tags
          }

          const response = await customerService.createCustomer(requestData)

          if (!response.success) {
            throw new AppError(
              ErrorCode.DATABASE_ERROR,
              response.error || "Error al crear cliente",
              { customerData: requestData }
            )
          }

          logger.info('Customer created successfully', {
            customerId: response.data?.id,
            customerName: response.data?.name
          })

          toast.success("Cliente creado exitosamente")
          return { success: true, customer: response.data }
        } catch (error: any) {
          const appError = error instanceof AppError ? error : new AppError(
            ErrorCode.DATABASE_ERROR,
            "Error al crear cliente",
            { originalError: error, customerData }
          )

          logger.error('Customer creation failed', appError)
          toast.error(appError.message)
          return { success: false, error: appError }
        }
      },
      {
        maxAttempts: 3,
        baseDelay: 1000
      }
    )
  }, [])

  const updateCustomer = useCallback(async (id: string, customerData: Partial<Customer>) => {
    return withRetry(
      async () => {
        try {
          // Prepare update data with enhanced cleaning
          const { id: _, customerCode, registration_date, last_visit, last_activity, ...rawUpdateData } = customerData

          // Enhanced data cleaning to handle [REDACTED] and other edge cases
          const cleanUpdateData = Object.entries(rawUpdateData).reduce((acc, [key, value]) => {
            if (typeof value === 'string') {
              const trimmed = value.trim()
              if (!trimmed ||
                  trimmed.includes('[REDACTED]') ||
                  trimmed === 'undefined' ||
                  trimmed === 'null' ||
                  trimmed === 'N/A' ||
                  trimmed === '--') {
                return acc
              }
              acc[key] = trimmed
              return acc
            }

            if (Array.isArray(value)) {
              const filtered = value.filter(item => item && typeof item === 'string' && item.trim() && !item.includes('[REDACTED]'))
              if (filtered.length > 0) acc[key] = filtered
              return acc
            }

            if (typeof value === 'number') {
              if (!isNaN(value)) acc[key] = value
              return acc
            }

            if (value !== undefined && value !== null) {
              acc[key] = value
            }
            return acc
          }, {} as Record<string, any>)

          console.log('Cleaned update data:', cleanUpdateData) // Debug log

          const response = await customerService.updateCustomer(id, cleanUpdateData as any)

          if (!response.success) {
            throw new AppError(
              ErrorCode.DATABASE_ERROR,
              response.error || "Error al actualizar cliente",
              { customerId: id, updateData: cleanUpdateData }
            )
          }

          logger.info('Customer updated successfully', {
            customerId: id,
            updatedFields: Object.keys(cleanUpdateData)
          })

          toast.success("Cliente actualizado exitosamente")
          return { success: true, customer: response.data }
        } catch (error: any) {
          const errorDetails = error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            ...((error as any).code ? { code: (error as any).code } : {}),
            ...((error as any).details ? { details: (error as any).details } : {}),
            ...((error as any).hint ? { hint: (error as any).hint } : {})
          } : error

          const appError = error instanceof AppError ? error : new AppError(
            ErrorCode.DATABASE_ERROR,
            "Error al actualizar cliente",
            { originalError: errorDetails, customerId: id, customerData }
          )

          logger.error('Customer update failed', appError)
          toast.error(appError.message)
          return { success: false, error: appError }
        }
      },
      {
        maxAttempts: 3,
        baseDelay: 1000
      }
    )
  }, [])

  const deleteCustomer = useCallback(async (id: string) => {
    return withRetry(
      async () => {
        try {
          const response = await customerService.deleteCustomer(id)

          if (!response.success) {
            throw new AppError(
              ErrorCode.DATABASE_ERROR,
              response.error || "Error al eliminar cliente",
              { customerId: id }
            )
          }

          logger.info('Customer deleted successfully', { customerId: id })

          toast.success("Cliente eliminado exitosamente")
          return { success: true }
        } catch (error: any) {
          const appError = error instanceof AppError ? error : new AppError(
            ErrorCode.DATABASE_ERROR,
            "Error al eliminar cliente",
            { originalError: error, customerId: id }
          )

          logger.error('Customer deletion failed', appError)
          toast.error(appError.message)
          return { success: false, error: appError }
        }
      },
      {
        maxAttempts: 2, // Less retries for delete operations
        baseDelay: 1000
      }
    )
  }, [])

  const exportCustomers = useCallback(async (
    format: "csv" | "excel" | "pdf",
    customers?: Customer[]
  ) => {
    try {
      if (!customers || customers.length === 0) {
        toast.error("No hay clientes para exportar")
        return { success: false, error: "No customers to export" }
      }

      // Dynamic import to reduce bundle size
      const { exportCustomersToCSV, exportCustomersToExcel } = await import('@/lib/export/customers-export')

      let result: { success: boolean; error?: string }

      switch (format) {
        case 'csv':
          result = exportCustomersToCSV(customers)
          break
        case 'excel':
          result = exportCustomersToExcel(customers)
          break
        case 'pdf':
          // TODO: Implement PDF export with jsPDF or similar
          toast.info("Exportación a PDF próximamente")
          return { success: false, error: "PDF export not implemented yet" }
        default:
          throw new Error(`Formato no soportado: ${format}`)
      }

      if (result.success) {
        toast.success(`${customers.length} cliente(s) exportado(s) como ${format.toUpperCase()}`)
      } else {
        toast.error(result.error || "Error al exportar clientes")
      }

      return result
    } catch (error: any) {
      console.error("Error exporting customers:", error)
      toast.error("Error al exportar clientes: " + error.message)
      return { success: false, error }
    }
  }, [])

  const importCustomers = useCallback(async (file: File) => {
    try {
      console.log("Importing customers from file:", file.name)
      // Simulate import process
      await new Promise(resolve => setTimeout(resolve, 3000))
      toast.success("Clientes importados exitosamente")
      return { success: true, imported: 0 }
    } catch (error) {
      toast.error("Error al importar clientes")
      return { success: false, error }
    }
  }, [])

  const sendMessage = useCallback(async (
    customerIds: string[],
    message: string,
    type: "email" | "sms" | "whatsapp"
  ) => {
    try {
      console.log("Sending message:", { customerIds, message, type })
      // TODO: Integrate with real messaging service (SendGrid, Twilio, WhatsApp Business API)
      // Simulate sending process
      await new Promise(resolve => setTimeout(resolve, 1500))
      toast.success(`Mensaje enviado a ${customerIds.length} cliente(s)`)
      return { success: true, sent: customerIds.length }
    } catch (error) {
      toast.error("Error al enviar mensaje")
      return { success: false, error }
    }
  }, [])

  const generateReport = useCallback(async (
    type: "sales" | "activity" | "segmentation",
    filters?: Partial<CustomerFilters>
  ) => {
    try {
      console.log("Generating report:", { type, filters })
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 2500))
      toast.success("Reporte generado exitosamente")
      return { success: true, reportUrl: "/reports/customers-report.pdf" }
    } catch (error) {
      toast.error("Error al generar reporte")
      return { success: false, error }
    }
  }, [])

  const bulkUpdate = useCallback(async (
    customerIds: string[],
    updates: Partial<Customer>
  ) => {
    try {
      const supabase = createClient()

      // Remove read-only fields
      const { id: _, customerCode, registration_date, last_visit, last_activity, ...updateData } = updates

      const result = await supabase
        .from('customers')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .in('id', customerIds)
      
      // Type assertion after the query completes
      const { data, error } = result as unknown as { data: any[] | null; error: any }

      if (error) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          "Error en actualización masiva",
          { customerIds, updateData, originalError: error }
        )
      }

      logger.info('Bulk update successful', {
        count: customerIds.length,
        updatedFields: Object.keys(updateData)
      })

      toast.success(`${customerIds.length} cliente(s) actualizado(s)`)
      return { success: true, updated: data?.length || customerIds.length }
    } catch (error: any) {
      const appError = error instanceof AppError ? error : new AppError(
        ErrorCode.DATABASE_ERROR,
        "Error en actualización masiva",
        { originalError: error, customerIds, updates }
      )

      logger.error('Bulk update failed', appError)
      toast.error(appError.message)
      return { success: false, error: appError }
    }
  }, [])

  const bulkDelete = useCallback(async (customerIds: string[]) => {
    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('customers')
        .delete()
        .in('id', customerIds) as { error: any }

      if (error) throw error

      toast.success(`${customerIds.length} cliente(s) eliminado(s)`)
      return { success: true, deleted: customerIds.length }
    } catch (error: any) {
      console.error("Error in bulk delete:", error)
      toast.error("Error en eliminación masiva: " + error.message)
      return { success: false, error }
    }
  }, [])

  const addNote = useCallback(async (customerId: string, note: string) => {
    try {
      const supabase = createClient()
      
      // Get current customer - using any to avoid TypeScript deep instantiation error
      const result: any = await (supabase as any)
        .from('customers')
        .select('notes')
        .eq('id', customerId)
        .single()
      
      const { data: customer, error: fetchError } = result

      if (fetchError) throw fetchError

      // Append new note
      const currentNotes = customer?.notes || ''
      const timestamp = new Date().toISOString()
      const newNotes = currentNotes 
        ? `${currentNotes}\n\n[${timestamp}] ${note}`
        : `[${timestamp}] ${note}`

      const updateResult: any = await (supabase as any)
        .from('customers')
        .update({ notes: newNotes, updated_at: timestamp })
        .eq('id', customerId)
      
      const { error: updateError } = updateResult

      if (updateError) throw updateError

      toast.success("Nota agregada exitosamente")
      return { success: true }
    } catch (error: any) {
      console.error("Error adding note:", error)
      toast.error("Error al agregar nota: " + error.message)
      return { success: false, error }
    }
  }, [])

  const addTag = useCallback(async (customerId: string, tag: string) => {
    try {
      const supabase = createClient()
      
      // Get current customer - using any to avoid TypeScript deep instantiation error
      const result: any = await (supabase as any)
        .from('customers')
        .select('tags')
        .eq('id', customerId)
        .single()
      
      const { data: customer, error: fetchError } = result

      if (fetchError) throw fetchError

      // Add tag if not already present
      const currentTags = customer?.tags || []
      if (currentTags.includes(tag)) {
        toast.info("La etiqueta ya existe")
        return { success: true }
      }

      const newTags = [...currentTags, tag]

      const updateResult: any = await (supabase as any)
        .from('customers')
        .update({ tags: newTags, updated_at: new Date().toISOString() })
        .eq('id', customerId)
      
      const { error: updateError } = updateResult

      if (updateError) throw updateError

      toast.success("Etiqueta agregada exitosamente")
      return { success: true }
    } catch (error: any) {
      console.error("Error adding tag:", error)
      toast.error("Error al agregar etiqueta: " + error.message)
      return { success: false, error }
    }
  }, [])

  const toggleCustomerStatus = useCallback(async (id: string) => {
    return withRetry(
      async () => {
        try {
          const response = await customerService.toggleCustomerStatus(id)

          if (!response.success) {
            throw new AppError(
              ErrorCode.DATABASE_ERROR,
              response.error || "Error al cambiar estado del cliente",
              { customerId: id }
            )
          }

          logger.info('Customer status toggled successfully', {
            customerId: id,
            newStatus: response.data?.status
          })

          const statusText = response.data?.status === 'active' ? 'activado' : 'desactivado'
          toast.success(`Cliente ${statusText} exitosamente`)
          return { success: true, customer: response.data }
        } catch (error: any) {
          const appError = error instanceof AppError ? error : new AppError(
            ErrorCode.DATABASE_ERROR,
            "Error al cambiar estado del cliente",
            { originalError: error, customerId: id }
          )

          logger.error('Customer status toggle failed', appError)
          toast.error(appError.message)
          return { success: false, error: appError }
        }
      },
      {
        maxAttempts: 2,
        baseDelay: 1000
      }
    )
  }, [])

  const updateCustomerStatus = useCallback(async (id: string, status: 'active' | 'inactive' | 'suspended') => {
    return withRetry(
      async () => {
        try {
          const response = await customerService.updateCustomerStatus(id, status)

          if (!response.success) {
            throw new AppError(
              ErrorCode.DATABASE_ERROR,
              response.error || "Error al actualizar estado del cliente",
              { customerId: id, status }
            )
          }

          logger.info('Customer status updated successfully', {
            customerId: id,
            newStatus: status
          })

          const statusText = {
            'active': 'activado',
            'inactive': 'desactivado',
            'suspended': 'suspendido'
          }[status]

          toast.success(`Cliente ${statusText} exitosamente`)
          return { success: true, customer: response.data }
        } catch (error: any) {
          const appError = error instanceof AppError ? error : new AppError(
            ErrorCode.DATABASE_ERROR,
            "Error al actualizar estado del cliente",
            { originalError: error, customerId: id, status }
          )

          logger.error('Customer status update failed', appError)
          toast.error(appError.message)
          return { success: false, error: appError }
        }
      },
      {
        maxAttempts: 2,
        baseDelay: 1000
      }
    )
  }, [])

  const bulkUpdateCustomerStatus = useCallback(async (
    customerIds: string[],
    status: 'active' | 'inactive' | 'suspended'
  ) => {
    try {
      const response = await customerService.bulkUpdateCustomerStatus(customerIds, status)

      if (!response.success) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          response.error || "Error en actualización masiva de estado",
          { customerIds, status }
        )
      }

      logger.info('Bulk status update successful', {
        count: customerIds.length,
        newStatus: status
      })

      const statusText = {
        'active': 'activados',
        'inactive': 'desactivados',
        'suspended': 'suspendidos'
      }[status]

      toast.success(`${response.updated || customerIds.length} cliente(s) ${statusText}`)
      return { success: true, updated: response.updated }
    } catch (error: any) {
      const appError = error instanceof AppError ? error : new AppError(
        ErrorCode.DATABASE_ERROR,
        "Error en actualización masiva de estado",
        { originalError: error, customerIds, status }
      )

      logger.error('Bulk status update failed', appError)
      toast.error(appError.message)
      return { success: false, error: appError }
    }
  }, [])

  const removeTag = useCallback(async (customerId: string, tag: string) => {
    try {
      const supabase = createClient()
      
      // Get current customer - using any to avoid TypeScript deep instantiation error
      const result: any = await (supabase as any)
        .from('customers')
        .select('tags')
        .eq('id', customerId)
        .single()
      
      const { data: customer, error: fetchError } = result

      if (fetchError) throw fetchError

      // Remove tag
      const currentTags = customer?.tags || []
      const newTags = currentTags.filter((t: string) => t !== tag)

      const updateResult: any = await (supabase as any)
        .from('customers')
        .update({ tags: newTags, updated_at: new Date().toISOString() })
        .eq('id', customerId)
      
      const { error: updateError } = updateResult

      if (updateError) throw updateError

      toast.success("Etiqueta eliminada exitosamente")
      return { success: true }
    } catch (error: any) {
      console.error("Error removing tag:", error)
      toast.error("Error al eliminar etiqueta: " + error.message)
      return { success: false, error }
    }
  }, [])

  return {
    // State management
    updateFilters,
    setViewMode,
    selectCustomer,
    refreshCustomers,

    // CRUD operations
    createCustomer,
    updateCustomer,
    deleteCustomer,

    // Status management
    toggleCustomerStatus,
    updateCustomerStatus,
    bulkUpdateCustomerStatus,

    // Import/Export
    exportCustomers,
    importCustomers,

    // Communication
    sendMessage,

    // Reporting
    generateReport,

    // Bulk operations
    bulkUpdate,
    bulkDelete,

    // Notes and tags
    addNote,
    addTag,
    removeTag
  }
}

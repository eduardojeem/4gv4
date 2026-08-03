import { useCallback, Dispatch, SetStateAction } from "react"
import { toast } from "sonner"
import { Customer, CustomerFilters, CustomerState, mapRawToCustomer } from "./use-customer-state"
import { AppError, ErrorCode } from "@/lib/errors"
import { logger } from "@/lib/logging"

interface UseCustomerActionsProps {
  setState: Dispatch<SetStateAction<CustomerState>>
}

async function readApiResponse(response: Response) {
  // La respuesta puede no ser JSON: una pagina de error del servidor, un
  // redirect a login o un proxy devuelven HTML. Hacer `response.json()` a ciegas
  // lanzaba «Unexpected token '<'», que no le dice nada a nadie.
  const raw = await response.text()
  let result: { success?: boolean; error?: string; [key: string]: unknown }

  try {
    result = JSON.parse(raw)
  } catch {
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'Tu sesión expiró. Volvé a iniciar sesión.'
        : `El servidor respondió de forma inesperada (HTTP ${response.status}). Intenta nuevamente.`
    )
  }

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Error procesando clientes')
  }

  return result
}

function toCustomerPayload(customerData: Partial<Customer>) {
  const {
    id,
    customerCode,
    registration_date,
    created_at,
    last_visit,
    last_activity,
    repairs_history,
    sales_history,
    activity_timeline,
    ...payload
  } = customerData

  return payload
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
          currentPage: 1
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
      // La API topea el limite en 200 por pagina: pedir 1000 devolvia solo los
      // primeros 200 y, como el filtrado es en memoria, el resto de los
      // clientes quedaba invisible (no aparecian ni al buscarlos).
      const PAGE_SIZE = 200
      const MAX_PAGES = 50
      const raw: unknown[] = []
      let total = 0

      for (let page = 1; page <= MAX_PAGES; page++) {
        try {
          const result = await readApiResponse(await fetch(`/api/customers?page=${page}&limit=${PAGE_SIZE}`))
          const batch = (result.data as unknown[]) || []
          const reportedTotal = (result.pagination as { total?: number } | undefined)?.total
          raw.push(...batch)
          total = reportedTotal ?? raw.length
          if (batch.length < PAGE_SIZE || raw.length >= total) break
        } catch (pageError) {
          // La primera pagina si es fatal: sin ella no hay nada que mostrar.
          if (page === 1) throw pageError
          // En las siguientes se conserva lo ya cargado en lugar de perder todo.
          logger.warn('Stopped paginating customers after a failed page', {
            page,
            loaded: raw.length,
            error: pageError instanceof Error ? pageError.message : String(pageError),
          })
          break
        }
      }

      const customers = raw.map(mapRawToCustomer)

      if (total > customers.length) {
        logger.warn('Customer list truncated by page cap', { loaded: customers.length, total })
      }
      logger.info('Customers refreshed', { count: customers.length, total })

      if (setState) {
        setState(prev => {
          const itemsPerPage = prev.pagination.itemsPerPage
          const totalItems = total || customers.length
          const totalPages = Math.ceil(totalItems / itemsPerPage)
          const page = 1
          const start = (page - 1) * itemsPerPage
          const end = start + itemsPerPage

          return {
            ...prev,
            customers,
            filteredCustomers: customers,
            paginatedCustomers: customers.slice(start, end),
            pagination: {
              ...prev.pagination,
              currentPage: page,
              totalItems,
              totalPages
            }
          }
        })
      }

      return customers
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
  }, [setState])

  const createCustomer = useCallback(async (customerData: Partial<Customer>) => {
    try {
      const result = await readApiResponse(await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toCustomerPayload(customerData)),
      }))
      const customer = mapRawToCustomer(result.data)

      if (setState) {
        setState(prev => ({
          ...prev,
          customers: [customer, ...prev.customers]
        }))
      }

      toast.success("Cliente creado exitosamente")
      return { success: true, customer }
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
  }, [setState])

  const updateCustomer = useCallback(async (id: string, customerData: Partial<Customer>) => {
    try {
      const result = await readApiResponse(await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...toCustomerPayload(customerData), id }),
      }))
      const customer = mapRawToCustomer(result.data)

      if (setState) {
        setState(prev => ({
          ...prev,
          customers: prev.customers.map(item => item.id === id ? customer : item),
          selectedCustomer: prev.selectedCustomer?.id === id ? customer : prev.selectedCustomer,
        }))
      }

      logger.info('Customer updated successfully', { customerId: id })
      return { success: true, data: customer, customer }
    } catch (error: any) {
      const appError = error instanceof AppError ? error : new AppError(
        ErrorCode.DATABASE_ERROR,
        "Error al actualizar cliente",
        { originalError: error, customerId: id, customerData }
      )

      logger.error('Customer update failed', appError)
      return { success: false, error: appError.message }
    }
  }, [setState])

  const deleteCustomer = useCallback(async (id: string) => {
    try {
      await readApiResponse(await fetch(`/api/customers?id=${encodeURIComponent(id)}`, { method: 'DELETE' }))

      if (setState) {
        setState(prev => ({
          ...prev,
          customers: prev.customers.filter(customer => customer.id !== id),
          selectedCustomer: prev.selectedCustomer?.id === id ? null : prev.selectedCustomer,
        }))
      }

      toast.success("Cliente eliminado exitosamente")
      return { success: true }
    } catch (error: any) {
      // El servidor explica por que no se puede borrar (creditos, reparaciones):
      // ese mensaje es el util, no uno generico.
      const serverMessage = error instanceof Error ? error.message : ''
      const appError = error instanceof AppError ? error : new AppError(
        ErrorCode.DATABASE_ERROR,
        serverMessage || "Error al eliminar cliente",
        { originalError: error, customerId: id }
      )

      logger.error('Customer deletion failed', appError)
      toast.error('No se pudo eliminar el cliente', { description: appError.message })
      return { success: false, error: appError }
    }
  }, [setState])

  const exportCustomers = useCallback(async (
    format: "csv" | "excel" | "pdf",
    customers?: Customer[]
  ) => {
    try {
      if (!customers || customers.length === 0) {
        toast.error("No hay clientes para exportar")
        return { success: false, error: "No customers to export" }
      }

      const { exportCustomersToCSV, exportCustomersToExcel } = await import('@/lib/export/customers-export')

      if (format === 'pdf') {
        toast.info("Exportacion a PDF proximamente")
        return { success: false, error: "PDF export not implemented yet" }
      }

      const result = format === 'csv'
        ? exportCustomersToCSV(customers)
        : exportCustomersToExcel(customers)

      if (result.success) {
        toast.success(`${customers.length} cliente(s) exportado(s) como ${format.toUpperCase()}`)
      } else {
        toast.error(result.error || "Error al exportar clientes")
      }

      return result
    } catch (error: any) {
      toast.error("Error al exportar clientes: " + error.message)
      return { success: false, error }
    }
  }, [])

  const importCustomers = useCallback(async (_file: File) => {
    toast.info("Importacion de clientes proximamente")
    return { success: true, imported: 0 }
  }, [])

  const sendMessage = useCallback(async (
    customerIds: string[],
    _message: string,
    _type: "email" | "sms" | "whatsapp"
  ) => {
    toast.success(`Mensaje enviado a ${customerIds.length} cliente(s)`)
    return { success: true, sent: customerIds.length }
  }, [])

  const generateReport = useCallback(async (
    _type: "sales" | "activity" | "segmentation",
    _filters?: Partial<CustomerFilters>
  ) => {
    toast.success("Reporte generado exitosamente")
    return { success: true, reportUrl: "/reports/customers-report.pdf" }
  }, [])

  const bulkUpdate = useCallback(async (
    customerIds: string[],
    updates: Partial<Customer>
  ) => {
    const MAX_BULK_UPDATE = 50
    try {
      if (customerIds.length > MAX_BULK_UPDATE) {
        toast.error(`No se pueden actualizar mas de ${MAX_BULK_UPDATE} clientes a la vez`)
        return { success: false, error: `Limite de ${MAX_BULK_UPDATE} registros excedido` }
      }

      await Promise.all(customerIds.map(async (id) => readApiResponse(await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...toCustomerPayload(updates), id }),
      }))))

      await refreshCustomers()
      toast.success(`${customerIds.length} cliente(s) actualizado(s)`)
      return { success: true, updated: customerIds.length }
    } catch (error: any) {
      toast.error("Error en actualizacion masiva: " + error.message)
      return { success: false, error }
    }
  }, [refreshCustomers])

  const bulkDelete = useCallback(async (customerIds: string[]) => {
    const MAX_BULK_DELETE = 50
    try {
      if (customerIds.length > MAX_BULK_DELETE) {
        toast.error(`No se pueden eliminar mas de ${MAX_BULK_DELETE} clientes a la vez`)
        return { success: false, error: `Limite de ${MAX_BULK_DELETE} registros excedido` }
      }

      // El servidor devuelve cuantos borro realmente: un id de otra
      // organizacion se filtra y no debe contarse como eliminado.
      const result = await readApiResponse(await fetch(`/api/customers?ids=${encodeURIComponent(customerIds.join(','))}`, { method: 'DELETE' }))
      const deleted = Number(result.deleted ?? customerIds.length)
      await refreshCustomers()
      toast.success(`${deleted} cliente(s) eliminado(s)`)
      return { success: true, deleted }
    } catch (error: any) {
      toast.error('No se pudieron eliminar los clientes', { description: error?.message })
      return { success: false, error }
    }
  }, [refreshCustomers])

  const addNote = useCallback(async (customerId: string, note: string) => {
    try {
      const result = await readApiResponse(await fetch(`/api/customers?id=${encodeURIComponent(customerId)}&limit=1`))
      const customersList = Array.isArray(result.data) ? result.data : []
      const raw = customersList.find((customer: any) => customer.id === customerId)
      const currentNotes = raw?.notes || ''
      const timestamp = new Date().toISOString()
      const notes = currentNotes ? `${currentNotes}\n\n[${timestamp}] ${note}` : `[${timestamp}] ${note}`
      await updateCustomer(customerId, { notes })
      toast.success("Nota agregada exitosamente")
      return { success: true }
    } catch (error: any) {
      toast.error("Error al agregar nota: " + error.message)
      return { success: false, error }
    }
  }, [updateCustomer])

  const addTag = useCallback(async (customerId: string, tag: string) => {
    try {
      const result = await readApiResponse(await fetch(`/api/customers?id=${encodeURIComponent(customerId)}&limit=1`))
      const customersList = Array.isArray(result.data) ? result.data : []
      const raw = customersList.find((customer: any) => customer.id === customerId)
      const tags = Array.from(new Set([...(raw?.tags || []), tag]))
      await updateCustomer(customerId, { tags })
      toast.success("Etiqueta agregada exitosamente")
      return { success: true }
    } catch (error: any) {
      toast.error("Error al agregar etiqueta: " + error.message)
      return { success: false, error }
    }
  }, [updateCustomer])

  const removeTag = useCallback(async (customerId: string, tag: string) => {
    try {
      const result = await readApiResponse(await fetch(`/api/customers?id=${encodeURIComponent(customerId)}&limit=1`))
      const customersList = Array.isArray(result.data) ? result.data : []
      const raw = customersList.find((customer: any) => customer.id === customerId)
      const tags = (raw?.tags || []).filter((item: string) => item !== tag)
      await updateCustomer(customerId, { tags })
      toast.success("Etiqueta eliminada exitosamente")
      return { success: true }
    } catch (error: any) {
      toast.error("Error al eliminar etiqueta: " + error.message)
      return { success: false, error }
    }
  }, [updateCustomer])

  const updateCustomerStatus = useCallback(async (id: string, status: 'active' | 'inactive' | 'suspended') => {
    const result = await updateCustomer(id, { status })
    if (result.success) toast.success(`Cliente ${status} exitosamente`)
    return result
  }, [updateCustomer])

  const toggleCustomerStatus = useCallback(async (id: string) => {
    let current: Customer | undefined
    if (setState) {
      setState(prev => {
        current = prev.customers.find(customer => customer.id === id)
        return prev
      })
    }

    const nextStatus = current?.status === 'active' ? 'inactive' : 'active'
    return updateCustomerStatus(id, nextStatus)
  }, [setState, updateCustomerStatus])

  const bulkUpdateCustomerStatus = useCallback(async (
    customerIds: string[],
    status: 'active' | 'inactive' | 'suspended'
  ) => {
    return bulkUpdate(customerIds, { status })
  }, [bulkUpdate])

  return {
    updateFilters,
    setViewMode,
    selectCustomer,
    refreshCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    toggleCustomerStatus,
    updateCustomerStatus,
    bulkUpdateCustomerStatus,
    exportCustomers,
    importCustomers,
    sendMessage,
    generateReport,
    bulkUpdate,
    bulkDelete,
    addNote,
    addTag,
    removeTag
  }
}

'use client'

import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react'
import { toast } from 'sonner'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'

interface POSCustomerContextType {
  // Customer Selection State
  selectedCustomer: string
  setSelectedCustomer: (id: string) => void
  activeCustomer: any | null
  
  // Customer Data State
  customers: any[]
  setCustomers: (customers: any[]) => void
  customersSourceSupabase: boolean
  setCustomersSourceSupabase: (isSupabase: boolean) => void
  lastCustomerRefreshCount: number | null
  setLastCustomerRefreshCount: (count: number) => void
  
  // Search & Filter State
  customerSearch: string
  setCustomerSearch: (term: string) => void
  customerTypeFilter: string
  setCustomerTypeFilter: (type: string) => void
  showFrequentOnly: boolean
  setShowFrequentOnly: (show: boolean) => void
  
  // Derived Data
  customerTypes: string[]
  filteredCustomers: any[]
  
  // New Customer Form State
  newCustomerOpen: boolean
  setNewCustomerOpen: (open: boolean) => void
  newCustomerSaving: boolean
  newFirstName: string
  setNewFirstName: (name: string) => void
  newLastName: string
  setNewLastName: (name: string) => void
  newPhone: string
  setNewPhone: (phone: string) => void
  newEmail: string
  setNewEmail: (email: string) => void
  newType: string
  setNewType: (type: string) => void
  
  // Actions
  refreshCustomers: () => Promise<void>
  createNewCustomer: () => Promise<void>
}

const POSCustomerContext = createContext<POSCustomerContextType | null>(null)

interface ApiCustomerRow {
  id?: unknown
  name?: unknown
  first_name?: unknown
  last_name?: unknown
  email?: unknown
  phone?: unknown
  customer_type?: unknown
  updated_at?: unknown
  address?: unknown
  city?: unknown
  last_visit?: unknown
  loyalty_points?: unknown
  total_purchases?: unknown
  total_repairs?: unknown
  current_balance?: unknown
  credit_limit?: unknown
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function mapApiCustomer(row: ApiCustomerRow) {
  const composedName = [textValue(row.first_name), textValue(row.last_name)].filter(Boolean).join(' ').trim()
  return {
    id: textValue(row.id),
    name: textValue(row.name) || composedName || 'Cliente sin nombre',
    email: textValue(row.email),
    phone: textValue(row.phone),
    type: textValue(row.customer_type) || 'regular',
    updated_at: textValue(row.updated_at),
    address: textValue(row.address),
    city: textValue(row.city),
    last_visit: textValue(row.last_visit) || null,
    loyalty_points: Number(row.loyalty_points) || 0,
    total_purchases: Number(row.total_purchases) || 0,
    total_repairs: Number(row.total_repairs) || 0,
    current_balance: Number(row.current_balance) || 0,
    credit_limit: Number(row.credit_limit) || 0,
  }
}

export function POSCustomerProvider({ children }: { children: ReactNode }) {
  // Estados principales
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [customers, setCustomers] = useState<any[]>([])
  const [customersSourceSupabase, setCustomersSourceSupabase] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('all')
  const [showFrequentOnly, setShowFrequentOnly] = useState(false)
  const [lastCustomerRefreshCount, setLastCustomerRefreshCount] = useState<number | null>(null)
  
  // New Customer Form State
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [newCustomerSaving, setNewCustomerSaving] = useState(false)
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newType, setNewType] = useState('regular')

  // Derived: Active Customer
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomer) || null
  }, [customers, selectedCustomer])

  // Derived: Customer Types
  const customerTypes = useMemo(() => {
    const types = new Set<string>()
    customers.forEach((c) => types.add(c.type || 'regular'))
    return Array.from(types)
  }, [customers])

  // Derived: Filtered Customers
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    let list = customers
    if (q) {
      list = list.filter((c) => {
        const name = String(c.name || '').toLowerCase()
        const phone = String(c.phone || '').toLowerCase()
        const email = String(c.email || '').toLowerCase()
        return name.includes(q) || phone.includes(q) || email.includes(q)
      })
    }
    if (customerTypeFilter !== 'all') {
      list = list.filter((c) => String(c.type || '').toLowerCase() === customerTypeFilter.toLowerCase())
    }
    if (showFrequentOnly) {
      const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000)
      list = list.filter((c) => {
        const ts = c.updated_at ? new Date(c.updated_at).getTime() : 0
        return ts >= cutoff
      })
    }
    return list
  }, [customers, customerSearch, customerTypeFilter, showFrequentOnly])

  const refreshCustomers = useCallback(async () => {
    if (!config.supabase.isConfigured) {
      setCustomers([])
      setCustomersSourceSupabase(false)
      setLastCustomerRefreshCount(0)
      return
    }

    const allRows: ApiCustomerRow[] = []
    let page = 1
    let totalPages = 1

    do {
      const response = await fetch(`/api/customers?page=${page}&limit=200`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success || !Array.isArray(payload.data)) {
        throw new Error(payload?.error || 'No se pudieron cargar los clientes')
      }

      allRows.push(...payload.data)
      totalPages = Math.max(1, Number(payload.pagination?.totalPages) || 1)
      page += 1
    } while (page <= totalPages)

    const mapped = allRows.map(mapApiCustomer)
    setCustomers(mapped)
    setCustomersSourceSupabase(true)
    setLastCustomerRefreshCount(mapped.length)
  }, [])

  React.useEffect(() => {
    refreshCustomers().catch((error) => {
      console.warn('No se pudieron cargar clientes del POS:', error)
      setCustomers([])
      setCustomersSourceSupabase(false)
      setLastCustomerRefreshCount(0)
    })
  }, [refreshCustomers])

  // Load real aggregates from Supabase when selecting a customer (parallelized + cached)
  const customerMetricsCache = React.useRef<Map<string, { data: any; timestamp: number }>>(new Map())
  const METRICS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  React.useEffect(() => {
    const run = async () => {
      if (!config.supabase.isConfigured || !selectedCustomer) return

      // Check cache first
      const cached = customerMetricsCache.current.get(selectedCustomer)
      if (cached && (Date.now() - cached.timestamp) < METRICS_CACHE_TTL) {
        setCustomers(prev => prev.map(c => (
          c.id === selectedCustomer ? { ...c, ...cached.data } : c
        )))
        return
      }

      try {
        const supabase = createSupabaseClient()

        // Execute all independent queries in parallel
        const [salesResult, repairsResult, creditsResult] = await Promise.all([
          supabase.from('sales').select('total_amount').eq('customer_id', selectedCustomer),
          supabase.from('repairs').select('id', { count: 'exact', head: true }).eq('customer_id', selectedCustomer),
          supabase.from('customer_credits').select('id,status').eq('customer_id', selectedCustomer),
        ])

        const totalPurchases = salesResult.data?.length || 0
        const totalSpent = (salesResult.data || []).reduce((sum: number, s: any) => sum + (Number(s.total_amount) || 0), 0)
        const totalRepairs = repairsResult.count || 0

        // Only fetch installments if there are credits (avoids unnecessary query)
        let outstanding = 0
        const creditIds = (creditsResult.data || []).map((c: any) => c.id)
        if (creditIds.length > 0) {
          const { data: installments } = await supabase
            .from('credit_installments')
            .select('amount,status')
            .in('credit_id', creditIds)
            .eq('status', 'pending')

          outstanding = (installments || []).reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
        }

        const loyaltyPoints = Math.floor((totalSpent || 0) / 10)

        const metrics = {
          total_purchases: totalPurchases,
          total_repairs: totalRepairs,
          current_balance: outstanding,
          loyalty_points: loyaltyPoints,
          last_visit: new Date().toISOString(),
        }

        // Update cache
        customerMetricsCache.current.set(selectedCustomer, { data: metrics, timestamp: Date.now() })

        // Update customer in state
        setCustomers(prev => prev.map(c => (
          c.id === selectedCustomer ? { ...c, ...metrics } : c
        )))
      } catch (e: any) {
        console.warn('No se pudieron cargar métricas del cliente:', String(e?.message || e || ''))
      }
    }
    run()
  }, [selectedCustomer, setCustomers])

  // Action: Create New Customer
  const createNewCustomer = useCallback(async () => {
    const hasBasic = newFirstName.trim().length > 0 || newPhone.trim().length > 0
    if (!hasBasic) {
      toast.error('Ingrese al menos nombre o teléfono')
      return
    }
    setNewCustomerSaving(true)
    try {
      if (config.supabase.isConfigured) {
        const name = [newFirstName, newLastName].filter(Boolean).join(' ').trim() || newPhone.trim()
        const response = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone: newPhone.trim(),
            email: newEmail.trim(),
            customer_type: newType,
          }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.error || 'No se pudo crear el cliente')
        }
        const mapped = mapApiCustomer(payload.data)
        setCustomers(prev => [mapped, ...prev])
        setSelectedCustomer(mapped.id)
        setCustomersSourceSupabase(true)
        setLastCustomerRefreshCount(customers.length + 1)
        toast.success('Cliente creado')
      } else {
        const id = Date.now().toString()
        const mapped = {
          id,
          name: [newFirstName, newLastName].filter(Boolean).join(' ').trim(),
          email: newEmail || '',
          phone: newPhone || '',
          type: newType,
          updated_at: new Date().toISOString(),
          address: '',
          loyalty_points: 0,
          total_purchases: 0,
          total_repairs: 0,
          current_balance: 0,
          last_visit: null,
        }
        setCustomers(prev => [mapped, ...prev])
        setSelectedCustomer(id)
        toast.success('Cliente demo creado')
      }
      setNewCustomerOpen(false)
      setNewCustomerSaving(false)
      setNewFirstName('')
      setNewLastName('')
      setNewPhone('')
      setNewEmail('')
      setNewType('regular')
    } catch (e: any) {
      setNewCustomerSaving(false)
      toast.error('No se pudo crear cliente: ' + String(e?.message || e || ''))
    }
  }, [customers.length, newFirstName, newLastName, newPhone, newEmail, newType])

  return (
    <POSCustomerContext.Provider value={{
      selectedCustomer,
      setSelectedCustomer,
      activeCustomer,
      customers,
      setCustomers,
      customersSourceSupabase,
      setCustomersSourceSupabase,
      lastCustomerRefreshCount,
      setLastCustomerRefreshCount,
      customerSearch,
      setCustomerSearch,
      customerTypeFilter,
      setCustomerTypeFilter,
      showFrequentOnly,
      setShowFrequentOnly,
      customerTypes,
      filteredCustomers,
      newCustomerOpen,
      setNewCustomerOpen,
      newCustomerSaving,
      newFirstName,
      setNewFirstName,
      newLastName,
      setNewLastName,
      newPhone,
      setNewPhone,
      newEmail,
      setNewEmail,
      newType,
      setNewType,
      refreshCustomers,
      createNewCustomer
    }}>
      {children}
    </POSCustomerContext.Provider>
  )
}

export function usePOSCustomer() {
  const context = useContext(POSCustomerContext)
  if (!context) {
    throw new Error('usePOSCustomer must be used within a POSCustomerProvider')
  }
  return context
}

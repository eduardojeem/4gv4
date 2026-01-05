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
  createNewCustomer: () => Promise<void>
}

const POSCustomerContext = createContext<POSCustomerContextType | null>(null)

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
        const supabase = createSupabaseClient()
        const { data, error } = await supabase
          .from('customers')
          .insert({
            first_name: newFirstName.trim(),
            last_name: newLastName.trim(),
            phone: newPhone.trim(),
            email: newEmail.trim(),
            customer_type: newType,
          })
          .select('id,first_name,last_name,phone,email,customer_type,updated_at')
          .single()
        if (error) throw new Error(error.message)
        const row = data as any
        const mapped = {
          id: row.id,
          name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim(),
          email: row.email || '',
          phone: row.phone || '',
          type: row.customer_type || 'regular',
          updated_at: row.updated_at,
          address: '',
          loyalty_points: 0,
          total_purchases: 0,
          total_repairs: 0,
          current_balance: 0,
          last_visit: null,
        }
        setCustomers(prev => [mapped, ...prev])
        setSelectedCustomer(row.id)
        setCustomersSourceSupabase(true)
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
  }, [newFirstName, newLastName, newPhone, newEmail, newType])

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

import React, { useEffect, useRef } from 'react'
import { useCustomers } from '@/contexts/CustomerContext'
import type { Customer } from '@/hooks/use-customer-state'

export interface SyncedPosCustomer {
  id: string
  name: string
  email: string
  phone: string
  type: string
  address: string
  city: string
  loyalty_points: number
  total_purchases: number
  total_repairs: number
  current_balance: number
  credit_limit: number
  last_visit: string | null
  updated_at?: string
}

interface CustomerSyncSectionProps {
  onSync: (rows: SyncedPosCustomer[], fromSupabase: boolean) => void
  onCount: (n: number) => void
}

export const CustomerSyncSection: React.FC<CustomerSyncSectionProps> = ({ onSync, onCount }) => {
  const { customers } = useCustomers()
  const lastDigestRef = useRef<string>('')

  useEffect(() => {
    const mapped: SyncedPosCustomer[] = (customers || []).map((c: Customer) => ({
      id: c.id,
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      type: c.customer_type || 'regular',
      address: c.address || '',
      city: c.city || '',
      loyalty_points: c.loyalty_points || 0,
      total_purchases: c.total_purchases || 0,
      total_repairs: c.total_repairs || 0,
      current_balance: c.current_balance || 0,
      credit_limit: c.credit_limit || 0,
      last_visit: c.last_visit || null,
      updated_at: c.updated_at || c.last_activity
    }))
    
    const digest = mapped.map((m) => m.id).join('|')
    
    if (digest !== lastDigestRef.current) {
      lastDigestRef.current = digest
      onSync(mapped, true)
      onCount(mapped.length)
    }
  }, [customers, onSync, onCount])

  return null
}

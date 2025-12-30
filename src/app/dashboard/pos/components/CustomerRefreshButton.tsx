import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useCustomers } from '@/contexts/CustomerContext'
import { toast } from 'sonner'

interface CustomerRefreshButtonProps {
  onUpdated: (rows: any[]) => void
  setCustomersSourceSupabase: (value: boolean) => void
  setLastCustomerRefreshCount: (value: number) => void
  lastCustomerRefreshCount: number | null
  setCustomers: (customers: any[]) => void
}

export const CustomerRefreshButton: React.FC<CustomerRefreshButtonProps> = ({ 
  onUpdated, 
  setCustomersSourceSupabase, 
  setLastCustomerRefreshCount, 
  lastCustomerRefreshCount,
  setCustomers
}) => {
  const { refreshCustomers } = useCustomers()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          const updated = await refreshCustomers()
          const mapped = (updated || []).map((c: any) => ({
            id: c.id,
            name: c.name || '',
            email: c.email || '',
            phone: c.phone || '',
            type: c.customer_type || 'regular',
            updated_at: c.updated_at || c.last_activity
          }))
          onUpdated(mapped)
          setCustomersSourceSupabase(true)
          setLastCustomerRefreshCount(mapped.length)
          toast.success('Clientes actualizados')
        } catch {
          setCustomers([])
          setCustomersSourceSupabase(false)
          setLastCustomerRefreshCount(0)
          toast.error('Error de red al refrescar clientes')
        }
      }}
    >
      {lastCustomerRefreshCount != null ? `Refrescar (${lastCustomerRefreshCount})` : 'Refrescar'}
    </Button>
  )
}

'use client'

/**
 * CustomerSelectorV3 – thin adapter over CustomerSelector.
 * Recreated after accidental deletion; delegates all real logic to
 * CustomerSelector and normalises the `onChange` callback shape that
 * repair-form-dialog-v2 expects ({ name, phone, email } instead of
 * the full Customer object).
 */

import { CustomerSelector } from './CustomerSelector'
import type { Customer } from '@/hooks/use-customers'

interface CustomerSelectorV3Props {
  value?: string
  /** Pre-selected customer data (used in edit mode to show the name). */
  initialCustomer?: {
    id: string
    name: string
    phone: string
    email: string
    ruc?: string
    alternate_phone?: string | null
    alternate_phone_label?: string | null
    customer_type?: string
    is_wholesale?: boolean
  }
  onChange: (
    customerId: string,
    customerData?: {
      name: string
      phone: string
      email: string
      ruc?: string
      alternate_phone?: string | null
      alternate_phone_label?: string | null
      customer_type?: string
      is_wholesale?: boolean
    }
  ) => void
  error?: string
  disabled?: boolean
}

export function CustomerSelectorV3({
  value,
  initialCustomer,
  onChange,
  error,
  disabled,
}: CustomerSelectorV3Props) {
  const handleChange = (customerId: string, customer?: Customer) => {
    if (customer) {
      const isWholesale = customer.segment === 'wholesale' ||
        customer.customer_type === 'wholesale'
      onChange(customerId, {
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        ruc: customer.ruc || '',
        alternate_phone: customer.alternate_phone || null,
        alternate_phone_label: customer.alternate_phone_label || null,
        customer_type: customer.customer_type || (isWholesale ? 'wholesale' : 'regular'),
        is_wholesale: isWholesale,
      })
    } else {
      onChange(customerId)
    }
  }

  return (
    <CustomerSelector
      value={value}
      initialCustomer={initialCustomer}
      onChange={handleChange}
      error={error}
      disabled={disabled}
    />
  )
}

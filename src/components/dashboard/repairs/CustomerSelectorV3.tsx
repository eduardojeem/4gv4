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
  }
  onChange: (
    customerId: string,
    customerData?: { name: string; phone: string; email: string }
  ) => void
  error?: string
  disabled?: boolean
}

export function CustomerSelectorV3({
  value,
  onChange,
  error,
  disabled,
}: CustomerSelectorV3Props) {
  const handleChange = (customerId: string, customer?: Customer) => {
    if (customer) {
      onChange(customerId, {
        name: `${customer.first_name} ${customer.last_name}`.trim(),
        phone: customer.phone || '',
        email: customer.email || '',
      })
    } else {
      onChange(customerId)
    }
  }

  return (
    <CustomerSelector
      value={value}
      onChange={handleChange}
      error={error}
      disabled={disabled}
    />
  )
}

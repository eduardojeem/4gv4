import type { Supplier as DomainSupplier } from '@/lib/types/supplier'

export type UISupplier = Pick<DomainSupplier,
  | 'id'
  | 'name'
  | 'contact_person'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'country'
  | 'postal_code'
  | 'website'
  | 'business_type'
  | 'status'
  | 'rating'
  | 'products_count'
  | 'total_orders'
  | 'total_amount'
  | 'notes'
  | 'created_at'
  | 'updated_at'
>


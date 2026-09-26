'use client'

import type { ReactNode } from 'react'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return <OrganizationModuleGate module="orders">{children}</OrganizationModuleGate>
}

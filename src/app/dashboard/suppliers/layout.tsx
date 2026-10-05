'use client'

import type { ReactNode } from 'react'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'

export default function SuppliersLayout({ children }: { children: ReactNode }) {
  return <OrganizationModuleGate module="inventory">{children}</OrganizationModuleGate>
}

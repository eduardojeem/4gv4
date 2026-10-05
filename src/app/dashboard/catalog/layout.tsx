'use client'

import type { ReactNode } from 'react'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return <OrganizationModuleGate module="inventory">{children}</OrganizationModuleGate>
}

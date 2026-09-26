'use client'

import type { ReactNode } from 'react'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'

export default function RepairsLayout({ children }: { children: ReactNode }) {
  return <OrganizationModuleGate module="repairs">{children}</OrganizationModuleGate>
}

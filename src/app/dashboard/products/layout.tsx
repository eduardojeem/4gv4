'use client'

import type { ReactNode } from 'react'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'

// Los servicios de la agenda también se cargan acá: alcanza con Inventario o Servicios.
export default function ProductsLayout({ children }: { children: ReactNode }) {
  return <OrganizationModuleGate module={['inventory', 'services']}>{children}</OrganizationModuleGate>
}

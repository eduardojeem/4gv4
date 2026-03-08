import { TechnicianLayout } from '@/components/technician/layout/TechnicianLayout'
import { RouteGuard } from '@/components/auth/permission-guard'
import { ReactNode } from 'react'

export default function TechnicianSectionLayout({
    children,
}: {
    children: ReactNode
}) {
    return (
        <RouteGuard route="/dashboard/technician" redirectTo="/dashboard">
            <TechnicianLayout>{children}</TechnicianLayout>
        </RouteGuard>
    )
}

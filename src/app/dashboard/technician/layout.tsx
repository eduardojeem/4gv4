import { TechnicianLayout } from '@/components/technician/layout/TechnicianLayout'
import { ReactNode } from 'react'

export default function TechnicianSectionLayout({
    children,
}: {
    children: ReactNode
}) {
    return (
        <TechnicianLayout>{children}</TechnicianLayout>
    )
}

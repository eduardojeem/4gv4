import { SaaSMobileBottomNav } from '@/components/public/SaaSMobileBottomNav'

export default function SaaSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 pb-16 lg:pb-0">{children}</div>
      <SaaSMobileBottomNav />
    </div>
  )
}

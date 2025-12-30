'use client'

import dynamic from 'next/dynamic'

const NotificationsCenter = dynamic(() => import('@/components/admin/notifications-center'), { ssr: false })

export default function AdminNotificationsBar() {
  return (
    <div className="p-2 border-b bg-card">
      <NotificationsCenter />
    </div>
  )
}
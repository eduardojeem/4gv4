'use client'

import { redirect } from 'next/navigation'

// Esta ruta ahora redirige al dashboard principal de admin
export default function NotificationsPage() {
  redirect('/admin')
}

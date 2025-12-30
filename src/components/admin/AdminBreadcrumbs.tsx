'use client'
import React from 'react'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

export default function AdminBreadcrumbs() {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)
  const trail = parts.slice(1)
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Home className="h-4 w-4" />
      {trail.map((p, i) => (
        <span key={i} className="flex items-center gap-2">
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground capitalize">{p}</span>
        </span>
      ))}
    </div>
  )
}

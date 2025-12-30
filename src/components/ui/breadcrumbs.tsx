"use client"

import React from 'react'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbsProps {
  items?: { label: string; href?: string }[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const derivedItems = items ?? [
    { label: 'Inicio', href: '/' },
    ...segments.map((seg, i) => ({
      label: decodeURIComponent(seg),
      href: '/' + segments.slice(0, i + 1).join('/')
    }))
  ]

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-muted-foreground">
      <Home className="h-4 w-4 mr-1" aria-hidden />
      {derivedItems.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <ChevronRight className="h-4 w-4 mx-1" aria-hidden />}
          {item.href ? (
            <a href={item.href} className="hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm">
              {item.label}
            </a>
          ) : (
            <span aria-current="page" className="font-medium text-foreground">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
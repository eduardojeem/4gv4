'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { Fragment } from 'react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground">
        <li>
          <Link 
            href="/" 
            className="flex items-center hover:text-foreground transition-colors"
            aria-label="Inicio"
          >
            <Home className="h-4 w-4" />
          </Link>
        </li>
        {items.map((item, index) => (
          <Fragment key={index}>
            <li>
              <ChevronRight className="h-4 w-4" />
            </li>
            <li>
              {item.href ? (
                <Link 
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="font-medium text-foreground" aria-current="page">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}

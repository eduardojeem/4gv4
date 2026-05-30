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
      {/*
       * overflow-x-auto + whitespace-nowrap → horizontal scroll on narrow screens
       * instead of wrapping / overflowing the layout.
       * scrollbar-none hides the scrollbar visually while keeping it functional.
       */}
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-none pb-0.5">
        {/* Home icon */}
        <li className="shrink-0">
          <Link
            href="/"
            className="flex items-center hover:text-foreground transition-colors"
            aria-label="Inicio"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <Fragment key={index}>
              <li className="shrink-0 text-muted-foreground/50" aria-hidden>
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li className={isLast ? 'min-w-0' : 'shrink-0'}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  /*
                   * Last item (current page): truncate with ellipsis so long product
                   * names don't overflow on mobile.
                   */
                  <span
                    className="block max-w-[180px] truncate font-medium text-foreground sm:max-w-xs"
                    aria-current="page"
                    title={item.label}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

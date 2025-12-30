'use client'

import React from 'react'

export function ClientOnly({ children, className }: { children: React.ReactNode, className?: string }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <span suppressHydrationWarning className={className} />
  }
  return <span className={className}>{children}</span>
}
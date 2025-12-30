"use client"

import React from 'react'

export function SkipToContentLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only fixed top-2 left-2 z-50 bg-primary text-primary-foreground px-3 py-1 rounded"
    >
      Saltar al contenido principal
    </a>
  )
}
'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_STOREFRONT_STYLE, type StorefrontStyle } from '@/lib/website/storefront-style'
import {
  STOREFRONT_PREVIEW_READY,
  parseStorefrontPreviewDraft,
  type StorefrontPreviewDraft,
} from '@/lib/website/storefront-preview-message'
import type { CompanyInfo } from '@/types/website-settings'

// Fuera de una tienda (dashboard, marketplace) no hay provider: todo queda con
// el aspecto clasico.
const StorefrontStyleContext = createContext<StorefrontStyle>(DEFAULT_STOREFRONT_STYLE)
const StorefrontPreviewContext = createContext<StorefrontPreviewDraft | null>(null)

/**
 * Embebida en la vista previa de /admin/website, la tienda pinta el borrador
 * que le manda el editor. Solo escucha a su propia ventana padre y mismo origen:
 * nadie de afuera puede cambiarle el aspecto, y fuera de un iframe no hace nada.
 */
function useAdminPreviewDraft(): StorefrontPreviewDraft | null {
  const [draft, setDraft] = useState<StorefrontPreviewDraft | null>(null)

  useEffect(() => {
    if (window.parent === window) return

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      const next = parseStorefrontPreviewDraft(event.data)
      if (next) setDraft(next)
    }

    window.addEventListener('message', handleMessage)
    window.parent.postMessage({ type: STOREFRONT_PREVIEW_READY }, window.location.origin)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // El color de marca vive en atributos del contenedor que arma el layout del servidor.
  useEffect(() => {
    if (!draft) return
    const root = document.querySelector<HTMLElement>('[data-storefront-style]')
    if (!root) return
    root.dataset.storefrontStyle = draft.style
    if (draft.brandColor === 'custom' && draft.customBrandColor) {
      delete root.dataset.colorScheme
      root.dataset.customBrand = ''
      root.style.setProperty('--brand-primary', draft.customBrandColor)
    } else {
      root.dataset.colorScheme = draft.brandColor === 'custom' ? 'blue' : draft.brandColor
      delete root.dataset.customBrand
      root.style.removeProperty('--brand-primary')
    }
  }, [draft])

  return draft
}

export function StorefrontStyleProvider({ style, children }: { style: StorefrontStyle; children: ReactNode }) {
  const previewDraft = useAdminPreviewDraft()
  const activeStyle = previewDraft?.style ?? style

  return (
    <StorefrontPreviewContext.Provider value={previewDraft}>
      <StorefrontStyleContext.Provider value={activeStyle}>{children}</StorefrontStyleContext.Provider>
    </StorefrontPreviewContext.Provider>
  )
}

export function useStorefrontStyle(): StorefrontStyle {
  return useContext(StorefrontStyleContext)
}

/** Los datos de la empresa con el borrador de la vista previa encima, si lo hay. */
export function useStorefrontCompanyInfo<T extends Partial<CompanyInfo> | undefined>(companyInfo: T): T {
  const draft = useContext(StorefrontPreviewContext)
  return useMemo(() => {
    if (!draft) return companyInfo
    return {
      ...companyInfo,
      brandColor: draft.brandColor,
      customBrandColor: draft.customBrandColor,
      headerStyle: draft.headerStyle,
      showTopBar: draft.showTopBar,
    } as T
  }, [companyInfo, draft])
}

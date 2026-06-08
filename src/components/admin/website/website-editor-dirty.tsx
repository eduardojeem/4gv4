'use client'

import { createContext, useContext } from 'react'

/**
 * Lets website editors report their "unsaved changes" state up to the tabs page,
 * so switching tabs (which unmounts the editor and would drop the draft) can warn
 * first. The active editor registers its dirty flag; the page owns the ref.
 */
export const WebsiteEditorDirtyContext = createContext<{ setDirty: (dirty: boolean) => void } | null>(null)

export function useWebsiteEditorDirty() {
  return useContext(WebsiteEditorDirtyContext)
}

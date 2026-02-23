import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'

interface UseAutoSaveOptions<T> {
  data: T
  key: string
  interval?: number // en milisegundos
  enabled?: boolean
  onSave?: (data: T) => void
  onRestore?: (data: T) => void
}

export function useAutoSave<T>({
  data,
  key,
  interval = 30000, // 30 segundos por defecto
  enabled = true,
  onSave,
  onRestore
}: UseAutoSaveOptions<T>) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>('')

  // Guardar borrador
  const saveDraft = useCallback(() => {
    if (!enabled) return

    try {
      const serialized = JSON.stringify(data)
      
      // Solo guardar si hay cambios
      if (serialized === lastSavedRef.current) return
      
      localStorage.setItem(`draft_${key}`, serialized)
      localStorage.setItem(`draft_${key}_timestamp`, new Date().toISOString())
      lastSavedRef.current = serialized
      
      onSave?.(data)
      
      // Toast sutil para confirmar guardado
      toast.success('Borrador guardado', {
        duration: 2000,
        position: 'bottom-right'
      })
    } catch (error) {
      console.error('Error saving draft:', error)
    }
  }, [data, key, enabled, onSave])

  // Recuperar borrador
  const restoreDraft = useCallback((): T | null => {
    try {
      const saved = localStorage.getItem(`draft_${key}`)
      if (!saved) return null

      const parsed = JSON.parse(saved) as T
      const timestamp = localStorage.getItem(`draft_${key}_timestamp`)
      
      return parsed
    } catch (error) {
      console.error('Error restoring draft:', error)
      return null
    }
  }, [key])

  // Obtener timestamp del borrador
  const getDraftTimestamp = useCallback((): Date | null => {
    try {
      const timestamp = localStorage.getItem(`draft_${key}_timestamp`)
      return timestamp ? new Date(timestamp) : null
    } catch (error) {
      return null
    }
  }, [key])

  // Eliminar borrador
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(`draft_${key}`)
      localStorage.removeItem(`draft_${key}_timestamp`)
      lastSavedRef.current = ''
      
      toast.success('Borrador eliminado', {
        duration: 2000,
        position: 'bottom-right'
      })
    } catch (error) {
      console.error('Error clearing draft:', error)
    }
  }, [key])

  // Verificar si existe un borrador
  const hasDraft = useCallback((): boolean => {
    return localStorage.getItem(`draft_${key}`) !== null
  }, [key])

  // Auto-save periódico
  useEffect(() => {
    if (!enabled) return

    // Guardar inmediatamente al montar si hay datos
    if (data) {
      saveDraft()
    }

    // Configurar intervalo
    intervalRef.current = setInterval(() => {
      saveDraft()
    }, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [data, interval, enabled, saveDraft])

  // Guardar antes de cerrar la ventana
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (enabled) {
        saveDraft()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [enabled, saveDraft])

  return {
    saveDraft,
    restoreDraft,
    clearDraft,
    hasDraft,
    getDraftTimestamp
  }
}

/**
 * Hook para mostrar prompt de recuperación de borrador
 */
export function useDraftRecovery<T>(key: string, onRestore: (data: T) => void) {
  useEffect(() => {
    const checkForDraft = () => {
      try {
        const saved = localStorage.getItem(`draft_${key}`)
        const timestamp = localStorage.getItem(`draft_${key}_timestamp`)
        
        if (saved && timestamp) {
          const draftDate = new Date(timestamp)
          const now = new Date()
          const hoursSince = (now.getTime() - draftDate.getTime()) / (1000 * 60 * 60)
          
          // Solo mostrar si el borrador tiene menos de 24 horas
          if (hoursSince < 24) {
            const shouldRestore = window.confirm(
              `Se encontró un borrador guardado hace ${Math.round(hoursSince)} hora(s). ¿Desea recuperarlo?`
            )
            
            if (shouldRestore) {
              const parsed = JSON.parse(saved) as T
              onRestore(parsed)
              toast.success('Borrador recuperado exitosamente')
            } else {
              // Limpiar borrador si el usuario no quiere recuperarlo
              localStorage.removeItem(`draft_${key}`)
              localStorage.removeItem(`draft_${key}_timestamp`)
            }
          } else {
            // Limpiar borradores antiguos automáticamente
            localStorage.removeItem(`draft_${key}`)
            localStorage.removeItem(`draft_${key}_timestamp`)
          }
        }
      } catch (error) {
        console.error('Error checking for draft:', error)
      }
    }

    checkForDraft()
  }, [key, onRestore])
}

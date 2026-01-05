'use client'

import { useState, useCallback, useRef } from 'react'
import { uploadFile } from '@/lib/supabase-storage'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { toast } from 'sonner'

interface AvatarUploadOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: string
  cropSquare?: boolean
  rotate?: number
}

interface AvatarUploadState {
  isProcessing: boolean
  isUploading: boolean
  progress: number
  error: string | null
  previewUrl: string | null
}

interface AvatarUploadResult {
  success: boolean
  url?: string
  error?: string
  compressionRatio?: string
}

export function useAvatarUpload(userId: string | null) {
  const [state, setState] = useState<AvatarUploadState>({
    isProcessing: false,
    isUploading: false,
    progress: 0,
    error: null,
    previewUrl: null
  })

  const workerRef = useRef<Worker | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const supabase = createClient()

  // Inicializar worker si no existe
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker('/workers/image-processor.js')
    }
    return workerRef.current
  }, [])

  // Validar archivo
  const validateFile = useCallback((file: File): string | null => {
    // Verificar tipo
    if (!file.type.startsWith('image/')) {
      return 'El archivo debe ser una imagen'
    }

    // Verificar tipos soportados
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!supportedTypes.includes(file.type.toLowerCase())) {
      return 'Formato no soportado. Use JPG, PNG, WebP o GIF'
    }

    // Verificar tamaño (10MB máximo)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return 'La imagen es muy grande (máximo 10MB)'
    }

    // Verificar dimensiones mínimas
    return new Promise<string | null>((resolve) => {
      const img = new Image()
      img.onload = () => {
        if (img.width < 50 || img.height < 50) {
          resolve('La imagen es muy pequeña (mínimo 50x50px)')
        } else if (img.width > 5000 || img.height > 5000) {
          resolve('La imagen es muy grande (máximo 5000x5000px)')
        } else {
          resolve(null)
        }
        URL.revokeObjectURL(img.src)
      }
      img.onerror = () => {
        resolve('Imagen corrupta o inválida')
        URL.revokeObjectURL(img.src)
      }
      img.src = URL.createObjectURL(file)
    }) as any
  }, [])

  // Procesar imagen con Web Worker
  const processImage = useCallback((file: File, options: AvatarUploadOptions): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const worker = getWorker()
      const id = Math.random().toString(36).substr(2, 9)

      const handleMessage = (e: MessageEvent) => {
        if (e.data.id !== id) return

        worker.removeEventListener('message', handleMessage)

        if (e.data.success) {
          resolve(e.data.blob)
          
          // Mostrar estadísticas de compresión
          if (e.data.compressionRatio > 0) {
            toast.success(`Imagen optimizada (${e.data.compressionRatio}% reducción)`)
          }
        } else {
          reject(new Error(e.data.error))
        }
      }

      worker.addEventListener('message', handleMessage)
      worker.postMessage({ file, options, id })

      // Timeout de 30 segundos
      setTimeout(() => {
        worker.removeEventListener('message', handleMessage)
        reject(new Error('Timeout procesando imagen'))
      }, 30000)
    })
  }, [getWorker])

  // Subir avatar con progreso
  const uploadAvatar = useCallback(async (
    file: File, 
    options: AvatarUploadOptions = {}
  ): Promise<AvatarUploadResult> => {
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Cancelar subida anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setState(prev => ({
      ...prev,
      isProcessing: true,
      isUploading: false,
      progress: 0,
      error: null
    }))

    try {
      // Validar archivo
      const validationError = await validateFile(file)
      if (validationError) {
        throw new Error(validationError)
      }

      // Crear preview inmediato
      const previewUrl = URL.createObjectURL(file)
      setState(prev => ({ ...prev, previewUrl }))

      // Procesar imagen
      setState(prev => ({ ...prev, progress: 20 }))
      const processedBlob = await processImage(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.9,
        format: 'image/webp',
        ...options
      })

      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        isUploading: true, 
        progress: 40 
      }))

      // Crear archivo procesado
      const processedFile = new File([processedBlob], 'avatar.webp', { 
        type: 'image/webp' 
      })

      // Subir a Supabase con progreso simulado
      const filePath = `${userId}/avatar-${Date.now()}.webp`
      
      // Simular progreso de subida
      const progressInterval = setInterval(() => {
        setState(prev => ({ 
          ...prev, 
          progress: Math.min(prev.progress + 10, 90) 
        }))
      }, 200)

      const result = await uploadFile('avatars', filePath, processedFile, { 
        upsert: true 
      })

      clearInterval(progressInterval)

      if (!result.success) {
        throw new Error(result.error || 'Error subiendo imagen')
      }

      setState(prev => ({ ...prev, progress: 95 }))

      // Actualizar perfil en base de datos
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId, 
          avatar_url: result.url,
          updated_at: new Date().toISOString()
        })

      if (upsertError) {
        console.warn('Error actualizando perfil:', upsertError)
      }

      // Actualizar auth metadata
      try {
        if ('updateUser' in supabase.auth) {
          await (supabase.auth as any).updateUser({ 
            data: { avatar_url: result.url } 
          })
        }
      } catch (authError) {
        console.warn('Error actualizando auth metadata:', authError)
      }

      setState(prev => ({ 
        ...prev, 
        progress: 100, 
        isUploading: false 
      }))

      // Limpiar preview anterior
      if (state.previewUrl && state.previewUrl !== previewUrl) {
        URL.revokeObjectURL(state.previewUrl)
      }

      toast.success('Avatar actualizado correctamente')

      return { 
        success: true, 
        url: result.url,
        compressionRatio: ((file.size - processedBlob.size) / file.size * 100).toFixed(1) + '%'
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        isProcessing: false,
        isUploading: false,
        progress: 0
      }))

      // Limpiar preview en caso de error
      if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl)
        setState(prev => ({ ...prev, previewUrl: null }))
      }

      toast.error(errorMessage)

      return { success: false, error: errorMessage }
    }
  }, [userId, supabase, validateFile, processImage, state.previewUrl])

  // Cancelar subida
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl)
    }

    setState({
      isProcessing: false,
      isUploading: false,
      progress: 0,
      error: null,
      previewUrl: null
    })
  }, [state.previewUrl])

  // Limpiar recursos al desmontar
  const cleanup = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl)
    }
  }, [state.previewUrl])

  return {
    ...state,
    uploadAvatar,
    cancelUpload,
    cleanup,
    isLoading: state.isProcessing || state.isUploading
  }
}
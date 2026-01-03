'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Upload, Image as ImageIcon, Loader2, AlertCircle, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import imageCompression from 'browser-image-compression'

interface ImageUploaderProps {
  images: string[]
  onChange: (images: string[]) => void
  maxImages?: number
  maxSize?: number
  disabled?: boolean
  onUploadFiles?: (files: File[]) => Promise<string[]>
}

export function ImageUploader({ 
  images = [], 
  onChange, 
  maxImages = 5,
  maxSize = 5242880, // 5MB
  disabled = false,
  onUploadFiles
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [loadingUrl, setLoadingUrl] = useState(false)

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      onProgress: (progress: number) => {
        setUploadProgress(prev => ({ ...prev, [file.name]: progress }))
      }
    }

    try {
      const compressedFile = await imageCompression(file, options)
      return compressedFile
    } catch (error) {
      console.error('Error compressing image:', error)
      return file
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    if (onUploadFiles) {
      const urls = await onUploadFiles([file])
      return urls[0]
    }
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve(reader.result as string)
      }
      reader.readAsDataURL(file)
    })
  }

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (disabled) return

    // Validar archivos rechazados
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach(({ file, errors }) => {
        errors.forEach((error: any) => {
          if (error.code === 'file-too-large') {
            toast.error(`${file.name} es muy grande`, {
              description: `Tamaño máximo: ${maxSize / 1024 / 1024}MB`
            })
          } else if (error.code === 'file-invalid-type') {
            toast.error(`${file.name} no es una imagen válida`, {
              description: 'Solo se permiten JPG, PNG y WebP'
            })
          }
        })
      })
      return
    }

    // Validar cantidad máxima
    if (images.length + acceptedFiles.length > maxImages) {
      toast.error('Límite de imágenes alcanzado', {
        description: `Máximo ${maxImages} imágenes por producto`
      })
      return
    }

    setUploading(true)
    const uploadedUrls: string[] = []

    try {
      for (const file of acceptedFiles) {
        const compressedFile = await compressImage(file)
        const url = await uploadImage(compressedFile)
        uploadedUrls.push(url)
        toast.success(`${file.name} subida exitosamente`)
      }

      onChange([...images, ...uploadedUrls])
    } catch (error) {
      console.error('Error uploading images:', error)
      toast.error('Error al subir imágenes', {
        description: 'Por favor intenta nuevamente'
      })
    } finally {
      setUploading(false)
      setUploadProgress({})
    }
  }, [images, onChange, maxImages, maxSize, disabled])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxSize,
    maxFiles: maxImages - images.length,
    onDrop,
    disabled: disabled || uploading
  })

  const removeImage = (index: number) => {
    if (disabled) return
    onChange(images.filter((_, i) => i !== index))
    toast.success('Imagen eliminada')
  }

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (disabled) return
    const newImages = [...images]
    const [removed] = newImages.splice(fromIndex, 1)
    newImages.splice(toIndex, 0, removed)
    onChange(newImages)
  }

  const validateImageUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
      const pathname = urlObj.pathname.toLowerCase()
      return validExtensions.some(ext => pathname.endsWith(ext)) || 
             pathname.includes('/image') ||
             url.includes('unsplash.com') ||
             url.includes('cloudinary.com') ||
             url.includes('imgur.com')
    } catch {
      return false
    }
  }

  const addImageFromUrl = async () => {
    if (!imageUrl.trim()) {
      toast.error('Por favor ingresa una URL')
      return
    }

    if (!validateImageUrl(imageUrl)) {
      toast.error('URL inválida', {
        description: 'La URL debe ser una imagen válida (JPG, PNG, WebP, GIF)'
      })
      return
    }

    if (images.length >= maxImages) {
      toast.error('Límite de imágenes alcanzado', {
        description: `Máximo ${maxImages} imágenes por producto`
      })
      return
    }

    setLoadingUrl(true)

    try {
      // Verificar que la imagen se puede cargar
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imageUrl
      })

      // Agregar la URL a las imágenes
      onChange([...images, imageUrl])
      toast.success('Imagen agregada desde URL')
      setImageUrl('')
      setShowUrlInput(false)
    } catch (error) {
      console.error('Error loading image from URL:', error)
      toast.error('No se pudo cargar la imagen', {
        description: 'Verifica que la URL sea correcta y la imagen esté disponible'
      })
    } finally {
      setLoadingUrl(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Preview de imágenes */}
      <AnimatePresence>
        {images.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {images.map((url, index) => (
              <motion.div
                key={url}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: index * 0.05 }}
                className="relative group"
              >
                <Card className="overflow-hidden border-2 hover:border-blue-300 transition-colors">
                  <div className="aspect-square relative">
                    <img
                      src={url}
                      alt={`Imagen ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay con acciones */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                        disabled={disabled}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Badge de imagen principal */}
                    {index === 0 && (
                      <div className="absolute top-2 left-2">
                        <span className="px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
                          Principal
                        </span>
                      </div>
                    )}

                    {/* Número de imagen */}
                    <div className="absolute bottom-2 right-2">
                      <span className="px-2 py-1 bg-black/60 text-white text-xs font-medium rounded-full">
                        {index + 1}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropzone */}
      {images.length < maxImages && (
        <>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragActive 
                ? 'border-blue-500 bg-blue-50 scale-105' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
              ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            {uploading ? (
              <div className="space-y-3">
                <Loader2 className="h-12 w-12 text-blue-500 mx-auto animate-spin" />
                <p className="text-gray-600 font-medium">Subiendo imágenes...</p>
                <p className="text-xs text-gray-500">Comprimiendo y optimizando</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                  {isDragActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 rounded-full"
                    />
                  )}
                </div>
                
                <div>
                  <p className="text-gray-700 font-medium mb-1">
                    {isDragActive
                      ? '¡Suelta las imágenes aquí!'
                      : 'Arrastra imágenes o haz clic para seleccionar'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Máximo {maxImages} imágenes • {maxSize / 1024 / 1024}MB cada una
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Formatos: JPG, PNG, WebP
                  </p>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button type="button" variant="outline" size="sm" disabled={disabled || uploading}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Seleccionar Archivos
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowUrlInput(!showUrlInput)
                    }}
                    disabled={disabled || uploading}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Agregar por URL
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Input de URL */}
          <AnimatePresence>
            {showUrlInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-blue-700">
                      <LinkIcon className="h-4 w-4" />
                      <Label className="text-sm font-medium">Agregar imagen desde URL</Label>
                    </div>
                    
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="https://ejemplo.com/imagen.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addImageFromUrl()
                          }
                        }}
                        disabled={loadingUrl || disabled}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={addImageFromUrl}
                        disabled={loadingUrl || disabled || !imageUrl.trim()}
                        size="sm"
                      >
                        {loadingUrl ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Cargando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Agregar
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowUrlInput(false)
                          setImageUrl('')
                        }}
                        disabled={loadingUrl}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <p className="text-xs text-blue-600">
                      💡 Puedes usar URLs de Unsplash, Cloudinary, Imgur o cualquier imagen pública
                    </p>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Información adicional */}
      {images.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            <span>
              {images.length} de {maxImages} imágenes
            </span>
          </div>
          {images.length === maxImages && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs">Límite alcanzado</span>
            </div>
          )}
        </div>
      )}

      {/* Ayuda */}
      {images.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <ImageIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">Consejos para mejores imágenes:</p>
              <ul className="text-blue-700 space-y-1 text-xs">
                <li>• Usa imágenes de alta calidad y bien iluminadas</li>
                <li>• La primera imagen será la principal del producto</li>
                <li>• Las imágenes se comprimen automáticamente</li>
                <li>• Puedes agregar imágenes desde tu computadora o por URL</li>
                <li>• Puedes eliminar imágenes haciendo clic en la X</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

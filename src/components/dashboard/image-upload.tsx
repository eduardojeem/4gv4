'use client'

import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Camera, 
  FileImage, 
  Eye,
  Download,
  RotateCw,
  Crop
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ImageFile {
  id: string
  file: File
  originalFile: File
  url: string
  name: string
  size: number
  type: string
  isUploading: boolean
  uploadProgress: number
  isMain: boolean
  rotate?: number
  cropSquare?: boolean
}

interface ImageUploadProps {
  images?: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
  maxFileSize?: number // en MB
  maxSizeInMB?: number // alias de maxFileSize para compatibilidad
  acceptedTypes?: string[]
}

export function ImageUpload({ 
  images = [], 
  onImagesChange, 
  maxImages = 10,
  maxFileSize = 5,
  maxSizeInMB,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
}: ImageUploadProps) {
  // Ajustar alias si existe
  if (typeof maxSizeInMB === 'number') {
    maxFileSize = maxSizeInMB
  }

  const [imageFiles, setImageFiles] = useState<ImageFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Opciones de procesado
  const [quality, setQuality] = useState<number>(0.8)
  const [maxWidth, setMaxWidth] = useState<number>(1280)
  const [outputFormat, setOutputFormat] = useState<'image/webp' | 'image/jpeg' | 'image/png'>('image/webp')
  const [defaultCropSquare, setDefaultCropSquare] = useState<boolean>(false)

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `Tipo de archivo no válido. Solo se permiten: ${acceptedTypes.join(', ')}`
    }
    
    if (file.size > maxFileSize * 1024 * 1024) {
      return `El archivo es demasiado grande. Máximo ${maxFileSize}MB`
    }
    
    if (imageFiles.length >= maxImages) {
      return `Máximo ${maxImages} imágenes permitidas`
    }
    
    return null
  }

  const processImage = async (
    file: File,
    options: {
      quality: number
      maxWidth: number
      format: 'image/webp' | 'image/jpeg' | 'image/png'
      rotate?: number
      cropSquare?: boolean
    }
  ): Promise<{ blob: Blob; width: number; height: number }> => {
    const arrayBuffer = await file.arrayBuffer()
    let imgBitmap: ImageBitmap | null = null
    try {
      imgBitmap = await createImageBitmap(new Blob([arrayBuffer]))
    } catch {
      imgBitmap = null
    }

    const img = document.createElement('img')
    const dataUrl = URL.createObjectURL(new Blob([arrayBuffer]))
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Error al cargar la imagen'))
      img.src = dataUrl
    })
    URL.revokeObjectURL(dataUrl)

    const originalWidth = imgBitmap?.width ?? img.naturalWidth
    const originalHeight = imgBitmap?.height ?? img.naturalHeight

    const rotate = options.rotate ?? 0
    const cropSquare = options.cropSquare ?? false

    let targetW = Math.min(options.maxWidth, originalWidth)
    let targetH = Math.round((originalHeight / originalWidth) * targetW)

    let sx = 0, sy = 0, sWidth = originalWidth, sHeight = originalHeight
    if (cropSquare) {
      const side = Math.min(originalWidth, originalHeight)
      sx = Math.floor((originalWidth - side) / 2)
      sy = Math.floor((originalHeight - side) / 2)
      sWidth = side
      sHeight = side
      targetW = Math.min(options.maxWidth, side)
      targetH = targetW
    }

    const rotated = (Math.round(rotate) % 360 + 360) % 360
    const willRotate = rotated === 90 || rotated === 270
    const canvas = document.createElement('canvas')
    canvas.width = willRotate ? targetH : targetW
    canvas.height = willRotate ? targetW : targetH
    const ctx = canvas.getContext('2d')!

    if (rotated) {
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rotated * Math.PI) / 180)
      ctx.translate(-canvas.height / 2, -canvas.width / 2)
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      img,
      sx,
      sy,
      sWidth,
      sHeight,
      0,
      0,
      willRotate ? targetH : targetW,
      willRotate ? targetW : targetH
    )

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob(
        (b) => resolve(b as Blob),
        options.format,
        options.format === 'image/png' ? undefined : Math.min(Math.max(options.quality, 0.1), 1)
      )
    )
    return { blob, width: canvas.width, height: canvas.height }
  }

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: File[] = []
    let errorMessage = ''

    for (const file of fileArray) {
      const validation = validateFile(file)
      if (validation) {
        errorMessage = validation
        break
      }
      validFiles.push(file)
    }

    if (errorMessage) {
      setError(errorMessage)
      return
    }

    setError(null)

    const preparedFiles: ImageFile[] = []
    for (const file of validFiles) {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
      const { blob } = await processImage(file, {
        quality,
        maxWidth,
        format: outputFormat,
        rotate: 0,
        cropSquare: defaultCropSquare,
      })
      const processedFile = new File([blob], file.name.replace(/\.(jpe?g|png|webp)$/i, '') + (outputFormat === 'image/webp' ? '.webp' : outputFormat === 'image/jpeg' ? '.jpg' : '.png'), { type: outputFormat })
      const url = URL.createObjectURL(processedFile)
      preparedFiles.push({
        id,
        file: processedFile,
        originalFile: file,
        url,
        name: processedFile.name,
        size: processedFile.size,
        type: processedFile.type,
        isUploading: true,
        uploadProgress: 0,
        isMain: imageFiles.length === 0 && !images.length,
        rotate: 0,
        cropSquare: defaultCropSquare,
      })
    }

    setImageFiles(prev => [...prev, ...preparedFiles])

    for (const imageFile of preparedFiles) {
      await simulateUpload(imageFile.id)
    }
  }

  const simulateUpload = async (imageId: string) => {
    const updateProgress = (progress: number) => {
      setImageFiles(prev => prev.map(img => 
        img.id === imageId 
          ? { ...img, uploadProgress: progress }
          : img
      ))
    }

    // Simular progreso de carga
    for (let progress = 0; progress <= 100; progress += 10) {
      updateProgress(progress)
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Marcar como completado
    setImageFiles(prev => prev.map(img => 
      img.id === imageId 
        ? { ...img, isUploading: false, uploadProgress: 100 }
        : img
    ))

    // Actualizar la lista de URLs
    const currentFile = imageFiles.find(img => img.id === imageId)
    if (currentFile) {
      onImagesChange([...(images ?? []), currentFile.url])
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files)
    }
  }

  const removeImage = (imageId: string) => {
    const imageToRemove = imageFiles.find(img => img.id === imageId)
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.url)
      setImageFiles(prev => prev.filter(img => img.id !== imageId))
      onImagesChange((images ?? []).filter(url => url !== imageToRemove.url))
    }
  }

  const setMainImage = (imageId: string) => {
    setImageFiles(prev => prev.map(img => ({
      ...img,
      isMain: img.id === imageId
    })))
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Imágenes del Producto
          </CardTitle>
          <CardDescription>
            Sube hasta {maxImages} imágenes. Máximo {maxFileSize}MB por imagen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Zona de carga */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all shadow-sm bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 ${
              dragActive 
                ? 'border-primary ring-2 ring-primary/20' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:shadow-md'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="flex justify-center">
                <Upload className="h-12 w-12 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium">
                  Arrastra y suelta imágenes aquí
                </p>
                <p className="text-muted-foreground">
                  o haz clic para seleccionar archivos
                </p>
              </div>
              <Button onClick={openFileDialog} variant="outline" className="rounded-full px-5">
                <FileImage className="h-4 w-4 mr-2" />
                Seleccionar Imágenes
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedTypes.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />

          {error && (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Vista principal */}
          {imageFiles.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Vista Principal</h4>
              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-black/5">
                <div className="aspect-video">
                  <img
                    src={(imageFiles.find(i => i.isMain)?.url) || imageFiles[0].url}
                    alt={(imageFiles.find(i => i.isMain)?.name) || imageFiles[0].name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3 flex items-center justify-between">
                  <Badge className="bg-white/90 text-slate-900 dark:bg-slate-800/80 dark:text-slate-100">Imagen principal</Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="rounded-full" onClick={() => openFileDialog()} aria-label="Cambiar imagen principal">
                      <FileImage className="h-4 w-4 mr-2" />Cambiar
                    </Button>
                    <Button size="sm" variant="secondary" className="rounded-full" onClick={() => {
                      const current = imageFiles.find(i => i.isMain) || imageFiles[0]
                      if (!current) return
                      const a = document.createElement('a')
                      a.href = current.url
                      a.download = current.name
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                    }} aria-label="Descargar imagen principal">
                      <Download className="h-4 w-4 mr-2" />Descargar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lista de imágenes */}
          {imageFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Imágenes Cargadas ({imageFiles.length})</h4>
                <Badge variant="outline">
                  {imageFiles.filter(img => !img.isUploading).length} / {imageFiles.length} completadas
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {imageFiles.map((imageFile) => (
                  <Card key={imageFile.id} className="relative overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-square relative">
                      <img
                        src={imageFile.url}
                        alt={imageFile.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      
                      {imageFile.isMain && (
                        <Badge className="absolute top-2 left-2">
                          Principal
                        </Badge>
                      )}

                      {imageFile.isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="text-center text-white space-y-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                            <p className="text-sm">{imageFile.uploadProgress}%</p>
                          </div>
                        </div>
                      )}

                      {!imageFile.isUploading && (
                        <div className="absolute top-2 right-2 flex gap-1">
                          {!imageFile.isMain && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setMainImage(imageFile.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Camera className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              setImageFiles(prev => prev.map(img => img.id === imageFile.id ? { ...img, rotate: ((img.rotate ?? 0) + 90) % 360 } : img))
                              const current = imageFiles.find(i => i.id === imageFile.id)
                              if (current) {
                                const { blob } = await processImage(current.originalFile, {
                                  quality,
                                  maxWidth,
                                  format: outputFormat,
                                  rotate: ((current.rotate ?? 0) + 90) % 360,
                                  cropSquare: current.cropSquare,
                                })
                                URL.revokeObjectURL(current.url)
                                const processedFile = new File([blob], current.name, { type: outputFormat })
                                const newUrl = URL.createObjectURL(processedFile)
                                setImageFiles(prev => prev.map(img => img.id === imageFile.id ? { ...img, file: processedFile, url: newUrl } : img))
                              }
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <RotateCw className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              setImageFiles(prev => prev.map(img => img.id === imageFile.id ? { ...img, cropSquare: !img.cropSquare } : img))
                              const current = imageFiles.find(i => i.id === imageFile.id)
                              if (current) {
                                const { blob } = await processImage(current.originalFile, {
                                  quality,
                                  maxWidth,
                                  format: outputFormat,
                                  rotate: current.rotate,
                                  cropSquare: !current.cropSquare,
                                })
                                URL.revokeObjectURL(current.url)
                                const processedFile = new File([blob], current.name, { type: outputFormat })
                                const newUrl = URL.createObjectURL(processedFile)
                                setImageFiles(prev => prev.map(img => img.id === imageFile.id ? { ...img, file: processedFile, url: newUrl } : img))
                              }
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Crop className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const a = document.createElement('a')
                              a.href = imageFile.url
                              a.download = imageFile.name
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeImage(imageFile.id)}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium truncate">
                          {imageFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(imageFile.size)}
                        </p>
                        {imageFile.isUploading && (
                          <Progress value={imageFile.uploadProgress} className="h-1" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Información adicional */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Formatos soportados: JPEG, PNG, WebP</p>
            <p>• Tamaño máximo por imagen: {maxFileSize}MB</p>
            <p>• Máximo {maxImages} imágenes por producto</p>
            <p>• La primera imagen será la imagen principal</p>
          </div>
        </CardContent>
      </Card>
      {/* Botón fijo para añadir imagen */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={openFileDialog}
          className="rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-6 h-auto"
          aria-label="Añadir imagen"
          title="Añadir imagen"
        >
          <FileImage className="h-5 w-5 mr-2" />
          Añadir imagen
        </Button>
      </div>
    </div>
  )
}
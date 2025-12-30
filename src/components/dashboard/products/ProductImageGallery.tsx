'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ZoomIn, 
  Download,
  Upload,
  Trash2,
  ImageIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductImageGalleryProps {
  images: string[]
  productName: string
  onImageAdd?: () => void
  onImageDelete?: (index: number) => void
  onImageReorder?: (fromIndex: number, toIndex: number) => void
  editable?: boolean
}

export function ProductImageGallery({
  images,
  productName,
  onImageAdd,
  onImageDelete,
  onImageReorder,
  editable = false
}: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const hasImages = images && images.length > 0
  const currentImage = hasImages ? images[selectedIndex] : null

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const handleDownload = async () => {
    if (!currentImage) return
    
    try {
      const response = await fetch(currentImage)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${productName}-${selectedIndex + 1}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading image:', error)
    }
  }

  return (
    <>
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          {/* Main Image */}
          <div 
            className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 group"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            {hasImages ? (
              <>
                <motion.img
                  key={selectedIndex}
                  src={currentImage}
                  alt={`${productName} - Imagen ${selectedIndex + 1}`}
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
                {/* Overlay Controls */}
                <AnimatePresence>
                  {isHovering && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2"
                    >
                      <Button
                        size="icon"
                        variant="secondary"
                        className="rounded-full bg-white/90 hover:bg-white"
                        onClick={() => setIsFullscreen(true)}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="rounded-full bg-white/90 hover:bg-white"
                        onClick={handleDownload}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {editable && onImageDelete && (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="rounded-full bg-white/90 hover:bg-white text-red-600 hover:text-red-700"
                          onClick={() => onImageDelete(selectedIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Navigation Arrows */}
                {images.length > 1 && (
                  <>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 hover:bg-white shadow-lg"
                      onClick={handlePrevious}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 hover:bg-white shadow-lg"
                      onClick={handleNext}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </>
                )}

                {/* Image Counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 text-white text-sm rounded-full backdrop-blur-sm">
                    {selectedIndex + 1} / {images.length}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8">
                <ImageIcon className="h-24 w-24 text-gray-400 mb-4" />
                <p className="text-gray-500 font-medium mb-4">Sin imágenes</p>
                {editable && onImageAdd && (
                  <Button onClick={onImageAdd} variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Agregar Imagen
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {hasImages && images.length > 1 && (
            <div className="p-4 bg-gray-50 border-t">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    className={cn(
                      "relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all",
                      selectedIndex === index
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <img
                      src={image}
                      alt={`Miniatura ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {selectedIndex === index && (
                      <div className="absolute inset-0 bg-blue-500/10" />
                    )}
                  </button>
                ))}
                {editable && onImageAdd && (
                  <button
                    onClick={onImageAdd}
                    className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <Upload className="h-5 w-5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isFullscreen && currentImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setIsFullscreen(false)}
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 text-white hover:bg-white/10 rounded-full"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={currentImage}
              alt={`${productName} - Imagen ${selectedIndex + 1}`}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {images.length > 1 && (
              <>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrevious()
                  }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNext()
                  }}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
              <div className="px-4 py-2 bg-white/10 text-white text-sm rounded-full backdrop-blur-sm">
                {selectedIndex + 1} / {images.length}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownload()
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

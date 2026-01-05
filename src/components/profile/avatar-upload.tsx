import { useRef, useState, useCallback } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAvatarUpload } from '@/hooks/use-avatar-upload'
import { AvatarSelector } from './avatar-selector'
import { getAvatarWithFallback, isDiceBearAvatar } from '@/lib/dicebear'
import { 
  Camera, 
  Upload, 
  X, 
  RotateCw, 
  Crop, 
  Zap,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Bot,
  Image as ImageIcon,
  MoreVertical,
  Download,
  Shuffle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AvatarUploadProps {
  currentAvatarUrl?: string
  userName: string
  userId: string | null
  userEmail?: string
  onAvatarChange?: (url: string) => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function AvatarUpload({
  currentAvatarUrl,
  userName,
  userId,
  userEmail,
  onAvatarChange,
  size = 'md',
  className
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [cropSquare, setCropSquare] = useState(true)
  const [rotation, setRotation] = useState(0)
  const [quality, setQuality] = useState(90)

  const {
    isLoading,
    isProcessing,
    isUploading,
    progress,
    error,
    uploadAvatar,
    cancelUpload
  } = useAvatarUpload(userId)

  // Obtener avatar con fallback a DiceBear
  const avatarUrl = getAvatarWithFallback(
    currentAvatarUrl,
    userId || undefined,
    userEmail,
    userName
  )

  const isUsingDiceBear = isDiceBearAvatar(avatarUrl)

  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-20 w-20',
    lg: 'h-32 w-32'
  }

  const buttonSizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  }

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setShowEditor(true)

    // Reset editor state
    setCropSquare(true)
    setRotation(0)
    setQuality(90)
  }, [])

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return

    const result = await uploadAvatar(selectedFile, {
      cropSquare,
      rotate: rotation,
      quality: quality / 100
    })

    if (result.success && result.url) {
      onAvatarChange?.(result.url)
      setShowEditor(false)
      
      // Cleanup
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      setSelectedFile(null)
    }
  }, [selectedFile, cropSquare, rotation, quality, uploadAvatar, onAvatarChange, previewUrl])

  const handleDiceBearSelect = useCallback((avatarUrl: string) => {
    onAvatarChange?.(avatarUrl)
  }, [onAvatarChange])

  const downloadAvatar = useCallback(async () => {
    if (!avatarUrl) return
    
    try {
      const response = await fetch(avatarUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `avatar-${userName}-${Date.now()}.${isUsingDiceBear ? 'svg' : 'jpg'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error descargando avatar:', error)
    }
  }, [avatarUrl, userName, isUsingDiceBear])

  const handleCancel = useCallback(() => {
    cancelUpload()
    setShowEditor(false)
    
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setSelectedFile(null)
  }, [cancelUpload, previewUrl])

  const getProgressColor = () => {
    if (error) return 'bg-red-500'
    if (progress === 100) return 'bg-green-500'
    return 'bg-blue-500'
  }

  const getStatusIcon = () => {
    if (error) return <AlertCircle className="h-4 w-4 text-red-500" />
    if (progress === 100) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (isLoading) return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
    return null
  }

  return (
    <>
      <div className={cn('relative group', className)}>
        <Avatar className={sizeClasses[size]}>
          <AvatarImage 
            src={avatarUrl} 
            alt={userName}
            className="object-cover"
          />
          <AvatarFallback className="text-lg font-semibold">
            {userName?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>

        {/* Indicador de tipo de avatar */}
        {isUsingDiceBear && (
          <Badge 
            variant="secondary" 
            className="absolute -top-2 -left-2 h-5 px-1.5 text-xs"
          >
            <Bot className="h-3 w-3 mr-1" />
            AI
          </Badge>
        )}

        {/* Menú de opciones */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className={cn(
                'absolute -bottom-1 -right-1 rounded-full p-0 shadow-lg',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                buttonSizeClasses[size]
              )}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <MoreVertical className="h-3 w-3" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Camera className="h-4 w-4 mr-2" />
              Subir imagen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowAvatarSelector(true)}>
              <Bot className="h-4 w-4 mr-2" />
              Generar avatar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={downloadAvatar}>
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Progress indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <div className="text-center">
              <div className="text-white text-xs font-medium mb-1">
                {isProcessing ? 'Procesando...' : 'Subiendo...'}
              </div>
              <Progress 
                value={progress} 
                className="w-12 h-1"
                style={{ '--progress-background': getProgressColor() } as any}
              />
            </div>
          </div>
        )}

        {/* Status badge */}
        {(error || progress === 100) && (
          <div className="absolute -top-2 -right-2">
            <Badge 
              variant={error ? "destructive" : "default"}
              className="h-6 w-6 rounded-full p-0 flex items-center justify-center"
            >
              {getStatusIcon()}
            </Badge>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crop className="h-5 w-5" />
              Editar Avatar
            </DialogTitle>
            <DialogDescription>
              Personaliza tu imagen antes de subirla
            </DialogDescription>
          </DialogHeader>

          {previewUrl && (
            <div className="space-y-6">
              {/* Preview */}
              <div className="flex justify-center">
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Vista previa"
                    className={cn(
                      'w-48 h-48 object-cover border-2 border-border',
                      cropSquare ? 'rounded-full' : 'rounded-lg'
                    )}
                    style={{ 
                      transform: `rotate(${rotation}deg)`,
                      objectFit: cropSquare ? 'cover' : 'contain'
                    }}
                  />
                  {selectedFile && (
                    <Badge className="absolute -top-2 -right-2">
                      {(selectedFile.size / 1024 / 1024).toFixed(1)}MB
                    </Badge>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-4">
                {/* Crop Square */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Crop className="h-4 w-4" />
                      Recorte cuadrado
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Recorta la imagen en formato circular
                    </p>
                  </div>
                  <Switch
                    checked={cropSquare}
                    onCheckedChange={setCropSquare}
                  />
                </div>

                {/* Rotation */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <RotateCw className="h-4 w-4" />
                    Rotación: {rotation}°
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRotation(r => (r - 90 + 360) % 360)}
                    >
                      -90°
                    </Button>
                    <Slider
                      value={[rotation]}
                      onValueChange={([value]) => setRotation(value)}
                      max={360}
                      step={15}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRotation(r => (r + 90) % 360)}
                    >
                      +90°
                    </Button>
                  </div>
                </div>

                {/* Quality */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Calidad: {quality}%
                  </Label>
                  <Slider
                    value={[quality]}
                    onValueChange={([value]) => setQuality(value)}
                    min={60}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Menor tamaño</span>
                    <span>Mayor calidad</span>
                  </div>
                </div>

                {/* Progress */}
                {isLoading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        {getStatusIcon()}
                        {isProcessing ? 'Procesando imagen...' : 'Subiendo avatar...'}
                      </span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={isLoading || !selectedFile}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {isProcessing ? 'Procesando...' : 'Subiendo...'}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Subir Avatar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avatar Selector Dialog */}
      {userId && (
        <AvatarSelector
          userId={userId}
          email={userEmail}
          name={userName}
          currentAvatar={currentAvatarUrl}
          onAvatarSelect={handleDiceBearSelect}
          open={showAvatarSelector}
          onOpenChange={setShowAvatarSelector}
        />
      )}
    </>
  )
}
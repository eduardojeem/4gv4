import { useRef, useState, useCallback } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useAvatarUpload } from '@/hooks/use-avatar-upload'
import { AvatarSelector } from './avatar-selector'
import { getAvatarWithFallback, isDiceBearAvatar } from '@/lib/dicebear'
import {
  Camera,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Bot,
  Download
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
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)

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

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const result = await uploadAvatar(file, {
      cropSquare: true
    })

    if (result.success && result.url) {
      onAvatarChange?.(result.url)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [uploadAvatar, onAvatarChange])

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
      <div className={cn('flex flex-col items-center gap-3', className)}>
        <div className="relative">
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

          {isUsingDiceBear && (
            <Badge
              variant="secondary"
              className="absolute -top-2 -left-2 h-5 px-1.5 text-xs"
            >
              <Bot className="h-3 w-3 mr-1" />
              AI
            </Badge>
          )}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <div className="text-center">
                <div className="text-white text-xs font-medium mb-1">
                  {isProcessing ? 'Procesando...' : 'Subiendo...'}
                </div>
                <Progress
                  value={progress}
                  className="w-14 h-1"
                  style={{ '--progress-background': getProgressColor() } as any}
                />
              </div>
            </div>
          )}

          {(error || progress === 100) && (
            <div className="absolute -top-2 -right-2">
              <Badge
                variant={error ? 'destructive' : 'default'}
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

        <div className="flex flex-col items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Cambiar foto
              </>
            )}
          </Button>

          {userId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAvatarSelector(true)}
              disabled={isLoading}
            >
              <Bot className="h-4 w-4 mr-1" />
              Generar avatar automático
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            JPG, PNG o WebP, máximo 10MB.
          </p>

          {error && (
            <p className="text-xs text-red-500">
              {error}
            </p>
          )}

          {avatarUrl && (
            <button
              type="button"
              onClick={downloadAvatar}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              Descargar avatar
            </button>
          )}
        </div>
      </div>

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

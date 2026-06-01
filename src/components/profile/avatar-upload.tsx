import { useCallback, useRef, type CSSProperties } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useAvatarUpload } from '@/hooks/use-avatar-upload'
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Download,
  RefreshCw,
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
  onAvatarChange,
  size = 'md',
  className,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    isLoading,
    isProcessing,
    progress,
    error,
    uploadAvatar,
  } = useAvatarUpload(userId)

  const avatarUrl = currentAvatarUrl || ''

  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-20 w-20',
    lg: 'h-32 w-32',
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const result = await uploadAvatar(file, {
      cropSquare: true,
    })

    if (result.success && result.url) {
      onAvatarChange?.(result.url)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [uploadAvatar, onAvatarChange])

  const downloadAvatar = useCallback(async () => {
    if (!avatarUrl) return

    try {
      const response = await fetch(avatarUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `avatar-${userName}-${Date.now()}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error descargando avatar:', error)
    }
  }, [avatarUrl, userName])

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
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative">
        <Avatar className={sizeClasses[size]}>
          {avatarUrl && (
            <AvatarImage
              src={avatarUrl}
              alt={userName}
              className="object-cover"
            />
          )}
          <AvatarFallback className="text-lg font-semibold">
            {userName?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <div className="text-center">
              <div className="mb-1 text-xs font-medium text-white">
                {isProcessing ? 'Procesando...' : 'Subiendo...'}
              </div>
              <Progress
                value={progress}
                className="h-1 w-14"
                style={{ '--progress-background': getProgressColor() } as CSSProperties & Record<'--progress-background', string>}
              />
            </div>
          </div>
        )}

        {(error || progress === 100) && (
          <div className="absolute -right-2 -top-2">
            <Badge
              variant={error ? 'destructive' : 'default'}
              className="flex h-6 w-6 items-center justify-center rounded-full p-0"
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
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" />
              Cambiar foto
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          JPG, PNG o WebP, maximo 10MB.
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
            Descargar foto
          </button>
        )}
      </div>
    </div>
  )
}

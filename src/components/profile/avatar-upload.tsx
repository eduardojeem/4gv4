import { useCallback, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAvatarUpload } from '@/hooks/use-avatar-upload'
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Download,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AvatarUploadProps {
  currentAvatarUrl?: string
  userName: string
  userId: string | null
  userEmail?: string
  onAvatarChange?: (url: string) => void
  size?: 'sm' | 'md' | 'lg'
  compact?: boolean
  className?: string
}

export function AvatarUpload({
  currentAvatarUrl,
  userName,
  userId,
  onAvatarChange,
  size = 'md',
  compact = false,
  className,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    isLoading,
    isProcessing,
    progress,
    error,
    uploadAvatar,
    removeAvatar,
  } = useAvatarUpload(userId)

  const avatarUrl = currentAvatarUrl || ''

  const sizeClasses = {
    sm: 'h-16 w-16 text-xl',
    md: 'h-24 w-24 text-3xl',
    lg: 'h-36 w-36 text-4xl',
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

  const handleRemoveAvatar = useCallback(async () => {
    const confirmDelete = window.confirm('¿Estás seguro de que quieres eliminar tu foto de perfil?')
    if (!confirmDelete) return

    const result = await removeAvatar()
    if (result.success) {
      onAvatarChange?.('')
    }
  }, [removeAvatar, onAvatarChange])

  const downloadAvatar = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation() // Evitar gatillar click de subida
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

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div 
        className="group relative cursor-pointer rounded-full focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        <div className={cn(
          'rounded-full transition-colors',
          compact ? 'border border-border bg-card p-1' : 'bg-gradient-to-tr p-[3px] shadow-sm',
          !compact && (
          avatarUrl 
            ? "from-slate-200 via-slate-300 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 group-hover:scale-[1.02] group-hover:shadow-md group-hover:from-indigo-500 group-hover:via-purple-500 group-hover:to-pink-500" 
            : "from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 group-hover:from-indigo-400 group-hover:to-purple-500"
          )
        )}>
          <div className={cn('rounded-full bg-background', compact ? '' : 'p-[2px]')}>
            <Avatar className={cn(sizeClasses[size], "relative border border-slate-100 dark:border-slate-800")}>
              {avatarUrl && (
                <AvatarImage
                  src={avatarUrl}
                  alt={userName}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="font-semibold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                {userName?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Overlay hover para subir foto */}
        {!isLoading && (
          <div className="absolute inset-[5px] flex flex-col items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className="h-5 w-5 text-white" />
            {!compact && <span className="mt-1.5 text-[10px] font-bold tracking-wider">SUBIR FOTO</span>}
          </div>
        )}

        {/* Overlay con spinner de carga */}
        {isLoading && (
          <div className="absolute inset-[5px] flex flex-col items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-[3px]">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
            <div className="mt-1 text-center px-1">
              <span className="block text-[9px] font-bold text-slate-100 leading-none">
                {isProcessing ? 'PROCESANDO' : 'SUBIENDO'}
              </span>
              <span className="text-[10px] font-bold text-slate-300 mt-0.5 block">{progress}%</span>
            </div>
          </div>
        )}

        {/* Notificación de éxito */}
        {!isLoading && progress === 100 && (
          <div className="absolute -right-1 -top-1 animate-bounce">
            <Badge className="flex h-6 w-6 items-center justify-center rounded-full p-0 bg-green-500 border-2 border-white dark:border-slate-950">
              <CheckCircle className="h-3.5 w-3.5 text-white" />
            </Badge>
          </div>
        )}

        {/* Notificación de error */}
        {!isLoading && error && (
          <div className="absolute -right-1 -top-1">
            <Badge variant="destructive" className="flex h-6 w-6 items-center justify-center rounded-full p-0 border-2 border-white dark:border-slate-950">
              <AlertCircle className="h-3.5 w-3.5 text-white" />
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
        <div className="flex items-center gap-1.5">
          {/* Botones de acción inferior */}
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="h-8 px-3 text-xs font-semibold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            <Camera className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
            {avatarUrl ? 'Cambiar foto' : 'Agregar foto'}
          </Button>

          {avatarUrl && (
            <>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={handleRemoveAvatar}
                disabled={isLoading}
                className={cn('h-8 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/20', compact ? 'w-8 p-0' : 'px-3')}
                aria-label="Eliminar foto de perfil"
                title="Eliminar foto"
              >
                <Trash2 className={cn('h-3.5 w-3.5', !compact && 'mr-1.5')} />
                {!compact && 'Eliminar'}
              </Button>

              {!compact && <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={downloadAvatar}
                disabled={isLoading}
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Descargar foto"
              >
                <Download className="h-4 w-4" />
              </Button>}
            </>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          JPG, PNG o WebP · máximo 10 MB
        </p>

        {error && (
          <p className="text-xs font-medium text-red-500 text-center bg-red-50 dark:bg-red-950/10 px-3 py-1 rounded-full mt-1 max-w-[220px] truncate">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

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
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div 
        className="group relative cursor-pointer" 
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        {/* Borde con degradado de doble anillo */}
        <div className={cn(
          "rounded-full p-[3px] transition-all duration-500 bg-gradient-to-tr shadow-sm",
          avatarUrl 
            ? "from-slate-200 via-slate-300 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 group-hover:scale-[1.02] group-hover:shadow-md group-hover:from-indigo-500 group-hover:via-purple-500 group-hover:to-pink-500" 
            : "from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 group-hover:from-indigo-400 group-hover:to-purple-500"
        )}>
          <div className="rounded-full p-[2px] bg-background">
            <Avatar className={cn(sizeClasses[size], "relative border border-slate-100 dark:border-slate-800")}>
              {avatarUrl && (
                <AvatarImage
                  src={avatarUrl}
                  alt={userName}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
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
          <div className="absolute inset-[5px] flex flex-col items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 backdrop-blur-[2px]">
            <Camera className="h-6 w-6 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300 text-slate-100" />
            <span className="text-[10px] font-bold tracking-wider mt-1.5 text-slate-200">SUBIR FOTO</span>
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
            {avatarUrl ? 'Cambiar' : 'Elegir foto'}
          </Button>

          {avatarUrl && (
            <>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={handleRemoveAvatar}
                disabled={isLoading}
                className="h-8 px-3 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 border-red-100 dark:border-red-950/50"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Eliminar
              </Button>

              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={downloadAvatar}
                disabled={isLoading}
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Descargar foto"
              >
                <Download className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Formatos: JPG, PNG o WebP (Máx: 10MB).
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

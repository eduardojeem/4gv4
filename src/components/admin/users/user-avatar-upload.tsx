'use client'

import { useState, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Upload, X, Loader2, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserAvatarUploadProps {
    currentAvatarUrl?: string
    userName: string
    onUpload: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>
    className?: string
}

export function UserAvatarUpload({
    currentAvatarUrl,
    userName,
    onUpload,
    className
}: UserAvatarUploadProps) {
    const [isHovering, setIsHovering] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validar tipo y tamaño
        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona una imagen válida')
            return
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('La imagen no debe superar los 5MB')
            return
        }

        // Mostrar preview
        const objectUrl = URL.createObjectURL(file)
        setPreviewUrl(objectUrl)
        setIsUploading(true)

        try {
            await onUpload(file)
        } catch (error) {
            console.error('Error uploading:', error)
            setPreviewUrl(null) // Revertir preview si falla
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className={cn("relative group", className)}>
            <div
                className="relative inline-block"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <Avatar className="h-24 w-24 border-4 border-white shadow-lg cursor-pointer transition-transform group-hover:scale-105">
                    <AvatarImage src={previewUrl || currentAvatarUrl} alt={userName} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                        {userName.charAt(0).toUpperCase()}
                    </AvatarFallback>

                    {/* Overlay de carga */}
                    {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                            <Loader2 className="h-8 w-8 text-white animate-spin" />
                        </div>
                    )}

                    {/* Overlay de hover */}
                    {!isUploading && (
                        <div className={cn(
                            "absolute inset-0 bg-black/40 flex items-center justify-center rounded-full transition-opacity duration-200",
                            isHovering ? "opacity-100" : "opacity-0"
                        )}>
                            <Camera className="h-8 w-8 text-white" />
                        </div>
                    )}
                </Avatar>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isUploading}
                />

                <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-0 right-0 rounded-full shadow-md h-8 w-8 border-2 border-white"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                >
                    <Upload className="h-4 w-4" />
                </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-2 text-center">
                Click para cambiar imagen<br />
                (Max 5MB)
            </p>
        </div>
    )
}

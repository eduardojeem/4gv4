'use client'

import { useState } from 'react'
import { AvatarUpload } from './avatar-upload'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Zap, 
  Image, 
  Crop, 
  RotateCw, 
  Compress,
  CheckCircle,
  Clock,
  FileImage
} from 'lucide-react'

export function AvatarUploadDemo() {
  const [currentAvatar, setCurrentAvatar] = useState('/avatars/01.svg')

  const features = [
    {
      icon: <Zap className="h-5 w-5 text-yellow-500" />,
      title: 'Procesamiento en Web Worker',
      description: 'No bloquea la interfaz durante el procesamiento'
    },
    {
      icon: <Image className="h-5 w-5 text-blue-500" />,
      title: 'Preview Instantáneo',
      description: 'Vista previa inmediata antes de procesar'
    },
    {
      icon: <Crop className="h-5 w-5 text-green-500" />,
      title: 'Editor Avanzado',
      description: 'Recorte, rotación y ajuste de calidad'
    },
    {
      icon: <Compress className="h-5 w-5 text-purple-500" />,
      title: 'Compresión Inteligente',
      description: 'Optimización automática a WebP con calidad ajustable'
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-emerald-500" />,
      title: 'Validación Completa',
      description: 'Verificación de tipo, tamaño y dimensiones'
    },
    {
      icon: <Clock className="h-5 w-5 text-orange-500" />,
      title: 'Progreso en Tiempo Real',
      description: 'Indicadores visuales de procesamiento y subida'
    }
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-6 w-6" />
            Avatar Upload Optimizado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Demo del componente */}
          <div className="flex flex-col items-center space-y-4">
            <AvatarUpload
              currentAvatarUrl={currentAvatar}
              userName="Usuario Demo"
              userId="demo-user"
              onAvatarChange={setCurrentAvatar}
              size="lg"
            />
            <p className="text-sm text-muted-foreground text-center">
              Haz clic en el ícono de cámara para probar la subida optimizada
            </p>
          </div>

          {/* Características */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                {feature.icon}
                <div>
                  <h4 className="font-medium text-sm">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Especificaciones técnicas */}
          <div className="space-y-3">
            <h4 className="font-semibold">Especificaciones Técnicas:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Badge variant="outline">Máx. 10MB</Badge>
              <Badge variant="outline">WebP Output</Badge>
              <Badge variant="outline">512x512px</Badge>
              <Badge variant="outline">90% Calidad</Badge>
            </div>
          </div>

          {/* Formatos soportados */}
          <div className="space-y-3">
            <h4 className="font-semibold">Formatos Soportados:</h4>
            <div className="flex flex-wrap gap-2">
              <Badge>JPG/JPEG</Badge>
              <Badge>PNG</Badge>
              <Badge>WebP</Badge>
              <Badge>GIF</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
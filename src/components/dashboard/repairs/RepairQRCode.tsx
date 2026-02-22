/**
 * Componente para mostrar el código QR de una reparación
 * Útil para mostrar en la interfaz de administración
 */

'use client'

import { useState } from 'react'
import { QrCode, Copy, Download, ExternalLink, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { generateQRCodeURL, generateRepairTrackingURL, generateRepairHash } from '@/lib/repair-qr'

interface RepairQRCodeProps {
  ticketNumber: string
  customerName: string
  createdAt: Date | string
  size?: number
}

export function RepairQRCode({ 
  ticketNumber, 
  customerName, 
  createdAt,
  size = 200 
}: RepairQRCodeProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  
  const date = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  const hash = generateRepairHash(ticketNumber, customerName, date)
  const trackingURL = generateRepairTrackingURL(ticketNumber, hash)
  const qrURL = generateQRCodeURL(ticketNumber, customerName, date, size)

  const handleCopyURL = () => {
    navigator.clipboard.writeText(trackingURL)
    toast.success('URL copiada al portapapeles')
  }

  const handleCopyHash = () => {
    navigator.clipboard.writeText(hash)
    toast.success('Hash copiado al portapapeles')
  }

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(qrURL)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `QR-${ticketNumber}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('QR descargado correctamente')
    } catch (error) {
      toast.error('Error al descargar el QR')
    }
  }

  const handleOpenURL = () => {
    window.open(trackingURL, '_blank')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Código QR de Seguimiento
        </CardTitle>
        <CardDescription>
          Escanea este código para rastrear la reparación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Image */}
        <div className="flex justify-center">
          <div className="relative">
            {!imageLoaded && (
              <div 
                className="flex items-center justify-center bg-muted rounded-lg animate-pulse"
                style={{ width: size, height: size }}
              >
                <QrCode className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            <img
              src={qrURL}
              alt={`QR Code for ${ticketNumber}`}
              width={size}
              height={size}
              className={`rounded-lg border-2 border-border shadow-sm ${imageLoaded ? 'block' : 'hidden'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageLoaded(true)
                toast.error('Error al cargar el QR')
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyURL}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copiar URL
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadQR}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Descargar
          </Button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleOpenURL}
          className="w-full gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir página de seguimiento
        </Button>

        {/* Hash Info */}
        <div className="rounded-lg bg-muted p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Hash de verificación
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyHash}
              className="h-6 px-2"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <code className="block text-xs font-mono text-foreground break-all">
            {hash}
          </code>
        </div>

        {/* Info Badge */}
        <div className="flex items-center justify-center">
          <Badge variant="secondary" className="gap-1.5">
            <Shield className="h-3 w-3" />
            Verificación criptográfica habilitada
          </Badge>
        </div>

        {/* URL Preview */}
        <div className="text-xs text-muted-foreground text-center break-all">
          {trackingURL}
        </div>
      </CardContent>
    </Card>
  )
}

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  User, Phone, Mail, MapPin, Calendar, Wrench, 
  Smartphone, Tablet, Laptop, Monitor, AlertCircle, 
  DollarSign, Clock, FileText, Image as ImageIcon,
  Edit, Trash, Printer, Package as PackageIcon, CheckCircle,
  Maximize2, Minimize2, Share2, MessageCircle, Copy
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { toast } from 'sonner'
import { Repair } from '@/types/repairs'
import { statusConfig, priorityConfig, urgencyConfig, deviceTypeConfig } from '@/config/repair-constants'
import { cn } from '@/lib/utils'
import { PatternDrawer } from './PatternDrawer'
import { printRepairReceipt, generateRepairShareText, RepairPrintPayload } from '@/lib/repair-receipt'

interface RepairDetailDialogProps {
  open: boolean
  repair: Repair | null
  onClose: () => void
  onEdit?: (repair: Repair) => void
}

export function RepairDetailDialog({
  open,
  repair,
  onClose,
  onEdit
}: RepairDetailDialogProps) {
  const [isMaximized, setIsMaximized] = useState(false)

  if (!repair) return null

  const StatusIcon = statusConfig[repair.status]?.icon || AlertCircle
  const DeviceIcon = deviceTypeConfig[repair.deviceType]?.icon || Smartphone

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Pendiente'
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy - h:mm a", { locale: es })
    } catch (e) {
      return 'Fecha inválida'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount)
  }

  const getPrintPayload = (): RepairPrintPayload => {
    if (!repair) throw new Error("No repair")
    return {
      ticketNumber: repair.ticketNumber || repair.id.slice(0, 8).toUpperCase(),
      date: new Date(repair.createdAt),
      priority: repair.priority,
      urgency: repair.urgency,
      customer: {
        name: repair.customer.name,
        customerCode: repair.customer.customerCode,
        phone: repair.customer.phone,
        email: repair.customer.email,
        address: (repair.customer as any).address,
        city: (repair.customer as any).city,
        country: (repair.customer as any).country,
        document: (repair.customer as any).document,
      },
      devices: [{
        typeLabel: deviceTypeConfig[repair.deviceType]?.label || repair.deviceType,
        brand: repair.brand,
        model: repair.model,
        issue: repair.issue,
        description: repair.description,
        technician: repair.technician?.name || 'Sin asignar',
        estimatedCost: repair.estimatedCost,
        ticketNumber: repair.ticketNumber || repair.id.slice(0, 8).toUpperCase()
      }]
    }
  }

  const handlePrint = (type: 'customer' | 'technician') => {
    if (!repair) return
    const payload = getPrintPayload()
    printRepairReceipt(type, payload)
  }

  const handleShare = (method: 'whatsapp' | 'copy' | 'native') => {
    if (!repair) return
    const payload = getPrintPayload()
    const shareText = generateRepairShareText(payload)

    if (method === 'whatsapp') {
      const encodedText = encodeURIComponent(shareText)
      const url = `https://wa.me/?text=${encodedText}`
      window.open(url, '_blank')
    } else if (method === 'copy') {
      navigator.clipboard.writeText(shareText)
      toast.success('Texto copiado al portapapeles')
    } else if (method === 'native') {
      if (navigator.share) {
        navigator.share({
          title: `Reparación ${payload.ticketNumber}`,
          text: shareText,
        }).catch(console.error)
      } else {
        toast.error('Tu dispositivo no soporta compartir nativo')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(
        "flex flex-col p-0 gap-0 overflow-hidden transition-all duration-300",
        isMaximized 
          ? "w-[98vw] max-w-[98vw] h-[98vh]" 
          : "max-w-6xl h-[90vh]"
      )}>
        <DialogHeader className="p-6 pb-2 bg-muted/20 border-b shrink-0">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-background">
                  {repair.ticketNumber || `ID: ${repair.id.slice(0, 8)}`}
                </Badge>
                <Badge className={cn(priorityConfig[repair.priority].color)}>
                  Prioridad {priorityConfig[repair.priority].label}
                </Badge>
                {repair.urgency === 'urgent' && (
                  <Badge className={cn(urgencyConfig[repair.urgency].color)}>
                    {urgencyConfig[repair.urgency].label}
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <DeviceIcon className="h-6 w-6 text-muted-foreground" />
                {repair.device}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 text-sm">
                <StatusIcon className="h-4 w-4" />
                <span className="font-medium text-foreground">
                  {statusConfig[repair.status]?.label || repair.status}
                </span>
                <span className="text-muted-foreground">•</span>
                <span>{repair.brand} {repair.model}</span>
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" title="Imprimir">
                    <Printer className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handlePrint('customer')}>
                    Comprobante Cliente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrint('technician')}>
                    Ficha Técnica
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? "Restaurar tamaño" : "Maximizar"}
              >
                {isMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(repair)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <span className="sr-only">Cerrar</span>
                {/* Close icon is handled by DialogContent default but we can add custom if needed */}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 pt-2 border-b bg-muted/20">
            <TabsList className="bg-transparent h-auto p-0 gap-6">
              <TabsTrigger 
                value="info" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1"
              >
                Información
              </TabsTrigger>
              <TabsTrigger 
                value="diagnostic" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1"
              >
                Diagnóstico
              </TabsTrigger>
              <TabsTrigger 
                value="finance" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1"
              >
                Costos y Piezas
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1"
              >
                Historial y Notas
              </TabsTrigger>
              <TabsTrigger 
                value="images" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1"
              >
                Imágenes ({repair.images?.length || 0})
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 bg-background w-full">
            <ScrollBar orientation="horizontal" />
            <div className="p-6 min-w-full">
              {/* Información General */}
              <TabsContent value="info" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cliente */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Información del Cliente
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-lg space-y-3 border">
                      <div className="flex items-start gap-3">
                        <User className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="font-medium">{repair.customer.name}</p>
                          <p className="text-xs text-muted-foreground">Cliente Registrado</p>
                        </div>
                      </div>
                      {repair.customer.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{repair.customer.phone}</p>
                        </div>
                      )}
                      {repair.customer.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{repair.customer.email}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fechas y Técnico */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Detalles del Servicio
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-lg space-y-3 border">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Recibido:
                        </span>
                        <span className="font-medium">{formatDate(repair.createdAt)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Estimado:
                        </span>
                        <span className="font-medium">{formatDate(repair.estimatedCompletion)}</span>
                      </div>
                      {repair.completedAt && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" /> Completado:
                          </span>
                          <span className="font-medium text-green-600">{formatDate(repair.completedAt)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex items-center gap-3 pt-1">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Técnico Asignado</p>
                          <p className="text-sm text-muted-foreground">
                            {repair.technician?.name || 'Sin asignar'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Diagnóstico */}
              <TabsContent value="diagnostic" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Problema Reportado</h3>
                      <div className="bg-muted/30 p-4 rounded-lg border min-h-[100px]">
                        <p className="text-sm leading-relaxed">{repair.issue}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Descripción Detallada</h3>
                      <div className="bg-muted/30 p-4 rounded-lg border min-h-[100px]">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {repair.description || 'Sin descripción detallada.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Seguridad y Acceso</h3>
                    <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-1">Tipo de Acceso</p>
                        <Badge variant="outline" className="capitalize">
                          {repair.accessType || 'Ninguno'}
                        </Badge>
                      </div>

                      {repair.accessType === 'pattern' && repair.accessPassword && (
                        <div>
                          <p className="text-sm font-medium mb-2">Patrón de Desbloqueo</p>
                          <div className="w-fit mx-auto bg-background rounded-lg p-2">
                             <PatternDrawer 
                               value={repair.accessPassword} 
                               onChange={() => {}} 
                               disabled={true} 
                               minimal={true}
                             />
                          </div>
                        </div>
                      )}

                      {repair.accessType !== 'pattern' && repair.accessType !== 'none' && repair.accessPassword && (
                        <div>
                          <p className="text-sm font-medium mb-1">Contraseña / PIN</p>
                          <code className="bg-background px-2 py-1 rounded border text-sm font-mono block w-full">
                            {repair.accessPassword}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Costos y Piezas */}
              <TabsContent value="finance" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Resumen Financiero */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Resumen de Costos
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Mano de Obra:</span>
                        <span className="font-medium">{formatCurrency(repair.laborCost || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Costo de Piezas:</span>
                        <span className="font-medium">
                          {formatCurrency(
                            (repair.parts || []).reduce((acc, part) => acc + (part.cost * part.quantity), 0)
                          )}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium">Costo Estimado:</span>
                        <span className="font-medium">{formatCurrency(repair.estimatedCost || 0)}</span>
                      </div>
                      <div className="bg-primary/10 p-2 rounded flex justify-between items-center mt-2">
                        <span className="font-bold text-primary">Total Final:</span>
                        <span className="font-bold text-primary text-lg">
                          {repair.finalCost ? formatCurrency(repair.finalCost) : '---'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Piezas */}
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <PackageIcon className="h-5 w-5 text-primary" />
                      Piezas y Refacciones
                    </h3>
                    {(!repair.parts || repair.parts.length === 0) ? (
                      <div className="bg-muted/20 border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                        No hay piezas registradas para esta reparación.
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 text-muted-foreground font-medium">
                            <tr>
                              <th className="px-4 py-3 text-left">Pieza</th>
                              <th className="px-4 py-3 text-center">Cant.</th>
                              <th className="px-4 py-3 text-right">Costo Unit.</th>
                              <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {repair.parts.map((part, index) => (
                              <tr key={index} className="bg-background">
                                <td className="px-4 py-3">
                                  <div className="font-medium">{part.name}</div>
                                  <div className="text-xs text-muted-foreground">{part.partNumber}</div>
                                </td>
                                <td className="px-4 py-3 text-center">{part.quantity}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(part.cost)}</td>
                                <td className="px-4 py-3 text-right font-medium">
                                  {formatCurrency(part.cost * part.quantity)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Historial y Notas */}
              <TabsContent value="history" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Notas de la Reparación
                  </h3>
                  
                  {(!repair.notes || repair.notes.length === 0) ? (
                    <div className="bg-muted/20 border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                      No hay notas registradas.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {repair.notes.map((note, index) => (
                        <div key={index} className="flex gap-4 p-4 bg-muted/30 rounded-lg border">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="space-y-1 flex-1">
                            <div className="flex justify-between items-start">
                              <span className="font-medium text-sm">{note.author}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(note.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/90">{note.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Imágenes */}
              <TabsContent value="images" className="mt-0 space-y-6">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    Galería de Imágenes
                  </h3>
                </div>

                {(!repair.images || repair.images.length === 0) ? (
                  <div className="bg-muted/20 border border-dashed rounded-lg p-12 text-center text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No hay imágenes adjuntas a esta reparación.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {repair.images.map((image, index) => (
                      <div key={index} className="group relative aspect-square rounded-lg overflow-hidden border bg-muted">
                        <img 
                          src={image.url} 
                          alt={image.description || `Imagen ${index + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button variant="secondary" size="sm" asChild>
                            <a href={image.url} target="_blank" rel="noopener noreferrer">
                              Ver Completa
                            </a>
                          </Button>
                        </div>
                        {image.description && (
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-white text-xs truncate">
                            {image.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
        
        <DialogFooter className="p-4 border-t bg-background flex justify-between sm:justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Share2 className="h-4 w-4" />
                Compartir
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('copy')}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar Texto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('native')}>
                <Share2 className="mr-2 h-4 w-4" />
                Otras apps
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {onEdit && (
            <Button onClick={() => onEdit(repair)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

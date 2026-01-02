'use client'

import React, { useState } from 'react'
import { motion  } from '../../ui/motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Users,
  Trash2,
  Edit,
  Mail,
  MessageSquare,
  Tag,
  AlertTriangle,
  CheckCircle,
  X,
  Download
} from 'lucide-react'
import { Customer } from '@/hooks/use-customer-state'

interface BatchOperationsProps {
  selectedCustomers: Customer[]
  isOpen: boolean
  onClose: () => void
  onOperationComplete: (operation: string, count: number) => void
}

type BatchOperation = 'delete' | 'update' | 'email' | 'sms' | 'tag' | 'export'

export const BatchOperations: React.FC<BatchOperationsProps> = ({
  selectedCustomers,
  isOpen,
  onClose,
  onOperationComplete
}) => {
  const [selectedOperation, setSelectedOperation] = useState<BatchOperation | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedCount, setProcessedCount] = useState(0)
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Estados para diferentes operaciones
  const [updateFields, setUpdateFields] = useState({
    status: '',
    segment: '',
    notes: ''
  })
  const [messageContent, setMessageContent] = useState('')
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('#3b82f6')

  const operations = [
    {
      id: 'delete' as BatchOperation,
      title: 'Eliminar Clientes',
      description: 'Eliminar permanentemente los clientes seleccionados',
      icon: Trash2,
      color: 'destructive',
      dangerous: true
    },
    {
      id: 'update' as BatchOperation,
      title: 'Actualizar Información',
      description: 'Actualizar campos específicos de los clientes',
      icon: Edit,
      color: 'default'
    },
    {
      id: 'email' as BatchOperation,
      title: 'Enviar Email',
      description: 'Enviar email masivo a los clientes seleccionados',
      icon: Mail,
      color: 'default'
    },
    {
      id: 'sms' as BatchOperation,
      title: 'Enviar SMS',
      description: 'Enviar SMS masivo a los clientes seleccionados',
      icon: MessageSquare,
      color: 'default'
    },
    {
      id: 'tag' as BatchOperation,
      title: 'Agregar Etiqueta',
      description: 'Agregar etiqueta a los clientes seleccionados',
      icon: Tag,
      color: 'default'
    },
    {
      id: 'export' as BatchOperation,
      title: 'Exportar Selección',
      description: 'Exportar solo los clientes seleccionados',
      icon: Download,
      color: 'default'
    }
  ]

  const handleOperationSelect = (operation: BatchOperation) => {
    setSelectedOperation(operation)
    if (operation === 'delete') {
      setShowConfirmation(true)
    }
  }

  const executeOperation = async () => {
    if (!selectedOperation) return

    setIsProcessing(true)
    setProcessedCount(0)

    // Simular procesamiento
    for (let i = 0; i < selectedCustomers.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 100))
      setProcessedCount(i + 1)
    }

    // Simular la operación específica
    switch (selectedOperation) {
      case 'delete':
        console.log('Eliminando clientes:', selectedCustomers.map(c => c.id))
        break
      case 'update':
        console.log('Actualizando clientes:', updateFields)
        break
      case 'email':
        console.log('Enviando emails:', messageContent)
        break
      case 'sms':
        console.log('Enviando SMS:', messageContent)
        break
      case 'tag':
        console.log('Agregando etiqueta:', tagName, tagColor)
        break
      case 'export':
        console.log('Exportando clientes seleccionados')
        break
    }

    setIsProcessing(false)
    onOperationComplete(selectedOperation, selectedCustomers.length)
    
    setTimeout(() => {
      onClose()
      resetState()
    }, 1500)
  }

  const resetState = () => {
    setSelectedOperation(null)
    setShowConfirmation(false)
    setProcessedCount(0)
    setUpdateFields({ status: '', segment: '', notes: '' })
    setMessageContent('')
    setTagName('')
    setTagColor('#3b82f6')
  }

  const renderOperationForm = () => {
    switch (selectedOperation) {
      case 'update':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">Estado</Label>
              <Select value={updateFields.status} onValueChange={(value) => 
                setUpdateFields(prev => ({ ...prev, status: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="segment">Segmento</Label>
              <Select value={updateFields.segment} onValueChange={(value) => 
                setUpdateFields(prev => ({ ...prev, segment: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="new">Nuevo</SelectItem>
                  <SelectItem value="returning">Recurrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Agregar notas..."
                value={updateFields.notes}
                onChange={(e) => setUpdateFields(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
        )

      case 'email':
      case 'sms':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="message">Mensaje</Label>
              <Textarea
                id="message"
                placeholder={`Escribir ${selectedOperation === 'email' ? 'email' : 'SMS'}...`}
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={4}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Se enviará a {selectedCustomers.length} cliente{selectedCustomers.length !== 1 ? 's' : ''}
            </div>
          </div>
        )

      case 'tag':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="tagName">Nombre de la Etiqueta</Label>
              <input
                id="tagName"
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Nombre de la etiqueta"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tagColor">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="tagColor"
                  type="color"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                  className="w-12 h-8 rounded border"
                />
                <Badge style={{ backgroundColor: tagColor, color: 'white' }}>
                  {tagName || 'Etiqueta'}
                </Badge>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (showConfirmation && selectedOperation === 'delete') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Eliminación
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente {selectedCustomers.length} cliente{selectedCustomers.length !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-destructive/10 p-4 rounded-lg">
              <p className="text-sm font-medium">Clientes a eliminar:</p>
              <div className="mt-2 space-y-1">
                {selectedCustomers.slice(0, 3).map(customer => (
                  <div key={customer.id} className="text-sm">
                    {customer.name} - {customer.email}
                  </div>
                ))}
                {selectedCustomers.length > 3 && (
                  <div className="text-sm text-muted-foreground">
                    y {selectedCustomers.length - 3} más...
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="confirm" />
              <Label htmlFor="confirm" className="text-sm">
                Entiendo que esta acción es irreversible
              </Label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConfirmation(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={executeOperation}>
                Eliminar {selectedCustomers.length} Cliente{selectedCustomers.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Operaciones en Lote
          </DialogTitle>
          <DialogDescription>
            {selectedCustomers.length} cliente{selectedCustomers.length !== 1 ? 's' : ''} seleccionado{selectedCustomers.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {isProcessing ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-medium">Procesando...</div>
              <div className="text-sm text-muted-foreground">
                {processedCount} de {selectedCustomers.length} completados
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                className="bg-blue-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(processedCount / selectedCustomers.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {processedCount === selectedCustomers.length && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center text-green-600"
              >
                <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                <div className="font-medium">¡Operación completada!</div>
              </motion.div>
            )}
          </div>
        ) : !selectedOperation ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {operations.map((operation) => {
                const Icon = operation.icon
                return (
                  <Card
                    key={operation.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      operation.dangerous ? 'border-destructive/20 hover:border-destructive/40' : ''
                    }`}
                    onClick={() => handleOperationSelect(operation.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${
                          operation.dangerous ? 'text-destructive' : 'text-primary'
                        }`} />
                        <div>
                          <div className={`font-medium ${
                            operation.dangerous ? 'text-destructive' : ''
                          }`}>
                            {operation.title}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {operation.description}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">Clientes Seleccionados:</h4>
              <ScrollArea className="h-32 border rounded-md p-2">
                <div className="space-y-1">
                  {selectedCustomers.map(customer => (
                    <div key={customer.id} className="flex items-center justify-between text-sm">
                      <span>{customer.name}</span>
                      <span className="text-muted-foreground">{customer.email}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedOperation(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <h3 className="font-medium">
                {operations.find(op => op.id === selectedOperation)?.title}
              </h3>
            </div>

            <Separator />

            {renderOperationForm()}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSelectedOperation(null)}>
                Atrás
              </Button>
              <Button onClick={executeOperation}>
                Ejecutar Operación
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
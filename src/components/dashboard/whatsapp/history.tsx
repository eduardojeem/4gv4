'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { History, Search, Trash2, MessageCircle, Calendar, User, Phone } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface WhatsAppMessage {
  id: number
  phone: string
  message: string
  timestamp: string
  type: 'manual' | 'auto' | 'bulk'
}

export function WhatsAppHistory() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = () => {
    const history = JSON.parse(localStorage.getItem('whatsapp_history') || '[]')
    setMessages(history)
  }

  const clearHistory = () => {
    if (confirm('¿Estás seguro de que quieres borrar todo el historial?')) {
      localStorage.removeItem('whatsapp_history')
      setMessages([])
    }
  }

  const deleteMessage = (id: number) => {
    const updated = messages.filter(m => m.id !== id)
    localStorage.setItem('whatsapp_history', JSON.stringify(updated))
    setMessages(updated)
  }

  const filteredMessages = messages.filter(m =>
    m.phone.includes(searchTerm) ||
    m.message.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'manual': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'auto': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'bulk': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'manual': return 'Manual'
      case 'auto': return 'Automático'
      case 'bulk': return 'Masivo'
      default: return type
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Mensajes
            </CardTitle>
            <CardDescription>
              Registro de todos los mensajes enviados por WhatsApp
            </CardDescription>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearHistory}
            disabled={messages.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpiar Historial
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por teléfono o mensaje..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{messages.length}</p>
                  <p className="text-xs text-muted-foreground">Total Enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {messages.filter(m => {
                      const date = new Date(m.timestamp)
                      const today = new Date()
                      return date.toDateString() === today.toDateString()
                    }).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Hoy</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {new Set(messages.map(m => m.phone)).size}
                  </p>
                  <p className="text-xs text-muted-foreground">Clientes Únicos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">No hay mensajes en el historial</p>
            <p className="text-sm text-muted-foreground">
              Los mensajes enviados aparecerán aquí
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Mensaje</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(msg.timestamp), {
                        addSuffix: true,
                        locale: es
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{msg.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm truncate">{msg.message}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getTypeColor(msg.type)}>
                        {getTypeLabel(msg.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMessage(msg.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

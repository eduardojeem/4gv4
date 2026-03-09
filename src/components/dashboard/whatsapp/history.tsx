'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { History, Search, Trash2, MessageCircle, Calendar, User, Phone, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import {
  clearDashboardWhatsAppHistory,
  DashboardWhatsAppMessage,
  DashboardWhatsAppSource,
  DashboardWhatsAppStatus,
  deleteDashboardWhatsAppMessage,
  fetchDashboardWhatsAppMessages,
  notifyDashboardWhatsAppUpdated,
  subscribeDashboardWhatsAppUpdates,
} from '@/lib/dashboard-whatsapp-api'

type SourceFilter = DashboardWhatsAppSource | 'all'
type StatusFilter = DashboardWhatsAppStatus | 'all'

export function WhatsAppHistory() {
  const [messages, setMessages] = useState<DashboardWhatsAppMessage[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(false)

  const debouncedSearch = useDebounce(searchTerm, 300)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchDashboardWhatsAppMessages({
        limit: 500,
        search: debouncedSearch || undefined,
        source: sourceFilter,
        status: statusFilter,
      })
      setMessages(data)
    } catch (error) {
      console.error('WhatsApp history load error:', error)
      toast.error('No se pudo cargar el historial')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, sourceFilter, statusFilter])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    return subscribeDashboardWhatsAppUpdates(loadHistory)
  }, [loadHistory])

  const clearHistory = async () => {
    if (!confirm('Estas seguro de que quieres borrar todo el historial?')) {
      return
    }

    try {
      await clearDashboardWhatsAppHistory()
      setMessages([])
      notifyDashboardWhatsAppUpdated()
      toast.success('Historial eliminado')
    } catch (error) {
      console.error('WhatsApp clear history error:', error)
      toast.error('No se pudo limpiar el historial')
    }
  }

  const deleteMessage = async (id: string) => {
    try {
      await deleteDashboardWhatsAppMessage(id)
      setMessages((prev) => prev.filter((message) => message.id !== id))
      notifyDashboardWhatsAppUpdated()
    } catch (error) {
      console.error('WhatsApp delete message error:', error)
      toast.error('No se pudo eliminar el mensaje')
    }
  }

  const filteredMessages = useMemo(() => messages, [messages])

  const getTypeColor = (type: DashboardWhatsAppSource) => {
    switch (type) {
      case 'manual':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'auto':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'bulk':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getTypeLabel = (type: DashboardWhatsAppSource) => {
    switch (type) {
      case 'manual':
        return 'Manual'
      case 'auto':
        return 'Automatico'
      case 'bulk':
        return 'Masivo'
      default:
        return type
    }
  }

  const getStatusLabel = (status: DashboardWhatsAppStatus) => {
    switch (status) {
      case 'sent':
        return 'Enviado'
      case 'failed':
        return 'Fallido'
      case 'pending':
        return 'Pendiente'
      default:
        return status
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Mensajes
            </CardTitle>
            <CardDescription>
              Registro centralizado de todos los mensajes enviados por WhatsApp
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refrescar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={clearHistory}
              disabled={messages.length === 0 || loading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpiar Historial
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por telefono, nombre o mensaje..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as SourceFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="bulk">Masivo</SelectItem>
                <SelectItem value="auto">Automatico</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="failed">Fallido</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{messages.length}</p>
                  <p className="text-xs text-muted-foreground">Registros Cargados</p>
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
                    {
                      messages.filter((message) => {
                        const date = new Date(message.sent_at)
                        return date.toDateString() === new Date().toDateString()
                      }).length
                    }
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
                  <p className="text-2xl font-bold">{new Set(messages.map((message) => message.phone)).size}</p>
                  <p className="text-xs text-muted-foreground">Contactos Unicos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">Cargando historial...</div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">No hay mensajes para los filtros actuales</p>
            <p className="text-sm text-muted-foreground">Ajusta filtros o envia nuevos mensajes</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Mensaje</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(message.sent_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{message.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm truncate">{message.message}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getTypeColor(message.source)}>
                        {getTypeLabel(message.source)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          message.status === 'sent' ? 'default' : message.status === 'failed' ? 'destructive' : 'secondary'
                        }
                      >
                        {getStatusLabel(message.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => deleteMessage(message.id)}>
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

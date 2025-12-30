"use client"

import React, { useState, useMemo } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  Send, 
  Paperclip, 
  Smile,
  MoreVertical,
  Search,
  Filter,
  Archive,
  Star,
  Clock,
  CheckCheck,
  MessageCircle
} from "lucide-react"
import { Customer } from "@/hooks/use-customer-state"
import { toast } from "sonner"

interface Message {
  id: string
  type: 'whatsapp' | 'email' | 'sms' | 'call'
  direction: 'inbound' | 'outbound'
  content: string
  timestamp: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  attachments?: string[]
}

interface CommunicationCenterProps {
  customer: Customer
  onClose?: () => void
}

export function CommunicationCenter({ customer, onClose }: CommunicationCenterProps) {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email' | 'sms'>('whatsapp')
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Debounce search to improve performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Mock message history
  const [messages] = useState<Message[]>([
    {
      id: '1',
      type: 'whatsapp',
      direction: 'inbound',
      content: 'Hola, tengo una pregunta sobre mi pedido',
      timestamp: '2024-01-15T10:30:00Z',
      status: 'read'
    },
    {
      id: '2',
      type: 'whatsapp',
      direction: 'outbound',
      content: 'Hola! Por supuesto, ¿en qué puedo ayudarte?',
      timestamp: '2024-01-15T10:32:00Z',
      status: 'read'
    },
    {
      id: '3',
      type: 'email',
      direction: 'outbound',
      content: 'Gracias por tu compra. Adjunto encontrarás la factura.',
      timestamp: '2024-01-14T15:20:00Z',
      status: 'delivered',
      attachments: ['factura_001.pdf']
    },
    {
      id: '4',
      type: 'sms',
      direction: 'outbound',
      content: 'Tu pedido #12345 ha sido enviado. Tracking: ABC123',
      timestamp: '2024-01-13T09:15:00Z',
      status: 'delivered'
    }
  ])

  const filteredMessages = useMemo(() => 
    messages.filter(msg => 
      msg.type === activeTab && 
      msg.content.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    ), [messages, activeTab, debouncedSearchTerm]
  )

  const handleSendMessage = async () => {
    if (!message.trim()) return

    setSending(true)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const newMessage: Message = {
        id: Date.now().toString(),
        type: activeTab,
        direction: 'outbound',
        content: message,
        timestamp: new Date().toISOString(),
        status: 'sent'
      }

      // In a real app, this would update the messages state
      toast.success(`Mensaje enviado por ${activeTab.toUpperCase()}`)
      setMessage('')
      setSubject('')
      
    } catch (error) {
      toast.error('Error al enviar mensaje')
    } finally {
      setSending(false)
    }
  }

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'whatsapp': return <MessageCircle className="h-4 w-4 text-green-600" />
      case 'email': return <Mail className="h-4 w-4 text-blue-600" />
      case 'sms': return <MessageSquare className="h-4 w-4 text-purple-600" />
      default: return <MessageSquare className="h-4 w-4" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Clock className="h-3 w-3 text-gray-500" />
      case 'delivered': return <CheckCheck className="h-3 w-3 text-blue-500" />
      case 'read': return <CheckCheck className="h-3 w-3 text-green-500" />
      case 'failed': return <Clock className="h-3 w-3 text-red-500" />
      default: return null
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={customer.avatar} />
              <AvatarFallback>
                {customer.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{customer.name}</CardTitle>
              <CardDescription>{customer.email}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Star className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1 flex flex-col">
          <div className="px-6 pb-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                SMS
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Search Bar */}
          <div className="px-6 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en conversación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <TabsContent value="whatsapp" className="flex-1 flex flex-col mt-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-lg p-3 ${
                      msg.direction === 'outbound' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-muted'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      {msg.attachments && (
                        <div className="mt-2 space-y-1">
                          {msg.attachments.map((attachment, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                              <Paperclip className="h-3 w-3" />
                              {attachment}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs opacity-70">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                        {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="email" className="flex-1 flex flex-col mt-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getMessageIcon(msg.type)}
                        <span className="font-medium">
                          {msg.direction === 'outbound' ? 'Enviado' : 'Recibido'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                        {getStatusIcon(msg.status)}
                      </div>
                    </div>
                    <p className="text-sm">{msg.content}</p>
                    {msg.attachments && (
                      <div className="mt-2 space-y-1">
                        {msg.attachments.map((attachment, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            <Paperclip className="h-3 w-3 mr-1" />
                            {attachment}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="sms" className="flex-1 flex flex-col mt-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-lg p-3 ${
                      msg.direction === 'outbound' 
                        ? 'bg-purple-500 text-white' 
                        : 'bg-muted'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs opacity-70">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                        {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Message Input */}
          <div className="border-t p-6">
            <div className="space-y-3">
              {activeTab === 'email' && (
                <Input
                  placeholder="Asunto del email..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              )}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Textarea
                    placeholder={`Escribir ${activeTab === 'email' ? 'email' : 'mensaje'}...`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-xs text-muted-foreground">
                  {activeTab === 'whatsapp' && customer.phone && (
                    <span>Enviando a: {customer.phone}</span>
                  )}
                  {activeTab === 'email' && (
                    <span>Enviando a: {customer.email}</span>
                  )}
                  {activeTab === 'sms' && customer.phone && (
                    <span>Enviando a: {customer.phone}</span>
                  )}
                </div>
                <Button 
                  onClick={handleSendMessage}
                  disabled={!message.trim() || sending}
                  size="sm"
                >
                  {sending ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  )
}
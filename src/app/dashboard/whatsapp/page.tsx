'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageCircle, Send, History, Settings, BarChart3, Users } from 'lucide-react'
import { WhatsAppSendMessage } from '@/components/dashboard/whatsapp/send-message'
import { WhatsAppHistory } from '@/components/dashboard/whatsapp/history'
import { WhatsAppTemplates } from '@/components/dashboard/whatsapp/templates'
import { WhatsAppStats } from '@/components/dashboard/whatsapp/stats'
import { WhatsAppSettings } from '@/components/dashboard/whatsapp/settings'
import { WhatsAppBulkSend } from '@/components/dashboard/whatsapp/bulk-send'

export default function WhatsAppDashboardPage() {
  const [activeTab, setActiveTab] = useState('send')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10">
              <MessageCircle className="h-6 w-6 text-[#25D366]" />
            </div>
            WhatsApp Business
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona la comunicacion con tus clientes por WhatsApp
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 h-auto">
          <TabsTrigger value="send" className="gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Enviar</span>
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Masivo</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Historial</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Plantillas</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Estadisticas</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configuracion</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-4">
          <WhatsAppSendMessage />
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4">
          <WhatsAppBulkSend />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <WhatsAppHistory />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <WhatsAppTemplates />
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <WhatsAppStats />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <WhatsAppSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}

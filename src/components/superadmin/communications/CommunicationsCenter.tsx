'use client'

import { useRouter } from 'next/navigation'
import { Bell, Mail, MessagesSquare, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatCard } from '@/components/superadmin/StatCard'
import { Notice, PageHeader } from '@/components/superadmin/ui/page-header'
import type { CommunicationsData } from '@/lib/superadmin/communications'
import { AnnouncementsPanel } from './AnnouncementsPanel'
import { MessagesPanel } from './MessagesPanel'
import { EmailSetupPanel } from './EmailSetupPanel'

export type CommunicationsTab = 'announcements' | 'messages' | 'email'

export function CommunicationsCenter({ data, initialTab }: { data: CommunicationsData; initialTab: CommunicationsTab }) {
  const router = useRouter()
  const published = data.announcements.filter((a) => a.status === 'sent').length
  const scheduled = data.announcements.filter((a) => a.status === 'scheduled').length
  const messagesTotal = data.channelStats.reduce((sum, s) => sum + s.sent + s.failed, 0)
  const missingEmail = data.emailChecks.filter((c) => c.critical && !c.configured)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MessagesSquare}
        title="Comunicaciones"
        description="Avisos que la plataforma muestra en el panel de las tiendas, historial de emails y WhatsApp enviados, y la configuración del correo."
        actions={<Button variant="outline" size="sm" onClick={() => router.refresh()}><RefreshCw className="h-4 w-4" /> Actualizar</Button>}
      />

      {data.loadErrors.length > 0 && <Notice tone="error">{data.loadErrors.join(' · ')}</Notice>}
      {missingEmail.length > 0 && (
        <Notice tone="warning">Falta configuración de email: {missingEmail.map((c) => c.label).join(', ')}. Revisalo en la pestaña Email.</Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Avisos publicados" value={published} sub="visibles en las tiendas" icon={Bell} />
        <StatCard label="Programados" value={scheduled} sub="esperando su hora" icon={Send} tone={scheduled ? 'info' : 'default'} />
        <StatCard label="Mensajes registrados" value={messagesTotal} sub="email, WhatsApp y SMS" icon={Mail} />
        <StatCard label="Fallidos (7 días)" value={data.failedLast7Days} sub="envíos que no salieron" icon={Mail} tone={data.failedLast7Days ? 'danger' : 'success'} />
      </div>

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="announcements">Avisos a tiendas</TabsTrigger>
          <TabsTrigger value="messages">Mensajes enviados</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>
        <TabsContent value="announcements">
          <AnnouncementsPanel announcements={data.announcements} organizations={data.organizations} />
        </TabsContent>
        <TabsContent value="messages">
          <MessagesPanel messages={data.messages} channelStats={data.channelStats} />
        </TabsContent>
        <TabsContent value="email">
          <EmailSetupPanel checks={data.emailChecks} templates={data.templates} supabaseProjectRef={data.supabaseProjectRef} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

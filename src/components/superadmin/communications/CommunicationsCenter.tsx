'use client'

import { useTransition } from 'react'
import { useUrlListState } from '@/hooks/useUrlListState'
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
  const [refreshing,startRefresh] = useTransition()
  const {state,setValue} = useUrlListState({tab:'announcements'})
  const tab = ['announcements','messages','email'].includes(state.tab) ? state.tab : initialTab
  const published = data.announcements.filter((a) => a.status === 'sent').length
  const scheduled = data.announcements.filter((a) => a.status === 'scheduled').length
  const messagesTotal = data.channelStats.reduce((sum, s) => sum + s.sent + s.failed + (s.pending ?? 0) + (s.other ?? 0), 0)
  const missingEmail = data.emailChecks.filter((c) => c.critical && !c.configured)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MessagesSquare}
        title="Comunicaciones"
        description="Avisos que la plataforma muestra en el panel de las tiendas, historial de emails y WhatsApp enviados, y la configuración del correo."
        actions={<Button variant="outline" size="sm" disabled={refreshing} onClick={() => startRefresh(()=>router.refresh())}><RefreshCw className="h-4 w-4" /> {refreshing ? 'Actualizando…' : 'Actualizar'}</Button>}
      />

      {data.loadErrors.length > 0 && <Notice tone="error">{data.loadErrors.join(' · ')}</Notice>}
      {missingEmail.length > 0 && (
        <Notice tone="warning">Falta configuración de email: {missingEmail.map((c) => c.label).join(', ')}. Revisalo en Configuración de email.</Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Avisos publicados" value={published} sub="en la muestra de 300 avisos" icon={Bell} />
        <StatCard label="Programados" value={scheduled} sub="en la muestra de 300 avisos" icon={Send} tone={scheduled ? 'info' : 'default'} />
        <StatCard label="Mensajes registrados" value={messagesTotal} sub="últimos 500 registros" icon={Mail} />
        <StatCard label="Fallidos (7 días)" value={data.failedLast7Days ?? 'No disponible'} sub="envíos que no salieron" icon={Mail} tone={data.failedLast7Days === null ? 'default' : data.failedLast7Days ? 'danger' : 'success'} />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">Los avisos internos aparecen en la campana de las tiendas. El historial muestra intentos de envío; “Enviado” no confirma la entrega. Los fallidos de 7 días se consultan sobre todo el historial.</p>
      <Tabs value={tab} onValueChange={value=>setValue('tab',value)} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger className="min-h-11 min-w-0 whitespace-normal px-2 py-3 text-xs sm:text-sm" value="announcements">Avisos internos</TabsTrigger>
          <TabsTrigger value="messages">Historial de envíos</TabsTrigger>
          <TabsTrigger value="email">Configuración de email</TabsTrigger>
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

'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, MessageCircle, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type SourceType = 'purchase' | 'repair'
type Customer = { name?: string; email?: string | null; phone?: string | null }
type EligibleSource = {
  id: string
  code?: string | null
  ticket_number?: string | null
  device_brand?: string | null
  device_model?: string | null
  created_at?: string | null
  delivered_at?: string | null
  customers?: Customer | Customer[] | null
}

function getCustomer(source: EligibleSource): Customer | null {
  if (Array.isArray(source.customers)) return source.customers[0] ?? null
  return source.customers ?? null
}

export function ReviewRequestDialog({
  open,
  onOpenChange,
  publicUrl,
  storeName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  publicUrl: string
  storeName: string
}) {
  const [sourceType, setSourceType] = useState<SourceType>('purchase')
  const [sources, setSources] = useState<EligibleSource[]>([])
  const [sourceId, setSourceId] = useState('')
  const [verifiedUrl, setVerifiedUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSourceId('')
    setVerifiedUrl('')
    fetch(`/api/admin/reviews/invitations?type=${sourceType}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setSources(data.data ?? [])
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las experiencias.'))
      .finally(() => setLoading(false))
  }, [open, sourceType])

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Enlace copiado')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  async function createVerifiedLink() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/reviews/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_type: sourceType, source_id: sourceId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo crear el enlace.')
      setVerifiedUrl(data.data.url)
      toast.success('Enlace verificado creado por 30 días')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el enlace.')
    } finally {
      setLoading(false)
    }
  }

  function shareWhatsApp(url: string) {
    const text = `¡Hola! Gracias por elegir ${storeName}. Nos gustaría conocer tu opinión honesta sobre tu experiencia: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Solicitar una opinión</DialogTitle>
          <DialogDescription>Pedí una opinión honesta. La puntuación nunca condiciona su publicación.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border p-4">
            <p className="text-sm font-semibold">Enlace general</p>
            <p className="mt-1 text-xs text-muted-foreground">Se mostrará como “Opinión abierta”.</p>
            <div className="mt-3 flex gap-2">
              <Input readOnly value={publicUrl} className="font-mono text-xs" />
              <Button variant="outline" size="icon" aria-label="Copiar enlace general" onClick={() => void copy(publicUrl)}><Copy className="h-4 w-4" /></Button>
              <Button size="icon" aria-label="Compartir enlace general por WhatsApp" onClick={() => shareWhatsApp(publicUrl)}><MessageCircle className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" />Enlace de experiencia verificada</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Sólo aparece para ventas completadas o reparaciones entregadas y se puede usar una vez.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Select value={sourceType} onValueChange={(value: SourceType) => setSourceType(value)}>
                <SelectTrigger aria-label="Tipo de experiencia"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Compra verificada</SelectItem>
                  <SelectItem value="repair">Reparación verificada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceId} onValueChange={setSourceId} disabled={loading || sources.length === 0}>
                <SelectTrigger aria-label="Experiencia del cliente"><SelectValue placeholder={loading ? 'Cargando…' : 'Seleccionar experiencia'} /></SelectTrigger>
                <SelectContent>
                  {sources.map((source) => {
                    const customer = getCustomer(source)
                    const label = sourceType === 'purchase'
                      ? `${source.code || 'Venta'} · ${customer?.name || 'Cliente'}`
                      : `${source.ticket_number || 'Reparación'} · ${source.device_brand || ''} ${source.device_model || ''} · ${customer?.name || 'Cliente'}`
                    return <SelectItem key={source.id} value={source.id}>{label}</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
            <Button className="mt-3" size="sm" disabled={!sourceId || loading} onClick={() => void createVerifiedLink()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Crear enlace verificado
            </Button>

            {verifiedUrl && (
              <div className="mt-4 rounded-lg border bg-background p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Check className="h-4 w-4" />Enlace válido por 30 días</p>
                <div className="mt-2 flex gap-2">
                  <Input readOnly value={verifiedUrl} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" aria-label="Copiar enlace verificado" onClick={() => void copy(verifiedUrl)}><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" aria-label="Compartir enlace verificado por WhatsApp" onClick={() => shareWhatsApp(verifiedUrl)}><MessageCircle className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bug, Lightbulb, Loader2, MessageSquarePlus, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const KINDS = [
  { value: 'bug', label: 'Un error', icon: Bug },
  { value: 'idea', label: 'Una idea', icon: Lightbulb },
  { value: 'praise', label: 'Algo que funciona bien', icon: ThumbsUp },
] as const

type Kind = (typeof KINDS)[number]['value']

/** Botón del header que reemplaza a la guía: el usuario cuenta qué falla, qué falta o qué le gusta. */
export function FeedbackButton({ className }: { className?: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('bug')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message, pagePath: pathname ?? undefined, source: 'web' }),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        setError(payload?.error || 'No se pudo enviar el comentario.')
        return
      }
      toast.success('¡Gracias! Recibimos tu comentario.')
      setMessage('')
      setKind('bug')
      setOpen(false)
    } catch {
      setError('No se pudo conectar. Revisá tu conexión y probá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-9 w-9 shrink-0', className)}
        onClick={() => setOpen(true)}
        aria-label="Enviar comentarios"
        title="Enviar comentarios"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={(next) => { if (!sending) setOpen(next) }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Enviar comentarios</DialogTitle>
              <DialogDescription>Informá de un error, sugerí una idea o contanos qué funciona bien.</DialogDescription>
            </DialogHeader>

            <div role="radiogroup" aria-label="Tipo de comentario" className="grid grid-cols-3 gap-2">
              {KINDS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => setKind(value)}
                  disabled={sending}
                  className={cn(
                    'flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors',
                    kind === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <Textarea
              value={message}
              onChange={(event) => { setMessage(event.target.value); setError(null) }}
              placeholder={kind === 'bug' ? '¿Qué pasó y qué esperabas que pase?' : kind === 'idea' ? '¿Qué te gustaría que haga el sistema?' : '¿Qué es lo que más te sirve?'}
              aria-label="Comentario"
              maxLength={2000}
              rows={5}
              disabled={sending}
              required
            />

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={sending}>Cancelar</Button>
              <Button type="submit" disabled={sending || message.trim().length < 3}>
                {sending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Enviar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

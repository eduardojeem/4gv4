'use client'

import {
  BadgeCheck,
  CircleHelp,
  ClipboardCheck,
  Eye,
  MessageSquareReply,
  Send,
  ShieldCheck,
  ShoppingBag,
  Star,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const FLOW_STEPS = [
  {
    title: 'Solicitar',
    detail: 'Elegí una venta terminada o una reparación entregada y compartí el enlace único con ese cliente.',
    icon: Send,
  },
  {
    title: 'Recibir',
    detail: 'La opinión entra como pendiente. El sistema conserva su origen y no la publica automáticamente.',
    icon: Star,
  },
  {
    title: 'Moderar',
    detail: 'Revisá el contenido con la misma regla para todas las calificaciones y decidí si se publica.',
    icon: ClipboardCheck,
  },
  {
    title: 'Responder',
    detail: 'Publicá una respuesta oficial para agradecer, aclarar o explicar cómo resolviste un problema.',
    icon: MessageSquareReply,
  },
]

const REVIEW_TYPES = [
  {
    title: 'Opinión abierta',
    detail: 'Cualquier visitante puede enviarla desde la página pública. Se muestra sin sello de verificación.',
    example: 'Ejemplo: Diego visitó el local y comenta sobre la atención recibida.',
    icon: Eye,
    tone: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50',
  },
  {
    title: 'Compra verificada',
    detail: 'El enlace nace de una venta completada y sólo puede utilizarse una vez.',
    example: 'Ejemplo: Laura compró una camiseta y califica el producto, el talle y la entrega.',
    icon: ShoppingBag,
    tone: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20',
  },
  {
    title: 'Reparación verificada',
    detail: 'El enlace corresponde a un equipo entregado y confirma que existió esa atención.',
    example: 'Ejemplo: Carlos retiró su teléfono reparado y comenta sobre el plazo y el resultado.',
    icon: Wrench,
    tone: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20',
  },
]

export function ReviewsHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2 sm:w-auto">
          <CircleHelp className="h-4 w-4" />
          Cómo funciona
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cómo funciona la reputación del negocio</DialogTitle>
          <DialogDescription>
            Convertí experiencias reales en confianza pública sin modificar lo que escribió el cliente.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3" aria-labelledby="reviews-flow-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="reviews-flow-heading" className="text-sm font-semibold">Flujo recomendado</h3>
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Trazable y transparente
            </Badge>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW_STEPS.map(({ title, detail, icon: Icon }, index) => (
              <li key={title} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Paso {index + 1}</p>
                    <h4 className="text-sm font-semibold">{title}</h4>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3 border-t pt-4" aria-labelledby="review-types-heading">
          <h3 id="review-types-heading" className="text-sm font-semibold">Qué significa cada procedencia</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {REVIEW_TYPES.map(({ title, detail, example, icon: Icon, tone }) => (
              <article key={title} className={`rounded-lg border p-3 ${tone}`}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <h4 className="text-sm font-semibold">{title}</h4>
                  {title !== 'Opinión abierta' && <BadgeCheck className="ml-auto h-4 w-4 text-emerald-600" aria-label="Verificada" />}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>
                <p className="mt-2 text-xs font-medium leading-relaxed">{example}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 border-t pt-4 md:grid-cols-2" aria-label="Ejemplos de moderación y respuesta">
          <article className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Moderá el contenido, no la calificación</h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li><strong className="text-foreground">Publicá aunque tenga pocas estrellas</strong> si describe una experiencia real y respetuosa.</li>
              <li><strong className="text-foreground">Rechazá solamente contenido ofensivo</strong>, spam, datos personales o textos ajenos al negocio.</li>
              <li><strong className="text-foreground">Ocultá temporalmente</strong> si necesitás investigar una denuncia o proteger información sensible.</li>
            </ul>
          </article>

          <article className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Respondé con contexto y una solución</h3>
            <div className="mt-3 space-y-3 text-xs leading-relaxed">
              <blockquote className="rounded-md bg-muted p-3 text-muted-foreground">
                “Gracias, Laura. Nos alegra que el talle haya sido el correcto y que recibieras tu pedido a tiempo.”
              </blockquote>
              <blockquote className="rounded-md bg-muted p-3 text-muted-foreground">
                “Sentimos que la entrega haya demorado. Ya ajustamos la coordinación y queremos revisar tu caso por privado.”
              </blockquote>
            </div>
          </article>
        </section>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Regla de confianza:</strong> solicitá una opinión honesta después de cada experiencia. La respuesta del negocio se identifica por separado y no cambia las estrellas ni el comentario del cliente.
        </div>
      </DialogContent>
    </Dialog>
  )
}

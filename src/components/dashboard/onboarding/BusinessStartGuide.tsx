'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useBusinessStartGuide, type BusinessStartGuidePayload } from '@/hooks/use-business-start-guide'
import { FirstOperationGuide } from './FirstOperationGuide'
import { isStartGuideComplete } from '@/lib/onboarding/start-guide'

export function BusinessStartGuide() {
  const { enabled, data, error, loading, saving, refresh, savePreferences } = useBusinessStartGuide()
  if (!enabled) return null
  if (!data) return <section className="rounded-xl border bg-card p-4" aria-label="Preparación del negocio">
    <h2 className="font-semibold">Preparar mi negocio</h2>
    {error ? <div role="alert" className="mt-2 space-y-2 text-sm"><p>{error}</p><Button variant="outline" onClick={() => void refresh()}>Reintentar</Button></div> : <p className="mt-2 text-sm text-muted-foreground">Comprobando datos guardados…</p>}
  </section>
  const { guide, preferences } = data
  const checklist = data.setupChecklist && data.setupChecklist.percent < 100 ? data.setupChecklist : null
  // Con todo lo obligatorio listo, la guía no vuelve a aparecer en el panel.
  if (isStartGuideComplete(guide)) return checklist ? <SetupChecklist checklist={checklist} /> : null
  if (preferences.postponed) return <div className="space-y-4">{checklist && <SetupChecklist checklist={checklist} />}<section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
    <p className="text-sm">Tu guía de preparación sigue disponible.</p>
    <Button variant="outline" disabled={saving || loading} onClick={() => void savePreferences({ ...preferences, postponed: false })}>Continuar preparación</Button>
    {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
  </section></div>
  const next = guide.tasks.find(task => task.id === guide.nextTaskId)
  const operationKind = guide.tasks.some(task => task.id === 'first-reservation') ? 'reservation' : guide.tasks.some(task => task.id === 'first-repair') ? 'repair' : guide.tasks.some(task => task.id === 'first-sale') ? 'sale' : null
  return <div className="space-y-4">
    {checklist && <SetupChecklist checklist={checklist} />}
    <section className="space-y-4 rounded-xl border border-primary/30 bg-card p-4 sm:p-5" aria-label="Preparación del negocio">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Preparar mi negocio</h2><p className="text-sm text-muted-foreground">{guide.completed} de {guide.total} requisitos aplicables listos. Las recomendaciones opcionales no bloquean el comienzo.</p></div>
      <Button variant="ghost" disabled={saving || loading} onClick={() => void savePreferences({ ...preferences, postponed: true })}>Continuar después</Button>
    </header>
    <p className="text-sm">{guide.completed === guide.total && guide.total > 0 ? 'Preparación básica lista. La primera operación se comprueba por separado.' : 'Siguiente paso: completá los datos pendientes, sin necesidad de publicar tu web.'}</p>
    {next && <Link aria-label={`Siguiente paso: ${next.label}`} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground" href={next.href}>{next.label}</Link>}
    <label className="block space-y-1 text-sm"><span>¿Trabajás solo o con equipo?</span><select aria-label="Forma de trabajar con el equipo" className="block min-h-11 w-full rounded-md border bg-background px-3 text-base sm:max-w-sm" value={preferences.teamMode ?? ''} disabled={saving || loading} onChange={event => void savePreferences({ ...preferences, teamMode: event.target.value === 'team' ? 'team' : event.target.value === 'solo' ? 'solo' : null })}><option value="">Elegir después</option><option value="solo">Trabajo solo</option><option value="team">Trabajo con equipo</option></select></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer font-medium">Ver todas las tareas y su estado</summary><ul className="mt-2 space-y-3">{guide.tasks.map(task => <li key={task.id} className="rounded-md bg-muted/40 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><Link className="font-medium underline underline-offset-4" href={task.href}>{task.label}</Link><span>{task.state === 'ready' ? 'Comprobado' : task.state === 'unknown' ? 'No se pudo comprobar' : 'Pendiente'}{!task.required && ' · Opcional'}</span></div><p className="mt-1 text-muted-foreground">{task.description}</p></li>)}</ul></details>
    <p className="text-sm">{guide.operationMilestones.sale === true ? 'Primera venta completada. ' : ''}{guide.operationMilestones.reservation === true ? 'Primera reserva registrada; reservar no significa cobrar. ' : ''}{guide.operationMilestones.repair === true ? 'Primera reparación recibida. ' : ''}{guide.operationMilestones.service === true ? 'Primer servicio marcado como atendido. ' : ''}</p>
    {data.limitations.length > 0 && <details className="rounded-lg bg-muted p-3 text-sm"><summary className="min-h-11 cursor-pointer font-medium">Qué todavía no se puede comprobar</summary><ul className="list-disc space-y-1 pl-5">{data.limitations.map(message => <li key={message}>{message}</li>)}</ul></details>}
    {operationKind && <FirstOperationGuide kind={operationKind} />}
    <Button variant="outline" disabled={loading || saving} onClick={() => void refresh()}>Comprobar avance</Button>
    </section>
  </div>
}

function SetupChecklist({ checklist }: { checklist: NonNullable<BusinessStartGuidePayload['setupChecklist']> }) {
  return (
    <section aria-label="Lista opcional de configuración" className="rounded-lg border border-border/60 bg-muted/20">
      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium">Tu negocio, cada vez más completo</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Detalles opcionales para cuando tengas tiempo.</p>
          </div>
          <span aria-label={`${checklist.percent}% configurado`} className="shrink-0 text-xs tabular-nums text-muted-foreground">{checklist.percent}%</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-muted-foreground group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div className="space-y-3 border-t border-border/60 px-4 py-3">
          <p className="text-xs text-muted-foreground">Podés seguir usando el sistema. Este recordatorio desaparece al completar los pasos.</p>
          {checklist.needsCountryConfirmation && <p className="text-sm">Confirmá el país de tu negocio. <Link className="underline underline-offset-4" href="/admin/settings#fiscal">Revisar país</Link></p>}
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {checklist.items.filter(item => item.key !== 'country' || checklist.needsCountryConfirmation).map(item => (
              <li key={item.key}>
                <Link href={item.href} className="flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span aria-hidden="true" className={item.done ? 'text-muted-foreground' : 'text-primary'}>{item.done ? '✓' : '○'}</span>
                  <span className={item.done ? 'text-muted-foreground' : undefined}>{item.label}<span className="sr-only">{item.done ? ': completado' : ': pendiente'}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </section>
  )
}

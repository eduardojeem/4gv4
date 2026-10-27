'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useBusinessStartGuide, type BusinessStartGuidePayload } from '@/hooks/use-business-start-guide'
import { FirstOperationGuide } from './FirstOperationGuide'

export function BusinessStartGuide() {
  const { enabled, data, error, loading, saving, refresh, savePreferences } = useBusinessStartGuide()
  if (!enabled) return null
  if (!data) return <section className="rounded-xl border bg-card p-4" aria-label="Preparación del negocio">
    <h2 className="font-semibold">Preparar mi negocio</h2>
    {error ? <div role="alert" className="mt-2 space-y-2 text-sm"><p>{error}</p><Button variant="outline" onClick={() => void refresh()}>Reintentar</Button></div> : <p className="mt-2 text-sm text-muted-foreground">Comprobando datos guardados…</p>}
  </section>
  const { guide, preferences } = data
  const checklist = data.setupChecklist
  if (preferences.postponed) return <div className="space-y-4"><SetupChecklist checklist={checklist} /><section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
    <p className="text-sm">Tu guía de preparación sigue disponible.</p>
    <Button variant="outline" disabled={saving || loading} onClick={() => void savePreferences({ ...preferences, postponed: false })}>Continuar preparación</Button>
    {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
  </section></div>
  const next = guide.tasks.find(task => task.id === guide.nextTaskId)
  const operationKind = guide.tasks.some(task => task.id === 'first-reservation') ? 'reservation' : guide.tasks.some(task => task.id === 'first-repair') ? 'repair' : guide.tasks.some(task => task.id === 'first-sale') ? 'sale' : null
  return <div className="space-y-4">
    <SetupChecklist checklist={checklist} />
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

function SetupChecklist({ checklist }: { checklist: BusinessStartGuidePayload['setupChecklist'] }) {
  return <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="Lista opcional de configuración">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Configurá tu negocio a tu ritmo</h2><p className="text-sm text-muted-foreground">{checklist.percent}% listo · estos pasos son opcionales y no bloquean el uso del sistema.</p></div><span aria-label={`${checklist.percent}% configurado`} className="rounded-full bg-muted px-3 py-1 text-sm font-semibold">{checklist.percent}%</span></div>
    {checklist.needsCountryConfirmation && <p className="rounded-md bg-muted px-3 py-2 text-sm">Tu organización todavía no tiene país confirmado. <Link className="font-medium underline underline-offset-4" href="/admin/settings/company">Confirmar país</Link></p>}
    <details><summary className="min-h-11 cursor-pointer font-medium">Ver configuración pendiente y completada</summary><ul className="mt-2 grid gap-2 sm:grid-cols-2">{checklist.items.filter(item => item.key !== 'country' || checklist.needsCountryConfirmation).map(item => <li key={item.key} className="rounded-md border p-3 text-sm"><Link href={item.href} className="font-medium underline underline-offset-4">{item.done ? '✓ ' : '○ '}{item.label}</Link></li>)}</ul></details>
  </section>
}

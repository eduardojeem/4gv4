'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, ImageIcon, Loader2, Save, Sparkles, Store } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { type PlatformBranding } from '@/lib/platform/branding'

type SaveResponse = {
  success?: boolean
  error?: string
  branding?: PlatformBranding
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  id: keyof PlatformBranding
  label: string
  value: string
  onChange: (field: keyof PlatformBranding, value: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(id, event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </div>
  )
}

export function PlatformBrandingForm({ initial }: { initial: PlatformBranding }) {
  const [draft, setDraft] = useState<PlatformBranding>(initial)
  const [saving, setSaving] = useState(false)

  function updateField(field: keyof PlatformBranding, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)

    try {
      const response = await fetch('/api/superadmin/platform-branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branding: draft }),
      })
      const payload = await response.json().catch(() => null) as SaveResponse | null

      if (!response.ok || !payload?.success || !payload.branding) {
        throw new Error(payload?.error || 'No se pudo guardar la marca SaaS.')
      }

      setDraft(payload.branding)
      toast.success('Marca SaaS actualizada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la marca SaaS.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-xs text-slate-500">
            <Link href="/superadmin/web-content">
              <ArrowLeft className="h-3.5 w-3.5" />
              Contenido web
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Sparkles className="h-3.5 w-3.5" />
            Marca global
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Marca SaaS</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Administra el nombre, logo y textos globales que aparecen en login, landing SaaS y marketplace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href="/login" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Ver login
            </a>
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identidad SaaS</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field id="platformName" label="Nombre de plataforma" value={draft.platformName} onChange={updateField} maxLength={80} />
              <Field id="platformTagline" label="Subtitulo" value={draft.platformTagline} onChange={updateField} maxLength={140} />
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="logoUrl">Logo global URL</Label>
                <Input
                  id="logoUrl"
                  value={draft.logoUrl}
                  onChange={(event) => updateField('logoUrl', event.target.value)}
                  placeholder="https://cdn.miempresa.com/logo.svg"
                  maxLength={500}
                />
                <p className="text-xs text-slate-500">Opcional. Si esta vacio se usa el icono del sistema.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Marketplace y llamadas a accion</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field id="marketplaceName" label="Nombre marketplace" value={draft.marketplaceName} onChange={updateField} maxLength={80} />
              <Field id="marketplaceTagline" label="Subtitulo marketplace" value={draft.marketplaceTagline} onChange={updateField} maxLength={140} />
              <Field id="primaryCtaLabel" label="CTA principal" value={draft.primaryCtaLabel} onChange={updateField} maxLength={50} />
              <Field id="primaryCtaHref" label="Link CTA principal" value={draft.primaryCtaHref} onChange={updateField} maxLength={500} />
              <Field id="secondaryCtaLabel" label="CTA secundario" value={draft.secondaryCtaLabel} onChange={updateField} maxLength={50} />
              <Field id="secondaryCtaHref" label="Link CTA secundario" value={draft.secondaryCtaHref} onChange={updateField} maxLength={500} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Login y SEO</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field id="loginEyebrow" label="Etiqueta login" value={draft.loginEyebrow} onChange={updateField} maxLength={80} />
              <Field id="loginSubtitle" label="Subtitulo login" value={draft.loginSubtitle} onChange={updateField} maxLength={120} />
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="seoTitle">SEO title</Label>
                <Input id="seoTitle" value={draft.seoTitle} onChange={(event) => updateField('seoTitle', event.target.value)} maxLength={160} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="seoDescription">SEO description</Label>
                <Textarea
                  id="seoDescription"
                  value={draft.seoDescription}
                  onChange={(event) => updateField('seoDescription', event.target.value)}
                  maxLength={240}
                  className="min-h-20"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="footerText">Texto footer</Label>
                <Textarea
                  id="footerText"
                  value={draft.footerText}
                  onChange={(event) => updateField('footerText', event.target.value)}
                  maxLength={180}
                  className="min-h-20"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-slate-950 p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                    {draft.logoUrl ? (
                      <img src={draft.logoUrl} alt={draft.platformName} className="h-6 w-6 object-contain" />
                    ) : (
                      <ImageIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{draft.platformName}</p>
                    <p className="truncate text-xs text-slate-400">{draft.platformTagline}</p>
                  </div>
                </div>
                <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <p className="text-lg font-semibold">Iniciar sesion</p>
                  <p className="mt-1 text-sm text-slate-400">{draft.loginSubtitle}</p>
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600 text-white">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{draft.marketplaceName}</p>
                    <p className="text-xs text-slate-500">{draft.marketplaceTagline}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

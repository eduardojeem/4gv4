'use client'

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { Check, ChevronDown, ImagePlus, Palette, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { colorContrast, isBrandPalette, paletteColors, readableBrandAction, recommendedPalettes, type StorefrontBrandPalette } from '@/lib/website/brand-palette'
import { paletteFromLogo } from '@/lib/website/logo-palette'
import type { CompanyInfo } from '@/types/website-settings'
import { cn } from '@/lib/utils'

const FIELDS = [{ key:'primary', label:'Principal', hint:'Botones y acciones importantes.' }, { key:'accent', label:'Complementario', hint:'Destacados y separadores.' }, { key:'background', label:'Fondo', hint:'Superficies de la tienda en modo claro.' }, { key:'text', label:'Texto', hint:'Lectura sobre el fondo elegido.' }] as const
const STYLES = [{ key:'all', label:'Todos' }, { key:'elegante',label:'Elegante' }, { key:'natural',label:'Natural' }, { key:'moderno',label:'Moderno' }, { key:'calido',label:'Cálido' }, { key:'llamativo',label:'Llamativo' }]
export function StorefrontPaletteAssistant({ value, onChange, businessVertical }: { value: CompanyInfo; onChange: (patch: Partial<CompanyInfo>) => void; businessVertical?: string | null }) {
  const optionsId = useId()
  const [moreOptions, setMoreOptions] = useState(false)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<StorefrontBrandPalette>(() => paletteColors(value.brandPalette || recommendedPalettes(businessVertical)[0]))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const logoRequest = useRef(0)
  useEffect(() => () => { logoRequest.current++ }, [])
  const valid = isBrandPalette(draft)
  const palettes = recommendedPalettes(businessVertical).filter(p => filter === 'all' || p.style === filter)
  const selectedPalette = value.brandPalette ? recommendedPalettes(businessVertical).find(p => JSON.stringify(paletteColors(p)) === JSON.stringify(paletteColors(value.brandPalette!))) : null
  const apply = (palette: StorefrontBrandPalette) => { logoRequest.current++; setBusy(false); setError(''); setDraft(paletteColors(palette)); onChange({ brandPalette:paletteColors(palette), brandColor:'custom', customBrandColor:readableBrandAction(palette.primary) }) }
  const extract = async (src: string) => {
    const request = ++logoRequest.current
    setBusy(true); setError('')
    try { const palette = await paletteFromLogo(src); if (request === logoRequest.current) { setDraft(palette); setEditing(true) } }
    catch (cause) { if (request === logoRequest.current) setError(cause instanceof Error ? cause.message : 'No pudimos leer la imagen.') }
    finally { if (request === logoRequest.current) setBusy(false) }
  }
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Elegí un PNG, JPG o WebP de hasta 5 MB.'); return }
    const url = URL.createObjectURL(file)
    try { await extract(url) } finally { URL.revokeObjectURL(url) }
  }
  return <section aria-label="Asistente de paletas" className="min-w-0 space-y-3 rounded-xl border bg-muted/15 p-3 sm:p-4">
    <div className="flex items-start gap-2.5">
      <span className="rounded-lg bg-primary/10 p-1.5 text-primary"><Palette className="size-4" /></span>
      <div className="min-w-0"><h4 className="text-[13px] font-semibold">Combinaciones para tu negocio</h4><p className="mt-0.5 text-xs text-muted-foreground">Elegí una paleta; podés ajustarla después.</p></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="min-w-0 text-xs text-muted-foreground" aria-live="polite">Actual: <span className="font-medium text-foreground">{selectedPalette?.name || (value.brandPalette ? 'Personalizada' : 'Color único')}</span></p>
      <div className="flex items-center gap-2"><Label htmlFor={optionsId+'-style'} className="text-xs text-muted-foreground">Estilo</Label><select id={optionsId+'-style'} value={filter} onChange={event => { setFilter(event.target.value); setExpanded(false) }} className="h-9 max-w-36 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{STYLES.map(style => <option key={style.key} value={style.key}>{style.key === 'all' ? 'Todos los estilos' : style.label}</option>)}</select></div>
    </div>
    <div className="grid grid-cols-2 gap-2">{(expanded ? palettes : palettes.slice(0,4)).map(palette => {
      const active = value.brandPalette && JSON.stringify(paletteColors(value.brandPalette)) === JSON.stringify(paletteColors(palette))
      const recommended = Boolean(businessVertical && palette.verticals.includes(businessVertical))
      return <button key={palette.id} type="button" aria-pressed={Boolean(active)} title={palette.description} onClick={() => apply(palette)} className={cn('min-w-0 rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active && 'border-primary bg-primary/5 ring-1 ring-primary/20')}>
        <div aria-hidden="true" className="mb-2 flex h-6 overflow-hidden rounded-md border">{[palette.primary,palette.accent,palette.background,palette.text].map((color,index) => <span key={index} className="flex-1" style={{backgroundColor:color}} />)}</div>
        <span className="flex items-center justify-between gap-1.5 text-xs font-semibold"><span className="truncate">{palette.name}</span>{active && <Check className="size-3.5 shrink-0 text-primary" />}</span>
        <span className={cn('mt-1 flex min-h-4 items-center gap-1 text-[10px]', recommended ? 'text-primary' : 'text-muted-foreground')}>{recommended ? <><Sparkles className="size-3" />Para tu rubro</> : STYLES.find(style => style.key === palette.style)?.label}</span>
        <span className="sr-only">{palette.description}</span>
      </button>
    })}</div>
    {palettes.length > 4 && <Button type="button" variant="ghost" size="sm" className="h-8 w-full text-xs" aria-expanded={expanded} onClick={() => setExpanded(current => !current)}>{expanded ? 'Ver menos combinaciones' : 'Ver todas las combinaciones'}</Button>}
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      <Button type="button" variant="outline" size="sm" aria-label="Personalizar combinación" className="h-9 text-xs" onClick={() => { setError(''); setDraft(paletteColors(value.brandPalette || recommendedPalettes(businessVertical)[0])); setEditing(true) }}>Personalizar</Button>
      <Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" aria-expanded={moreOptions} aria-controls={optionsId+'-more'} onClick={() => setMoreOptions(current => !current)}>Más opciones<ChevronDown className={cn('size-3.5 transition-transform',moreOptions && 'rotate-180')} /></Button>
    </div>
    {moreOptions && <div id={optionsId+'-more'} className="space-y-2 rounded-lg border bg-background p-3">
      <div className="flex flex-wrap gap-2">
        {value.logoUrl && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => extract(value.logoUrl!)}><ImagePlus className="mr-2 size-4" />{busy ? 'Leyendo colores…' : 'Sugerir desde mi logo'}</Button>}
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>Subir logo para sugerir</Button>
        {value.brandPalette && <Button type="button" variant="ghost" size="sm" onClick={() => { logoRequest.current++; setBusy(false); onChange({ brandPalette:null }) }}>Usar solo color principal</Button>}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">El logo se analiza en tu navegador; no se sube ni se reemplaza. Las fotos y banners conservan sus colores.</p>
    </div>}
    <input ref={fileRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Logo para sugerir paleta" onChange={upload} />
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {editing && <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">{FIELDS.map(field => <div key={field.key} className="space-y-1.5"><Label htmlFor={'palette-'+field.key}>{field.label}</Label><div className="flex gap-2"><input aria-label={'Elegir '+field.label.toLowerCase()} type="color" className="h-10 w-11 shrink-0 cursor-pointer rounded border" value={/^#[a-f\d]{6}$/i.test(draft[field.key]) ? draft[field.key] : /^#[a-f\d]{3}$/i.test(draft[field.key]) ? '#' + [...draft[field.key].slice(1)].map(c => c+c).join('') : '#000000'} onChange={event => setDraft(current => ({...current,[field.key]:event.target.value}))} /><Input id={'palette-'+field.key} value={draft[field.key]} maxLength={7} onChange={event => setDraft(current => ({...current,[field.key]:event.target.value}))} /></div><p className="text-[11px] text-muted-foreground">{field.hint}</p></div>)}</div>
      <div className="rounded-xl border p-4" style={valid ? {background:draft.background,color:draft.text} : undefined}><p className="text-sm font-semibold">Así se combina tu tienda</p><p className="mt-1 text-xs">Texto, fondo y acciones de ejemplo.</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-lg px-3 py-2 text-xs font-semibold" style={{background:readableBrandAction(draft.primary),color:'#FFFFFF'}}>Ver productos o servicios</span><span className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:isBrandPalette({...draft,text:'#111827',background:'#fff'}) ? draft.accent : undefined}}>Destacado</span></div></div>
      <p role="status" className={cn('text-xs',valid ? 'text-muted-foreground' : 'text-destructive')}>{valid ? `Contraste de lectura: ${colorContrast(draft.text,draft.background).toFixed(1)}:1. Los botones ajustan su tono para mantener texto blanco legible.` : 'Usá colores HEX válidos y un contraste mínimo de 4,5:1 entre texto y fondo.'}</p>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={!valid} onClick={() => { if(valid) apply(draft) }}>Aplicar combinación</Button><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cerrar edición</Button></div>
    </div>}
  </section>
}

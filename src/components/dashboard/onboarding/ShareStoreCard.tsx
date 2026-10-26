'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy, Download, MessageCircle, Printer, QrCode, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Compartir la tienda recién publicada: el enlace, por WhatsApp, el menú de
 * compartir del teléfono y un QR para descargar o imprimir y pegar en el
 * mostrador. Se usa en el onboarding y en Sitio web.
 */

/** Nombre de archivo seguro para el QR: «qr-mi-tienda.png». */
export function qrFileName(storeName: string): string {
  const slug = storeName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `qr-${slug || 'tienda'}.png`
}

/**
 * Menú de compartir del sistema (Android, iOS, Windows). Si el navegador acepta
 * archivos se manda también el QR como imagen; si no tiene menú, se copia el enlace.
 * Devuelve cómo terminó para avisarle a la persona.
 */
export async function shareStore(input: {
  url: string
  storeName: string
  qrDataUrl: string | null
}): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = `¡Mirá el catálogo de ${input.storeName}!`
  const nav = typeof navigator !== 'undefined' ? navigator : null
  if (nav?.share) {
    const data: ShareData = { title: input.storeName, text, url: input.url }
    if (input.qrDataUrl && nav.canShare) {
      try {
        const blob = await (await fetch(input.qrDataUrl)).blob()
        const file = new File([blob], qrFileName(input.storeName), { type: 'image/png' })
        if (nav.canShare({ files: [file] })) data.files = [file]
      } catch {
        // Sin el archivo igual se comparte el enlace.
      }
    }
    try {
      await nav.share(data)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await nav?.clipboard.writeText(`${text} ${input.url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
export function ShareStoreCard({ url, storeName, published, onPublish }: {
  url: string
  storeName: string
  published: boolean
  onPublish: () => void
}) {
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    if (!published) return
    let cancelled = false
    void import('qrcode')
      .then((QRCode) => QRCode.toDataURL(url, { width: 512, margin: 1, errorCorrectionLevel: 'M' }))
      .then((dataUrl) => { if (!cancelled) setQr(dataUrl) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [url, published])

  if (!published) {
    return (
      <section className="space-y-2 rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Share2 className="h-4 w-4" /> Compartí tu tienda</h2>
        <p className="text-xs text-muted-foreground">Cuando la publiques vas a tener acá el enlace, el botón para mandarla por WhatsApp y un QR para el mostrador.</p>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onPublish}>Publicar la tienda</Button>
      </section>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  const share = async () => {
    const result = await shareStore({ url, storeName, qrDataUrl: qr })
    if (result === 'copied') toast.success('Tu navegador no tiene menú para compartir: copiamos el enlace')
    else if (result === 'failed') toast.error('No se pudo compartir el enlace')
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`¡Mirá el catálogo de ${storeName}! ${url}`)}`

  const print = () => {
    if (!qr) return
    const page = window.open('', '_blank', 'width=600,height=800')
    if (!page) return
    page.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${storeName}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:48px}h1{font-size:28px;margin:0 0 8px}p{color:#475569;margin:0 0 24px;font-size:18px}img{width:320px;height:320px}small{display:block;margin-top:16px;color:#64748b}</style>
      </head><body><h1>${storeName.replace(/</g, '&lt;')}</h1><p>Escaneá y mirá nuestro catálogo</p><img src="${qr}" alt=""><small>${url.replace(/</g, '&lt;')}</small>
      <script>window.onload=()=>{window.print()}</script></body></html>`)
    page.document.close()
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Share2 className="h-4 w-4" /> Compartí tu tienda</h2>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <code className="min-w-0 flex-1 truncate text-[11px]">{url}</code>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => void copy()} aria-label="Copiar enlace">
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="sm" className="h-8 gap-1.5 bg-[#25D366] text-xs text-white hover:bg-[#1ebe5a]" asChild>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void share()}>
          <Share2 className="h-3.5 w-3.5" /> Compartir
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border bg-white p-1">
          {qr
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={qr} alt={`QR de la tienda ${storeName}`} className="h-full w-full" />
            : <QrCode className="h-8 w-8 text-muted-foreground" />}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-[11px] text-muted-foreground">Imprimilo y pegalo en el mostrador o en la vidriera.</p>
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={!qr} asChild={Boolean(qr)}>
            {qr ? <a href={qr} download={qrFileName(storeName)}><Download className="h-3.5 w-3.5" /> Descargar QR</a> : <span>Generando…</span>}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={!qr} onClick={print}>
            <Printer className="h-3.5 w-3.5" /> Imprimir cartel
          </Button>
        </div>
      </div>
    </section>
  )
}

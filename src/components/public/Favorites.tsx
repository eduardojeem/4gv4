'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { favoriteKey, type Favorite } from '@/lib/public/favorites-schema'
import { initializeFavorites, refreshGuestFavorites, toggleFavorite, useFavorites } from '@/lib/public/favorites-store'

export function FavoriteButton({ item }: { item: Favorite }) {
  const state = useFavorites()
  const saved = state.items.some(row => favoriteKey(row) === favoriteKey(item))
  return <button type="button" aria-label={`${saved ? 'Quitar de' : 'Agregar a'} favoritos: ${item.name}`} aria-pressed={saved} disabled={state.busy || !!state.error} onClick={event => { event.preventDefault(); event.stopPropagation(); void toggleFavorite(item).catch(() => toast.error('No se pudo guardar el cambio. Reintentá.')) }} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background text-primary shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Heart aria-hidden="true" className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} /></button>
}

export function PublicFavorites() {
  const { user } = useAuth()
  const state = useFavorites()
  const [open, setOpen] = useState(false)
  useEffect(() => { void initializeFavorites(user?.id ?? null) }, [user?.id])
  useEffect(() => { window.addEventListener('storage', refreshGuestFavorites); return () => window.removeEventListener('storage', refreshGuestFavorites) }, [])
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" aria-label={`Mis favoritos (${state.items.length})`} className="inline-flex h-10 items-center gap-1 rounded-md px-2 text-primary"><Heart className="h-5 w-5" /><span className="text-xs">{state.items.length}</span></button></DialogTrigger>
    <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-lg">
      <DialogTitle>Mis favoritos</DialogTitle>
      <DialogDescription>{state.account ? 'Guardados en tu cuenta.' : 'Guardados en este navegador. Iniciá sesión para sincronizarlos.'} Los precios y la disponibilidad se confirman al abrir la tienda.</DialogDescription>
      {state.error && <div role="alert" className="text-sm text-destructive">{state.error}<button type="button" className="ml-2 underline" onClick={() => void initializeFavorites(user?.id ?? null)}>Reintentar</button></div>}
      {state.busy && <p role="status" className="text-sm">Sincronizando favoritos…</p>}
      {!state.items.length && !state.busy && !state.error && <p className="py-6 text-center text-sm text-muted-foreground">Todavía no guardaste productos. Tocá el corazón para agregarlos.</p>}
      <ul className="min-h-0 space-y-2 overflow-y-auto">
        {state.items.map(item => <li key={favoriteKey(item)} className="flex items-center justify-between gap-3 rounded-md border p-3"><Link href={`/${item.slug}/productos/${item.productId}`} onClick={() => setOpen(false)} className="min-w-0"><span className="block break-words text-sm font-medium">{item.name}</span><span className="block text-xs text-muted-foreground">{item.store} · Ver en tienda</span></Link><FavoriteButton item={item} /></li>)}
      </ul>
      <Link href="/marketplace/favoritos" onClick={() => setOpen(false)} className="flex min-h-11 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Ver todos los favoritos</Link>
    </DialogContent>
  </Dialog>
}

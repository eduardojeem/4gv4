import type { Metadata } from 'next'
import { FavoritesPage } from '@/components/public/FavoritesPage'

export const metadata: Metadata = {
  title: 'Mis favoritos',
  robots: { index: false, follow: false },
}

export default function Page() { return <FavoritesPage /> }

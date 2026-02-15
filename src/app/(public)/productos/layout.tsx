import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Catálogo de Productos | 4G Celulares',
  description: 'Encuentra accesorios, repuestos y dispositivos para celulares. Amplio catálogo con precios competitivos y stock actualizado.',
  keywords: 'accesorios celular, repuestos celular, fundas, protectores, cargadores, auriculares',
  openGraph: {
    title: 'Catálogo de Productos | 4G Celulares',
    description: 'Encuentra accesorios, repuestos y dispositivos para celulares',
    type: 'website'
  }
}

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

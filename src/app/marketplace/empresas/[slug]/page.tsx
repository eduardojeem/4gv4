import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Package,
  Phone,
  Store,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getPublicOrganizationPage } from '@/lib/public/marketplace'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'

type PageProps = {
  params: Promise<{ slug: string }>
}

const planStyles: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
  BASIC: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400',
  PRO: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400',
  ENTERPRISE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400',
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const page = await getPublicOrganizationPage(slug)

  if (!page) return { title: 'Empresa no encontrada' }

  const title = typeof page.heroContent?.title === 'string' ? page.heroContent.title : page.organization.name
  const description =
    typeof page.heroContent?.subtitle === 'string'
      ? page.heroContent.subtitle
      : `Conoce ${page.organization.name} y su catálogo de productos.`

  return {
    title: `${page.organization.name} | Marketplace MiPOS`,
    description,
    openGraph: { title, description, type: 'website' },
  }
}

export default async function PublicOrganizationPage({ params }: PageProps) {
  const { slug } = await params
  const page = await getPublicOrganizationPage(slug)

  if (!page) notFound()

  const org = page.organization
  const heroTitle = typeof page.heroContent?.title === 'string' ? page.heroContent.title : org.name
  const heroSubtitle =
    typeof page.heroContent?.subtitle === 'string'
      ? page.heroContent.subtitle
      : 'Catálogo de productos y canales de contacto de esta empresa.'
  const phone = typeof page.companyInfo?.phone === 'string' ? page.companyInfo.phone : ''
  const address = typeof page.companyInfo?.address === 'string' ? page.companyInfo.address : ''
  const email = typeof page.companyInfo?.email === 'string' ? page.companyInfo.email : ''
  const website = typeof page.companyInfo?.website === 'string' ? page.companyInfo.website : ''
  const plan = org.plan ?? 'FREE'
  const planClass = planStyles[plan] ?? planStyles.FREE
  const tenantUrl = `/${org.slug}/inicio`
  const hasContact = phone || address || email || website

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        {/* Gradient strip */}
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-400" />
        <div className="absolute inset-0 top-1 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(6,182,212,0.06),transparent)]" />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/marketplace" className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300">
              <Store className="h-3 w-3" />
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/marketplace/empresas" className="hover:text-slate-700 dark:hover:text-slate-300">
              Empresas
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="max-w-[180px] truncate font-medium text-slate-700 dark:text-slate-200">{org.name}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
            {/* Left: info */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {/* Logo */}
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                {org.logo_url ? (
                  <Image src={org.logo_url} alt={org.name} width={80} height={80} className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-9 w-9 text-slate-400" />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${planClass}`}>{plan}</span>
                  <Badge variant="outline" className="gap-1.5 text-xs">
                    <Store className="h-3 w-3" />
                    Empresa publicada
                  </Badge>
                </div>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
                  {heroTitle}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">{heroSubtitle}</p>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                    {page.products.length} productos públicos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                    /{org.slug}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild size="sm" className="gap-2 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-600">
                    <Link href={tenantUrl}>
                      Ir a la tienda
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/marketplace/empresas">
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                      Volver
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: contact card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Contacto</h2>
              {hasContact ? (
                <ul className="mt-4 space-y-3">
                  {phone && (
                    <li>
                      <a
                        href={`tel:${phone.replace(/\D/g, '')}`}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-950/30">
                          <Phone className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />
                        </span>
                        {phone}
                      </a>
                    </li>
                  )}
                  {email && (
                    <li>
                      <a
                        href={`mailto:${email}`}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-950/30">
                          <Mail className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />
                        </span>
                        {email}
                      </a>
                    </li>
                  )}
                  {address && (
                    <li>
                      <div className="flex items-start gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-400">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-950/30">
                          <MapPin className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />
                        </span>
                        {address}
                      </div>
                    </li>
                  )}
                  {website && (
                    <li>
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-950/30">
                          <Globe className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />
                        </span>
                        {website}
                      </a>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">
                  La empresa aún no cargó datos de contacto.
                </p>
              )}
              <Button asChild className="mt-5 w-full gap-2 bg-cyan-600 hover:bg-cyan-700">
                <Link href={tenantUrl}>
                  Ver tienda completa
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Productos ── */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Catálogo público
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {page.products.length} producto{page.products.length !== 1 ? 's' : ''} disponible{page.products.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {page.products.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {page.products.map((product) => {
              const imageSrc = resolveProductImageUrl(product.image)
              return (
                <div
                  key={product.id}
                  className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-700"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={product.name}
                        fill
                        className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 1280px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    {product.sku && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">{product.sku}</p>
                    )}
                    <h3 className="mt-1 line-clamp-2 min-h-[40px] text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {product.name}
                    </h3>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-50">
                        {formatPrice(product.sale_price)}
                      </p>
                      {product.in_stock ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                          En stock
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Sin stock
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
            <Package className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-slate-600 dark:text-slate-400">Sin productos publicados aún</p>
          </div>
        )}
      </section>
    </main>
  )
}

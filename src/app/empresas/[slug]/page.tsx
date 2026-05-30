import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function LegacyOrganizationPage({ params }: PageProps) {
  const { slug } = await params
  redirect(`/marketplace/empresas/${slug}`)
}

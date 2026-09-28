import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { listLegalDocuments } from '@/lib/legal/documents'
import { LegalDocumentsEditor } from '@/components/superadmin/legal/LegalDocumentsEditor'

export const metadata: Metadata = {
  title: 'Documentos legales | Superadmin',
}

export const dynamic = 'force-dynamic'

export default async function LegalDocumentsPage() {
  await requireSuperAdmin()
  const state = await listLegalDocuments()
  return <LegalDocumentsEditor state={state} />
}

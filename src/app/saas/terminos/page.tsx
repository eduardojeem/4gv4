import { LegalDocumentPage, legalDocumentMetadata } from '@/components/legal/LegalDocumentPage'

export const revalidate = 3600

export function generateMetadata() {
  return legalDocumentMetadata('terms')
}

export default function TermsPage() {
  return <LegalDocumentPage documentType="terms" />
}

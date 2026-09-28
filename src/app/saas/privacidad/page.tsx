import { LegalDocumentPage, legalDocumentMetadata } from '@/components/legal/LegalDocumentPage'

export const revalidate = 3600

export function generateMetadata() {
  return legalDocumentMetadata('privacy')
}

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage documentType="privacy" />
}

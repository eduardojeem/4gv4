import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ServiceWebsiteProposalPreview } from '@/components/admin/website/ServiceWebsiteProposalPreview'
import type { ServiceWebsiteProposal } from '@/lib/website/service-website-proposal'

afterEach(cleanup)
it('previews the public agenda menu and booking action without enabling navigation', () => {
  const proposal = { values: {}, summary: [] } as ServiceWebsiteProposal
  render(<ServiceWebsiteProposalPreview proposal={proposal} services={[]} agenda={{ currency: 'PYG', services: [{ id: 'real', name: 'Manicura real', duration: 45, price: 75000 }], professionals: [] }} />)
  expect(screen.getByText('Manicura real')).toBeInTheDocument()
  expect(screen.getByText('45 min')).toBeInTheDocument()
  expect(screen.queryByText(/Todavía no hay servicios publicados/)).not.toBeInTheDocument()
})

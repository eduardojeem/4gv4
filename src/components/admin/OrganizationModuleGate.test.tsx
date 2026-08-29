import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OrganizationModuleGate } from './OrganizationModuleGate'
import { SubscriptionStatusProvider, type SubscriptionStatusData } from '@/contexts/SubscriptionStatusContext'

const base: SubscriptionStatusData = {
  status: 'active', isBlocked: false, isTrialing: false, trialDaysLeft: null, periodDaysLeft: null,
  planCode: 'BASIC', planName: 'Basic', modules: [], entitledModules: ['repairs'], enabledModules: [],
  effectiveModules: [], businessVertical: 'clothing', operatingModel: 'retail', downgradedFromExpiry: false,
  moduleTrials: [], trialedModules: [], organizationName: 'Moda', organizationLogoUrl: null,
}

describe('OrganizationModuleGate', () => {
  it('explains when a commercially available module was disabled by the organization', () => {
    render(<SubscriptionStatusProvider value={base}>
      <OrganizationModuleGate module="repairs"><p>Repair content</p></OrganizationModuleGate>
    </SubscriptionStatusProvider>)

    expect(screen.queryByText('Repair content')).not.toBeInTheDocument()
    expect(screen.getByText('Módulo desactivado para esta organización')).toBeInTheDocument()
  })
})

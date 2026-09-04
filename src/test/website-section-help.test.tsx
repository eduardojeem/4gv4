import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WEBSITE_SECTION_HELP, WebsiteSectionIntro } from '@/components/admin/website/WebsiteSectionIntro'

describe('website contextual help', () => {
  for (const section of Object.keys(WEBSITE_SECTION_HELP) as Array<keyof typeof WEBSITE_SECTION_HELP>) {
    it(`opens instructions and examples for ${section}`, () => {
      render(<WebsiteSectionIntro section={section} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Cómo funciona' }))
      expect(screen.getByRole('dialog')).toHaveAccessibleName(WEBSITE_SECTION_HELP[section].title)
      expect(screen.getByText(WEBSITE_SECTION_HELP[section].examples[0])).toBeInTheDocument()
    })
  }
})

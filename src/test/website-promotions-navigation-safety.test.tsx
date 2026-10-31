import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PromotionalCarouselEditor } from '@/components/admin/website/PromotionalCarouselEditor'
vi.mock('next/link', () => ({ default: ({children,...props}: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }))
vi.mock('@/hooks/useWebsiteSettings', () => ({useAdminWebsiteSettings: () => ({settings: {promotional_carousel:{enabled:true,autoplay:true,intervalSeconds:6,slides:[]}},isLoading:false,isSaving:false,updateSetting:vi.fn(),refetch:vi.fn()})}))
vi.mock('@/hooks/useWebsiteMediaQuota', () => ({useWebsiteMediaQuota: () => ({isAtLimit:false})}))
vi.mock('@/components/admin/website/WebsiteMediaQuotaBanner', () => ({WebsiteMediaQuotaBanner:()=>null}))
vi.mock('@/components/admin/website/WebsiteMediaLibraryDialog', () => ({WebsiteMediaLibraryDialog:()=>null}))
beforeEach(() => vi.spyOn(window,'confirm').mockReturnValue(false))
afterEach(() => vi.restoreAllMocks())
describe('salida segura hacia promociones', () => {
 it('permite salir sin preguntar si no hay cambios', () => {
  render(<PromotionalCarouselEditor />)
  const event=createEvent.click(screen.getByRole('link',{name:'Ir a Promociones'}))
  fireEvent(screen.getByRole('link',{name:'Ir a Promociones'}),event)
  expect(window.confirm).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)
 })
 it.each([false,true])('respeta la confirmación %s con cambios pendientes', accepted => {
  vi.mocked(window.confirm).mockReturnValue(accepted)
  render(<PromotionalCarouselEditor />)
  fireEvent.click(screen.getAllByRole('switch')[0])
  const link=screen.getByRole('link',{name:'Ir a Promociones'})
  const event=createEvent.click(link)
  fireEvent(link,event)
  expect(window.confirm).toHaveBeenCalledOnce()
  expect(event.defaultPrevented).toBe(!accepted)
  expect(link).toHaveAttribute('href','/dashboard/promotions?tab=publica')
 })
})

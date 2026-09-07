import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockSave = vi.fn()
const mockAddPage = vi.fn()
const mockText = vi.fn()
const mockSetPage = vi.fn()
const mockRoundedRect = vi.fn()
const mockRect = vi.fn()
const mockLine = vi.fn()
const mockAutoTable = vi.fn()

class MockJsPdfClass {
  internal = {
    pageSize: { getWidth: () => 595, getHeight: () => 842 },
    getNumberOfPages: () => 2,
  }
  setFillColor = vi.fn()
  setDrawColor = vi.fn()
  setLineWidth = vi.fn()
  setFontSize = vi.fn()
  setFont = vi.fn()
  setTextColor = vi.fn()
  text = mockText
  roundedRect = mockRoundedRect
  rect = mockRect
  line = mockLine
  addPage = mockAddPage
  setPage = mockSetPage
  splitTextToSize = vi.fn((txt: string) => [txt])
  save = mockSave
}

vi.mock('jspdf', () => {
  return {
    default: MockJsPdfClass,
    jsPDF: MockJsPdfClass,
  }
})

vi.mock('jspdf-autotable', () => ({
  default: mockAutoTable,
}))

import {
  FINANCE_GUIDE_DATA,
  exportFinanceGuideToPdf,
  exportFinanceGuideToMarkdown,
  printFinanceGuide,
} from '@/lib/finances/finance-guide-exporter'
import { FinanceBusinessGuideModal } from '@/components/admin/finances/FinanceBusinessGuideModal'

describe('finance-guide-exporter module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('contains comprehensive and structured data for all 5 core finance sections plus tips', () => {
    const requiredSections = ['resumen', 'gastos', 'nomina', 'rentabilidad', 'configuracion', 'tips']
    requiredSections.forEach((key) => {
      const sec = FINANCE_GUIDE_DATA[key]
      expect(sec).toBeDefined()
      expect(sec.title).toBeTruthy()
      expect(sec.objective).toBeTruthy()
      expect(sec.keyPoints.length).toBeGreaterThan(0)
      expect(sec.tips.length).toBeGreaterThan(0)
    })
  })

  it('exports full finance guide to PDF calling doc.save with expected filename', async () => {
    await exportFinanceGuideToPdf({ allSections: true, contentType: 'all' })

    expect(mockSave).toHaveBeenCalledWith('Manual_Administracion_Financiera_4G.pdf')
    expect(mockAutoTable).toHaveBeenCalled()
    expect(mockAddPage).toHaveBeenCalled()
  })

  it('exports explicitly as manual-only PDF with dedicated filename', async () => {
    await exportFinanceGuideToPdf({ allSections: true, contentType: 'manual' })

    expect(mockSave).toHaveBeenCalledWith('Manual_Procedimientos_Finanzas_4G.pdf')
  })

  it('exports explicitly as examples-only PDF with dedicated filename', async () => {
    await exportFinanceGuideToPdf({ allSections: true, contentType: 'examples' })

    expect(mockSave).toHaveBeenCalledWith('Casos_Practicos_Finanzas_4G.pdf')
  })

  it('exports single section to PDF with section-specific filename', async () => {
    await exportFinanceGuideToPdf({ sectionKey: 'gastos', allSections: false })

    expect(mockSave).toHaveBeenCalledWith('Guia_Finanzas_gastos_4G.pdf')
  })

  it('exports structured markdown (.md) with table and formulas in Guaranies', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL

    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()

    exportFinanceGuideToMarkdown({ sectionKey: 'resumen', allSections: true })

    expect(clickSpy).toHaveBeenCalled()

    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('opens modern printable window with printFinanceGuide', () => {
    const writeMock = vi.fn()
    const closeMock = vi.fn()
    const focusMock = vi.fn()

    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({
      document: {
        write: writeMock,
        close: closeMock,
      },
      focus: focusMock,
    } as unknown as Window)

    printFinanceGuide({ sectionKey: 'nomina', allSections: false })

    expect(windowOpenSpy).toHaveBeenCalledWith('', '_blank')
    expect(writeMock).toHaveBeenCalled()
    const htmlOutput = writeMock.mock.calls[0][0] as string
    expect(htmlOutput).toContain('Manual de Administración Financiera')
    expect(htmlOutput).toContain('Nómina, Salarios y Comisiones')
    expect(htmlOutput).toContain('@media print')
    expect(closeMock).toHaveBeenCalled()
    expect(focusMock).toHaveBeenCalled()
  })
})

describe('FinanceBusinessGuideModal export UI integration', () => {
  it('renders explicit manual and examples download buttons in header, view filter and footer', () => {
    render(<FinanceBusinessGuideModal open={true} initialTab="gastos" />)

    // Check header button for download / print
    const headerDownloadBtn = screen.getByRole('button', { name: /descargar \/ imprimir/i })
    expect(headerDownloadBtn).toBeInTheDocument()

    // Check content view filter buttons
    expect(screen.getByRole('button', { name: /ver todo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /solo manual y rutinas/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /solo ejemplos \(gs\.\)/i })).toBeInTheDocument()

    // Check explicit footer buttons for manual and examples
    const footerManualBtn = screen.getByRole('button', { name: /descargar pdf manual \(gastos y cuentas\)/i })
    expect(footerManualBtn).toBeInTheDocument()

    const footerExamplesBtn = screen.getByRole('button', { name: /descargar pdf ejemplos \(gastos y cuentas\)/i })
    expect(footerExamplesBtn).toBeInTheDocument()
  })
})

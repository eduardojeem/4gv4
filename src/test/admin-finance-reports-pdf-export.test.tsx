import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
    pageSize: { getWidth: () => 842, getHeight: () => 595 },
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

vi.mock('jspdf', () => ({
  default: MockJsPdfClass,
  jsPDF: MockJsPdfClass,
}))

vi.mock('jspdf-autotable', () => ({
  default: mockAutoTable,
}))

import {
  exportProfitabilityPdf,
  exportFinanceSummaryPdf,
} from '@/lib/finances/finance-reports-pdf-exporter'
import { ProfitabilityPanel } from '@/components/admin/finances/ProfitabilityPanel'
import { FinanceSummary } from '@/components/admin/finances/FinanceSummary'
import type { FinanceSummaryReport } from '@/lib/finance/server'

describe('finance-reports-pdf-exporter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports profitability report to PDF and triggers doc.save with formatted filename', async () => {
    const mockRows = [
      {
        id: 'ord-1',
        label: 'Reparación Cambio de Pantalla iPhone 13',
        revenue: 450000,
        directCosts: 200000,
        grossProfit: 250000,
        complete: true,
        margin: 56,
      },
      {
        id: 'ord-2',
        label: 'Mantenimiento General Taller',
        revenue: 150000,
        directCosts: null,
        grossProfit: null,
        complete: false,
        margin: null,
      },
    ]

    await exportProfitabilityPdf({
      rows: mockRows,
      group: 'repair',
      totals: {
        revenue: 600000,
        directCosts: 200000,
        grossProfit: 250000,
        margin: 56,
        incompleteCount: 1,
      },
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      branchName: 'Sucursal Central',
      companyName: '4G Comunicaciones',
    })

    expect(mockAutoTable).toHaveBeenCalled()
    expect(mockSave).toHaveBeenCalledWith(
      expect.stringMatching(/^Reporte_Rentabilidad_repair_20260301_20260331\.pdf$/)
    )
  })

  it('exports finance summary report to PDF and triggers doc.save with executive balance filename', async () => {
    const mockSummary: FinanceSummaryReport = {
      generatedAt: new Date().toISOString(),
      filters: { startDate: '2026-03-01', endDate: '2026-03-31' },
      complete: true,
      coverageWarnings: [],
      accrued: {
        revenue: 12500000,
        directCosts: 4500000,
        grossProfit: 8000000,
        operatingExpenses: 2500000,
        payrollCost: 3000000,
        netProfit: 2500000,
      },
      cash: {
        collected: 11000000,
        paid: 9500000,
        netCashFlow: 1500000,
      },
      pending: {
        receivables: 1500000,
        payables: 500000,
      },
      comparison: {
        complete: true,
        coverageWarnings: [],
        accrued: {
          revenue: 10000000,
          directCosts: 4000000,
          grossProfit: 6000000,
          operatingExpenses: 2000000,
          payrollCost: 2800000,
          netProfit: 1200000,
        },
        cash: {
          collected: 9000000,
          paid: 8500000,
          netCashFlow: 500000,
        },
        pending: {
          receivables: 1000000,
          payables: 600000,
        },
      },
      upcomingDue: [
        { id: 'up-1', dueDate: '2026-04-05', amount: 350000, concept: 'Alquiler Taller' },
      ],
      overdue: [
        { id: 'ov-1', dueDate: '2026-03-10', amount: 120000, concept: 'Insumos Limpieza' },
      ],
    }

    await exportFinanceSummaryPdf({
      summary: mockSummary,
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      branchName: 'Sucursal Matriz',
      companyName: '4G Comunicaciones',
    })

    expect(mockAutoTable).toHaveBeenCalled()
    expect(mockSave).toHaveBeenCalledWith(
      expect.stringMatching(/^Balance_Financiero_Ejecutivo_20260301_20260331\.pdf$/)
    )
  })

  it('renders Exportar PDF and Exportar rentabilidad buttons in ProfitabilityPanel and handles click', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [] }),
    } as any)

    render(
      <ProfitabilityPanel
        organizationId="org-1"
        filters={{ startDate: '2026-03-01', endDate: '2026-03-31' }}
      />
    )

    const pdfButton = screen.getByRole('button', { name: 'Exportar PDF' })
    const csvButton = screen.getByRole('button', { name: 'Exportar rentabilidad' })

    expect(pdfButton).toBeInTheDocument()
    expect(csvButton).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(pdfButton)

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled()
    })
  })

  it('renders Exportar Resumen (PDF) button in FinanceSummary and triggers PDF export', async () => {
    const mockSummary: FinanceSummaryReport = {
      generatedAt: new Date().toISOString(),
      filters: { startDate: '2026-03-01', endDate: '2026-03-31' },
      complete: true,
      coverageWarnings: [],
      accrued: {
        revenue: 5000000,
        directCosts: 2000000,
        grossProfit: 3000000,
        operatingExpenses: 1000000,
        payrollCost: 1500000,
        netProfit: 500000,
      },
      cash: {
        collected: 4500000,
        paid: 4000000,
        netCashFlow: 500000,
      },
      pending: {
        receivables: 500000,
        payables: 200000,
      },
      comparison: {
        complete: true,
        coverageWarnings: [],
        accrued: {
          revenue: 4000000,
          directCosts: 1800000,
          grossProfit: 2200000,
          operatingExpenses: 900000,
          payrollCost: 1400000,
          netProfit: -100000,
        },
        cash: {
          collected: 3800000,
          paid: 3500000,
          netCashFlow: 300000,
        },
        pending: {
          receivables: 200000,
          payables: 100000,
        },
      },
      upcomingDue: [],
      overdue: [],
    }

    render(
      <FinanceSummary
        summary={mockSummary}
        onOpenBusinessGuide={vi.fn()}
      />
    )

    const summaryPdfBtn = screen.getByRole('button', { name: /Exportar Resumen \(PDF\)/i })
    expect(summaryPdfBtn).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(summaryPdfBtn)

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled()
    })
  })
})

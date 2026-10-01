import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StorageCleanupPanel } from '@/components/superadmin/maintenance/StorageCleanupPanel'
import type { StorageScanResult } from '@/lib/superadmin/storage-cleanup'

vi.mock('@/app/superadmin/maintenance/actions', () => ({
  scanStorageAction: vi.fn(),
  trashOrphanImagesAction: vi.fn(),
  restoreTrashedImagesAction: vi.fn(),
  purgeImageTrashAction: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const scan = (over: Partial<StorageScanResult> = {}): StorageScanResult => ({
  scannedAt: '2026-10-01T12:00:00.000Z',
  totalFiles: 514,
  totalBytes: 50_000_000,
  productFiles: 469,
  folders: [{ folder: 'products', files: 469, bytes: 40_000_000, protected: false }],
  referencedPaths: 411,
  candidates: [
    { path: 'products/a.jpg', size: 200_000, updatedAt: '2026-05-01T00:00:00Z', publicUrl: 'https://cdn/a.jpg' },
    { path: 'products/b.jpg', size: 100_000, updatedAt: '2026-09-01T00:00:00Z', publicUrl: 'https://cdn/b.jpg' },
  ],
  candidateBytes: 300_000,
  skippedRecent: 3,
  protectedVariants: 6,
  brake: { tripped: false, share: 0.1 },
  trash: [
    {
      path: '_papelera/2026-08-01/products/viejo.jpg', originalPath: 'products/viejo.jpg', trashedOn: '2026-08-01',
      size: 1000, publicUrl: 'https://cdn/v.jpg', purgeableAt: '2026-08-31T00:00:00.000Z', inUse: false,
    },
    {
      path: '_papelera/2026-09-30/products/usado.jpg', originalPath: 'products/usado.jpg', trashedOn: '2026-09-30',
      size: 1000, publicUrl: 'https://cdn/u.jpg', purgeableAt: '2026-10-30T00:00:00.000Z', inUse: true,
    },
  ],
  trashBytes: 2000,
  missing: [
    { path: 'products/remera-basica-blanca.jpg', tables: ['products', 'product_variants'], stores: [{ id: 'o1', name: 'Dabasica', slug: 'dabasica' }] },
  ],
  sources: ['products'],
  ...over,
})

describe('panel de imágenes de mantenimiento', () => {
  it('mueve a la papelera en vez de borrar, y cuenta los originales protegidos', () => {
    render(<StorageCleanupPanel scan={scan()} onScan={vi.fn()} />)
    expect(screen.getByText('6 originales · 3 recientes')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Borrar/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Solo las de más de 90 días \(1\)/ }))
    expect(screen.getByRole('button', { name: /Mover 1 a la papelera/ })).toBeEnabled()
  })

  it('con el freno activo no deja mover nada', () => {
    render(<StorageCleanupPanel scan={scan({ brake: { tripped: true, share: 0.64 } })} onScan={vi.fn()} />)
    expect(screen.getByText(/Freno de seguridad: el 64%/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Todas (2)'))
    expect(screen.getByRole('button', { name: /a la papelera/ })).toBeDisabled()
  })

  it('en la papelera avisa lo que volvió a usarse y solo deja borrar lo vencido', () => {
    render(<StorageCleanupPanel scan={scan()} onScan={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Papelera (2)' }))
    expect(screen.getByText(/Una imagen de la papelera volvió a usarse/)).toBeInTheDocument()
    expect(screen.getByText('Se puede borrar')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Seleccionar products/usado.jpg'))
    expect(screen.getByRole('button', { name: /Borrar definitivamente/ })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Seleccionar products/viejo.jpg'))
    expect(screen.getByRole('button', { name: /Borrar definitivamente 1/ })).toBeEnabled()
  })

  it('lista las fotos que faltan por tienda', () => {
    render(<StorageCleanupPanel scan={scan()} onScan={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver cuáles' }))
    expect(screen.getByText('remera-basica-blanca.jpg')).toBeInTheDocument()
    expect(screen.getByText('en productos, variantes')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver organización →' })).toHaveAttribute('href', '/superadmin/organizations/dabasica')
  })
})

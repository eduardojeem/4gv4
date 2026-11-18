import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { CatalogDetailFields } from './ProductCatalogDetails'
import { cleanProductDetails } from '@/lib/products/catalog-contract'
it('cosmética separa datos comunes de los atributos que generan variantes', () => {
  render(<CatalogDetailFields vertical="cosmetics" value={{ volume: '50 ml' }} variantKeys={['volume', 'tone']} onChange={vi.fn()} />)
  expect(screen.queryByLabelText('Contenido o volumen')).toBeNull()
  expect(screen.queryByLabelText('Tono')).toBeNull()
  expect(screen.getByLabelText('Tipo de piel')).toBeInTheDocument()
  expect(cleanProductDetails({ volume: '50 ml', skin_type: 'Mixta' }, ['volume'])).toEqual({ skin_type: 'Mixta' })
})
it('permite declarar que el vencimiento no corresponde sin confundirlo con PAO', () => {
  const change = vi.fn()
  render(<CatalogDetailFields vertical="cosmetics" value={{ skin_type: 'Mixta' }} onChange={change} />)
  fireEvent.change(screen.getByLabelText('Control de vencimiento'), { target: { value: 'not_applicable' } })
  expect(change).toHaveBeenCalledWith({ skin_type: 'Mixta', expiry_policy: 'not_applicable' })
  expect(screen.getByText(/No reemplaza el vencimiento impreso/)).toBeInTheDocument()
})

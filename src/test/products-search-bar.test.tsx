import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchBar } from '@/components/dashboard/products-modern/SearchBar'

vi.mock('@/components/ui/barcode-scanner', () => ({ BarcodeScanner: ({ label, onScan }: { label: string; onScan: (code: string) => void }) => <button type="button" onClick={() => onScan(' 7891000315507 ')}>{label}</button> }))

describe('búsqueda de productos', () => {
  it('envía el código escaneado a la misma búsqueda del listado', () => {
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Escanear código para buscar' }))
    expect(onChange).toHaveBeenCalledWith('7891000315507')
  })
  it('Enter del lector no envía un formulario contenedor', () => {
    const onChange = vi.fn()
    render(<form><SearchBar value=" 779 " onChange={onChange} /></form>)
    expect(fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' })).toBe(false)
    expect(onChange).toHaveBeenCalledWith('779')
  })
  it('limpiar devuelve el foco al buscador', () => {
    const onChange = vi.fn()
    render(<SearchBar value="café" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
    expect(onChange).toHaveBeenCalledWith('')
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })
})

import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VariantAttributeBuilder } from './VariantAttributeBuilder'
import type { ProductAttributeDefinition } from '@/lib/products/variant-contract'

const initial: ProductAttributeDefinition[] = [{ key: 'stable_color', label: 'Color', control: 'select', options: ['Negro'] }]
function Harness({ disabled = false }: { disabled?: boolean }) {
  const [attributes, setAttributes] = useState(initial)
  return <><VariantAttributeBuilder attributes={attributes} onChange={setAttributes} disabled={disabled} /><output data-testid="state">{JSON.stringify(attributes)}</output></>
}

describe('VariantAttributeBuilder', () => {
  it('adds a chip with Enter and rejects canonical case-insensitive duplicates inline', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox', { name: 'Nuevo valor para Color' })
    fireEvent.change(input, { target: { value: ' negro ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('alert')).toHaveTextContent('Este valor ya existe')
    fireEvent.change(input, { target: { value: ' Blanco ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Eliminar Blanco de Color' })).toBeInTheDocument()
    expect(input).toHaveValue('')
  })
  it('keeps the stable attribute key when renaming and shows duplicate label warnings', () => {
    render(<Harness />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del atributo' }), { target: { value: 'Tono' } })
    expect(screen.getByTestId('state')).toHaveTextContent('stable_color')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar atributo' }))
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Nombre del atributo' })[1], { target: { value: ' tono ' } })
    expect(screen.getAllByRole('alert').filter(node => node.textContent?.includes('Ya existe'))).toHaveLength(2)
  })
  it('routes value and attribute removal through the controlled callback', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Negro de Color' }))
    expect(screen.getByTestId('state')).toHaveTextContent('"options":[]')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar atributo Color' }))
    expect(screen.getByTestId('state')).toHaveTextContent('[]')
  })
  it('disables every editing control when disabled', () => {
    render(<Harness disabled />)
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
    for (const input of screen.getAllByRole('textbox')) expect(input).toBeDisabled()
  })
})

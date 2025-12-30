import { NextRequest, NextResponse } from 'next/server'
import { VariantAttribute } from '@/types/product-variants'

// Mock data - En producción esto vendría de la base de datos
const mockAttributes: VariantAttribute[] = [
  {
    id: 'attr-1',
    name: 'Color',
    type: 'color',
    required: true,
    options: [
      { id: 'opt-1', attribute_id: 'attr-1', value: 'Rojo', color_hex: '#FF0000', sort_order: 1, active: true },
      { id: 'opt-2', attribute_id: 'attr-1', value: 'Azul', color_hex: '#0000FF', sort_order: 2, active: true }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// GET /api/attributes/[id] - Obtener atributo específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const attribute = mockAttributes.find(attr => attr.id === id)
    
    if (!attribute) {
      return NextResponse.json(
        { success: false, error: 'Atributo no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: attribute
    })

  } catch (error) {
    console.error('Error fetching attribute:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/attributes/[id] - Actualizar atributo específico
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const attributeIndex = mockAttributes.findIndex(attr => attr.id === id)
    
    if (attributeIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Atributo no encontrado' },
        { status: 404 }
      )
    }

    // Verificar nombre único si se está actualizando
    if (body.name && body.name !== mockAttributes[attributeIndex].name) {
      const existingAttribute = mockAttributes.find(attr => 
        attr.name.toLowerCase() === body.name.toLowerCase() && attr.id !== id
      )
      if (existingAttribute) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un atributo con ese nombre' },
          { status: 409 }
        )
      }
    }

    // Actualizar atributo
    const updatedAttribute = {
      ...mockAttributes[attributeIndex],
      ...body,
      id, // Mantener el ID original
      updated_at: new Date().toISOString()
    }

    mockAttributes[attributeIndex] = updatedAttribute

    return NextResponse.json({
      success: true,
      data: updatedAttribute
    })

  } catch (error) {
    console.error('Error updating attribute:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE /api/attributes/[id] - Eliminar atributo específico
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const attributeIndex = mockAttributes.findIndex(attr => attr.id === id)
    
    if (attributeIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Atributo no encontrado' },
        { status: 404 }
      )
    }

    const deletedAttribute = mockAttributes[attributeIndex]
    mockAttributes.splice(attributeIndex, 1)

    return NextResponse.json({
      success: true,
      data: {
        message: 'Atributo eliminado exitosamente',
        deleted_attribute: deletedAttribute
      }
    })

  } catch (error) {
    console.error('Error deleting attribute:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
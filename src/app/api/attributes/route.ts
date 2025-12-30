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
      { id: 'opt-2', attribute_id: 'attr-1', value: 'Azul', color_hex: '#0000FF', sort_order: 2, active: true },
      { id: 'opt-3', attribute_id: 'attr-1', value: 'Verde', color_hex: '#00FF00', sort_order: 3, active: true },
      { id: 'opt-4', attribute_id: 'attr-1', value: 'Negro', color_hex: '#000000', sort_order: 4, active: true }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'attr-2',
    name: 'Talla',
    type: 'text',
    required: true,
    options: [
      { id: 'opt-5', attribute_id: 'attr-2', value: 'XS', sort_order: 1, active: true },
      { id: 'opt-6', attribute_id: 'attr-2', value: 'S', sort_order: 2, active: true },
      { id: 'opt-7', attribute_id: 'attr-2', value: 'M', sort_order: 3, active: true },
      { id: 'opt-8', attribute_id: 'attr-2', value: 'L', sort_order: 4, active: true },
      { id: 'opt-9', attribute_id: 'attr-2', value: 'XL', sort_order: 5, active: true },
      { id: 'opt-10', attribute_id: 'attr-2', value: 'XXL', sort_order: 6, active: true }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'attr-3',
    name: 'Material',
    type: 'text',
    required: false,
    options: [
      { id: 'opt-11', attribute_id: 'attr-3', value: 'Algodón', sort_order: 1, active: true },
      { id: 'opt-12', attribute_id: 'attr-3', value: 'Poliéster', sort_order: 2, active: true },
      { id: 'opt-13', attribute_id: 'attr-3', value: 'Mezcla', sort_order: 3, active: true }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// GET /api/attributes - Obtener todos los atributos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    let filteredAttributes = [...mockAttributes]

    // Filtrar por tipo
    if (type) {
      filteredAttributes = filteredAttributes.filter(attr => attr.type === type)
    }

    return NextResponse.json({
      success: true,
      data: filteredAttributes
    })

  } catch (error) {
    console.error('Error fetching attributes:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/attributes - Crear nuevo atributo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validaciones básicas
    if (!body.name || !body.type) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: name, type' },
        { status: 400 }
      )
    }

    // Verificar que el nombre no exista
    const existingAttribute = mockAttributes.find(attr => 
      attr.name.toLowerCase() === body.name.toLowerCase()
    )
    if (existingAttribute) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un atributo con ese nombre' },
        { status: 409 }
      )
    }

    const newAttribute: VariantAttribute = {
      id: `attr-${Date.now()}`,
      name: body.name,
      type: body.type,
      required: body.required || false,
      options: body.options || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    mockAttributes.push(newAttribute)

    return NextResponse.json({
      success: true,
      data: newAttribute
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating attribute:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/attributes - Actualizar orden de atributos
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { attributes } = body

    if (!Array.isArray(attributes)) {
      return NextResponse.json(
        { success: false, error: 'Se esperaba un array de atributos' },
        { status: 400 }
      )
    }

    // Actualizar atributos
    for (const attrData of attributes) {
      const attrIndex = mockAttributes.findIndex(attr => attr.id === attrData.id)
      if (attrIndex !== -1) {
        mockAttributes[attrIndex].updated_at = new Date().toISOString()
      }
    }

    return NextResponse.json({
      success: true,
      data: mockAttributes,
      message: 'Orden de atributos actualizado'
    })

  } catch (error) {
    console.error('Error updating attributes order:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
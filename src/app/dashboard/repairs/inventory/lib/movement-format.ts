// Traduce movement_type (inglés o español) a etiqueta y color legibles.
// Compartido entre el historial por producto y la pestaña de Movimientos.
export function formatMovementType(type: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    in:         { label: '↑ Entrada',   className: 'bg-green-500 text-white' },
    entrada:    { label: '↑ Entrada',   className: 'bg-green-500 text-white' },
    out:        { label: '↓ Salida',    className: 'bg-red-500 text-white' },
    salida:     { label: '↓ Salida',    className: 'bg-red-500 text-white' },
    venta:      { label: '↓ Venta',     className: 'bg-red-500 text-white' },
    adjustment: { label: '⚖ Ajuste',   className: 'bg-blue-500 text-white' },
    ajuste:     { label: '⚖ Ajuste',   className: 'bg-blue-500 text-white' },
    transfer:   { label: '⇄ Traslado', className: 'bg-purple-500 text-white' },
    reparacion: { label: '🔧 Reparación', className: 'bg-amber-500 text-white' },
  }
  return map[type] ?? { label: type, className: 'bg-gray-500 text-white' }
}

"use client"

import { toast } from "sonner"

export function showAddToCartToast(args: { name: string; quantity?: number; onUndo?: () => void }) {
  const { name, quantity, onUndo } = args
  const desc = quantity && quantity > 1 ? `${name} ×${quantity} añadido` : `${name} añadido`
  toast.success("Producto agregado", {
    id: "pos-add-cart",
    description: desc,
    duration: 2000,
    action: onUndo
      ? {
          label: "Deshacer",
          onClick: () => onUndo(),
        }
      : undefined,
  })
}

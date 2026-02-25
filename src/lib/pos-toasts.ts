"use client"

import { toast } from "sonner"

let lastAddToast = { name: "", at: 0 }

export function showAddToCartToast(args: { name: string; quantity?: number; onUndo?: () => void }) {
  const { name, quantity, onUndo } = args
  const now = Date.now()

  // Avoid duplicate notifications caused by rapid/double event firing.
  if (lastAddToast.name === name && now - lastAddToast.at < 600) return
  lastAddToast = { name, at: now }

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

/** Shared millimetre layout for thermal HTML and PDF receipts. */
export function installmentProgressLayout(total: number, paid: number, widthMm: number) {
  if (!Number.isInteger(total) || total < 1 || total > 60 ||
      !Number.isInteger(paid) || paid < 0 || paid > total ||
      !Number.isFinite(widthMm) || widthMm < 5) return null

  const columns = Math.min(total, 12, Math.max(1, Math.floor(widthMm / 5)))
  const rows = Math.ceil(total / columns)
  const size = 4
  const step = 5
  return {
    width: columns * step - 1,
    height: rows * step - 1,
    label: `${paid} de ${total} pagadas · Faltan ${total - paid}`,
    boxes: Array.from({ length: total }, (_, index) => ({
      x: (index % columns) * step,
      y: Math.floor(index / columns) * step,
      size,
      paid: index < paid,
    })),
  }
}

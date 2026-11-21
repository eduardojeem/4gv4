/**
 * Atajo 1-9 del POS sin confundirlo con un lector de códigos de barras.
 *
 * El lector «teclea» el código entero en pocos milisegundos, y cada dígito
 * disparaba el atajo: un escaneo sumaba al carrito los productos de esas
 * posiciones de la lista. El dígito se confirma recién si no llega otra tecla
 * en `delayMs`; si llega, es una ráfaga del lector y se descarta hasta que
 * vuelva a haber una pausa.
 */
export function createDigitShortcutGuard(onDigit: (digit: number) => void, delayMs = 120) {
  let pending: ReturnType<typeof setTimeout> | null = null
  let burstUntil = 0

  const cancel = () => {
    if (pending) clearTimeout(pending)
    pending = null
  }

  return {
    /** Llamar con cada tecla (sin Ctrl/Cmd) que llega fuera de un campo de texto. */
    handleKey(key: string, now = Date.now()) {
      const inBurst = pending !== null || now < burstUntil
      if (inBurst) {
        // Otra tecla durante la espera: es una ráfaga del lector.
        cancel()
        burstUntil = now + delayMs
        return
      }
      if (!/^[1-9]$/.test(key)) return
      pending = setTimeout(() => {
        pending = null
        onDigit(Number(key))
      }, delayMs)
    },
    dispose: cancel,
  }
}

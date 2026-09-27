/**
 * Interruptor de apagado del service worker.
 *
 * Un service worker instalado es pegajoso: sigue interceptando peticiones en el
 * navegador del usuario aunque despliegues una correccion. Si tuviera un bug,
 * sin este interruptor no habria forma de desactivarlo a distancia.
 *
 * Funciona porque el service worker nunca cachea HTML: las navegaciones van
 * siempre a la red, asi que un despliegue con la bandera en "off" llega si o si
 * al usuario y desde ahi se desregistra solo.
 */

/** Poner en '1' o 'true' y desplegar para apagar el service worker en todos lados. */
export function isServiceWorkerDisabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER
  return flag === '1' || flag === 'true'
}

/**
 * Desregistra cualquier service worker y borra sus caches.
 *
 * Se usa tanto para el apagado de emergencia como en desarrollo, donde un SW
 * activo serviria assets viejos por encima de lo que recompila el dev server.
 */
export async function unregisterServiceWorkers(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))

    // Sin borrar las caches, el contenido guardado sobrevive al desregistro y
    // puede volver a servirse si el SW se reactivara mas adelante.
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Un fallo aca no debe romper la pagina: el SW simplemente sigue como estaba.
  }
}

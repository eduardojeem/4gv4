import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Lo que abre otra pantalla nativa encima (el navegador, un aviso, Face ID)
 * tiene que esperar a que el menú termine de cerrarse. En iOS, si el navegador
 * se abre mientras el modal todavía se está yendo, queda colgado del modal y se
 * cierra con él: la promesa no termina y cada toque siguiente en «Panel admin»
 * falla porque «ya hay un navegador abierto». La app parece congelada.
 *
 * `schedule(action)` antes de cerrar y `onDismiss` en el <Modal>. Si el sistema
 * no avisa (Android viejo), se ejecuta igual al rato.
 */
export function useAfterDismiss() {
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onDismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);

  const schedule = useCallback((action: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = action;
    timer.current = setTimeout(onDismiss, Platform.OS === 'ios' ? 800 : 60);
  }, [onDismiss]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { schedule, onDismiss };
}

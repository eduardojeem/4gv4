import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ scroll: vi.fn(), input: { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 450, 200, 80) }, visible: true, listeners: new Map<string, () => void>(), remove: vi.fn() }));
vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Keyboard: { isVisible: () => native.visible, addListener: (name: string, callback: () => void) => { native.listeners.set(name, callback); return { remove: native.remove }; } },
    TextInput: { State: { currentlyFocusedInput: () => native.input } },
    ScrollView: React.forwardRef(function MockScroll({ children, onFocus }: { children: React.ReactNode; onFocus: () => void }, ref) {
      React.useImperativeHandle(ref, () => ({ scrollTo: native.scroll, getNativeScrollRef: () => ({ measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 200, 300, 250) }) }));
      return React.createElement('div', { onFocus }, children);
    }),
  };
});
// El runner web y la app tienen instalaciones de React separadas: compartir hooks en esta prueba.
vi.mock('../../mobile/node_modules/react', async () => await import('react'));
import { KeyboardFormScroll } from '../../mobile/src/components/keyboard-form-scroll';

describe('formulario nativo desplazable con teclado', () => {
  beforeEach(() => {
    vi.useFakeTimers(); native.scroll.mockClear(); native.remove.mockClear(); native.visible = true;
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('recupera el campo enfocado cuando aparece el teclado', () => {
    const view = render(<KeyboardFormScroll><input aria-label="Efectivo contado" /></KeyboardFormScroll>);
    act(() => { native.listeners.get('keyboardDidShow')?.(); vi.runAllTimers(); });
    expect(native.scroll).toHaveBeenCalledWith({ y: 100, animated: true });
    view.unmount(); expect(native.remove).toHaveBeenCalled();
  });
  it('desplaza al cambiar de campo con el teclado abierto', () => {
    const view = render(<KeyboardFormScroll><input aria-label="Comentario" /></KeyboardFormScroll>);
    fireEvent.focus(view.getByLabelText('Comentario'));
    act(() => vi.runAllTimers());
    expect(native.scroll).toHaveBeenCalled(); view.unmount();
  });
  it('no desplaza contenido cuando el teclado está cerrado', () => {
    native.visible = false;
    const view = render(<KeyboardFormScroll><input aria-label="Comentario" /></KeyboardFormScroll>);
    fireEvent.focus(view.getByLabelText('Comentario'));
    act(() => vi.runAllTimers());
    expect(native.scroll).not.toHaveBeenCalled(); view.unmount();
  });
});
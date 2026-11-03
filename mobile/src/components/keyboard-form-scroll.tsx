import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, ScrollView, TextInput, type ScrollViewProps } from 'react-native';

/** Al abrir el teclado o enfocar otro campo, desplaza el formulario hasta el input. */
export function KeyboardFormScroll({ children, style, onLayout, onFocus, onScroll, ...props }: ScrollViewProps) {
  const scroll = useRef<ScrollView>(null);
  const frame = useRef<number | null>(null);
  const offset = useRef(0);
  const reveal = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!Keyboard.isVisible()) return;
      const input = TextInput.State.currentlyFocusedInput();
      if (!input) return;
      const container = scroll.current;
      // Comparar contra el área desplazable, no contra el teclado: el pie ocupa espacio propio.
      container?.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
        input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
          if (!container || height <= 0) return;
          const bottomOverflow = inputTop + inputHeight + 20 - (top + height);
          const topOverflow = inputTop - top - 20;
          const delta = bottomOverflow > 0 ? bottomOverflow : topOverflow < 0 ? topOverflow : 0;
          if (delta) container.scrollTo({ y: Math.max(0, offset.current + delta), animated: true });
        });
      });
    });
  }, []);
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', reveal);
    return () => { subscription.remove(); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [reveal]);
  return (
    <ScrollView
      {...props}
      ref={scroll}
      style={[{ flexShrink: 1, minHeight: 0 }, style]}
      onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onFocus={(event) => { onFocus?.(event); reveal(); }}
      onLayout={(event) => { onLayout?.(event); reveal(); }}>
      {children}
    </ScrollView>
  );
}
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { palette, usePalette } from '@/lib/palette';
import {
  MAX_REPAIR_ACCESS_LENGTH,
  appendPatternDot,
  dotAtGridPoint,
  dotCenter,
  formatDotsToPattern,
  parsePatternToDots,
  patternSegmentsForGrid,
} from '@/lib/repair-access';

export { formatDotsToPattern, parsePatternToDots };

const GRID_SIZE = 240;
const LINE_THICKNESS = 5;

type DragCursor = { x: number; y: number };

type GestureSession = {
  snapshot: number[];
  initialDot: number | null;
  addedOnGrant: boolean;
  currentDots: number[];
  moved: boolean;
  freshMode: boolean;
  startX: number;
  startY: number;
  startPageX: number | null;
  startPageY: number | null;
};

function dotColor(
  indexInPattern: number,
  totalDots: number,
  colors: ReturnType<typeof usePalette>,
): string {
  if (indexInPattern === 0) return colors.isDark ? '#22C55E' : '#16A34A';
  if (indexInPattern === totalDots - 1 && totalDots > 1) return colors.isDark ? '#F43F5E' : '#E11D48';
  return colors.accent;
}

/** Selector interactivo 3×3 de patrón de desbloqueo (táctil por arrastre, toque o teclado manual). */
export function PatternPicker({
  value,
  onChange,
  disabled = false,
  error,
  onDrawingChange,
}: {
  value: string;
  onChange: (pattern: string) => void;
  disabled?: boolean;
  error?: string | null;
  onDrawingChange?: (drawing: boolean) => void;
}) {
  const colors = usePalette();
  const [manualMode, setManualMode] = useState(false);
  const [dragCursor, setDragCursor] = useState<DragCursor | null>(null);
  const dots = useMemo(() => parsePatternToDots(value), [value]);
  const segments = useMemo(() => patternSegmentsForGrid(dots, GRID_SIZE), [dots]);

  const onDrawingChangeRef = useRef(onDrawingChange);
  const gestureRef = useRef<GestureSession | null>(null);

  useEffect(() => {
    onDrawingChangeRef.current = onDrawingChange;
  }, [onDrawingChange]);
  useEffect(() => {
    return () => {
      onDrawingChangeRef.current?.(false);
    };
  }, []);

  const removeLast = () => {
    if (disabled || dots.length === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange(formatDotsToPattern(dots.slice(0, -1)));
  };

  const clear = () => {
    if (disabled) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onChange('');
  };

  const toggleManualDot = (dotNumber: number) => {
    if (disabled) return;
    if (dots.includes(dotNumber)) {
      if (dots[dots.length - 1] === dotNumber) {
        removeLast();
      }
      return;
    }
    const next = appendPatternDot(dots, dotNumber, false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(formatDotsToPattern(next));
  };

  const handleResponderGrant = (evt: GestureResponderEvent) => {
    if (disabled || manualMode) return;
    onDrawingChange?.(true);

    const rawX = evt.nativeEvent.locationX ?? 0;
    const rawY = evt.nativeEvent.locationY ?? 0;
    const startX = Math.max(0, Math.min(GRID_SIZE, rawX));
    const startY = Math.max(0, Math.min(GRID_SIZE, rawY));
    const startPageX = typeof evt.nativeEvent.pageX === 'number' ? evt.nativeEvent.pageX : null;
    const startPageY = typeof evt.nativeEvent.pageY === 'number' ? evt.nativeEvent.pageY : null;
    const snapshot = dots;
    const initialDot = dotAtGridPoint(startX, startY, GRID_SIZE);

    let currentDots = snapshot;
    let addedOnGrant = false;
    if (snapshot.length < 2 && initialDot !== null) {
      const next = appendPatternDot(snapshot, initialDot, true);
      if (next.length > snapshot.length) {
        currentDots = next;
        addedOnGrant = true;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(formatDotsToPattern(next));
      }
    }

    gestureRef.current = {
      snapshot,
      initialDot,
      addedOnGrant,
      currentDots,
      moved: false,
      freshMode: false,
      startX,
      startY,
      startPageX,
      startPageY,
    };
    setDragCursor({ x: startX, y: startY });
  };

  const handleResponderMove = (evt: GestureResponderEvent) => {
    const session = gestureRef.current;
    if (!session || disabled || manualMode) return;

    const { pageX, pageY, locationX, locationY } = evt.nativeEvent;
    const dx =
      session.startPageX !== null && typeof pageX === 'number'
        ? pageX - session.startPageX
        : (locationX ?? session.startX) - session.startX;
    const dy =
      session.startPageY !== null && typeof pageY === 'number'
        ? pageY - session.startPageY
        : (locationY ?? session.startY) - session.startY;
    const x = session.startX + dx;
    const y = session.startY + dy;
    const dist = Math.hypot(dx, dy);
    if (dist > 8) session.moved = true;

    setDragCursor({
      x: Math.max(4, Math.min(GRID_SIZE - 4, x)),
      y: Math.max(4, Math.min(GRID_SIZE - 4, y)),
    });

    const hitDot = dotAtGridPoint(x, y, GRID_SIZE);
    if (hitDot === null) return;

    // Si ya había un patrón completo y el usuario desliza sobre los puntos, redibuja desde cero sin tener que apretar Limpiar.
    if (!session.freshMode && session.snapshot.length >= 2 && session.moved) {
      if (session.initialDot === null || hitDot !== session.initialDot || dist > 18) {
        session.freshMode = true;
        let fresh = session.initialDot !== null ? [session.initialDot] : [];
        fresh = appendPatternDot(fresh, hitDot, true);
        session.currentDots = fresh;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(formatDotsToPattern(fresh));
        return;
      }
    }

    if (session.snapshot.length < 2 || session.freshMode) {
      const next = appendPatternDot(session.currentDots, hitDot, true);
      if (next.length > session.currentDots.length) {
        session.currentDots = next;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(formatDotsToPattern(next));
      }
    }
  };

  const handleResponderRelease = () => {
    const session = gestureRef.current;
    gestureRef.current = null;
    setDragCursor(null);
    onDrawingChange?.(false);

    if (!session || disabled || manualMode) return;
    if (!session.freshMode && !session.moved && session.initialDot !== null) {
      const base = session.snapshot;
      const tappedLast = base.length > 0 && base[base.length - 1] === session.initialDot;
      if (!session.addedOnGrant && tappedLast) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onChange(formatDotsToPattern(base.slice(0, -1)));
      } else if (base.length >= 2 && !base.includes(session.initialDot)) {
        const next = appendPatternDot(base, session.initialDot, false);
        if (next.length > base.length) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange(formatDotsToPattern(next));
        }
      }
    }
  };

  const handleResponderTerminate = () => {
    gestureRef.current = null;
    setDragCursor(null);
    onDrawingChange?.(false);
  };

  // Segmento activo desde el último punto al dedo durante el arrastre
  const liveSegment = useMemo(() => {
    if (!dragCursor || dots.length === 0) return null;
    const lastCenter = dotCenter(dots[dots.length - 1], GRID_SIZE);
    const dx = dragCursor.x - lastCenter.x;
    const dy = dragCursor.y - lastCenter.y;
    const length = Math.hypot(dx, dy);
    if (length < 8) return null;
    return {
      midX: (lastCenter.x + dragCursor.x) / 2,
      midY: (lastCenter.y + dragCursor.y) / 2,
      length,
      angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  }, [dragCursor, dots]);

  const statusColor =
    dots.length >= 4
      ? colors.successText
      : dots.length === 1
        ? colors.dangerText
        : dots.length >= 2
          ? colors.warningText
          : colors.muted;

  const statusLabel =
    dots.length === 0
      ? 'Deslizá o tocá los puntos para unirlos'
      : dots.length === 1
        ? '1 punto · faltan al menos 1 más (mínimo 2)'
        : `${dots.length} puntos conectados${dots.length < 4 ? ' (válido · 4+ recomendado)' : ' ✓'}`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: error ? colors.dangerText : colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: colors.text }]}>Patrón de desbloqueo 3×3</Text>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Pressable
          onPress={() => setManualMode((prev) => !prev)}
          hitSlop={8}
          disabled={disabled}
          style={[
            styles.modeToggle,
            {
              borderColor: manualMode ? colors.accent : colors.border,
              backgroundColor: manualMode ? colors.accentSoft : colors.background,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={manualMode ? 'Volver a dibujar en cuadrícula' : 'Cambiar a carga manual con números'}
        >
          <Ionicons name={manualMode ? 'grid-outline' : 'keypad-outline'} size={15} color={colors.accent} />
          <Text style={[styles.modeToggleText, { color: colors.accent }]}>{manualMode ? 'Dibujar' : 'Manual'}</Text>
        </Pressable>
      </View>

      {manualMode ? (
        <View style={styles.manualWrap}>
          <Text style={[styles.manualHint, { color: colors.muted }]}>
            Tocá los números del teclado 1–9 o escribí la secuencia (ej. 1-2-5-8):
          </Text>
          <View style={styles.numPad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const idx = dots.indexOf(num);
              const selected = idx !== -1;
              const tone = selected ? dotColor(idx, dots.length, colors) : colors.border;
              return (
                <Pressable
                  key={num}
                  onPress={() => toggleManualDot(num)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={`Punto ${num}${selected ? `, paso ${idx + 1}` : ''}`}
                  style={[
                    styles.numKey,
                    {
                      borderColor: selected ? tone : colors.border,
                      backgroundColor: selected ? `${tone}1E` : colors.background,
                    },
                  ]}
                >
                  <Text style={[styles.numKeyText, { color: selected ? tone : colors.text }]}>{num}</Text>
                  {selected ? (
                    <View style={[styles.numKeyOrder, { backgroundColor: tone }]}>
                      <Text style={styles.numKeyOrderText}>{idx + 1}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={value}
            onChangeText={onChange}
            editable={!disabled}
            placeholder="Ej: 1-2-5-8 o descripción breve"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={MAX_REPAIR_ACCESS_LENGTH}
            accessibilityLabel="Secuencia manual del patrón"
            style={[
              styles.manualInput,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
            ]}
          />
          <View style={styles.actionsRow}>
            <Pressable
              onPress={removeLast}
              disabled={disabled || dots.length === 0}
              style={[styles.actionBtn, { borderColor: colors.border, opacity: disabled || dots.length === 0 ? 0.4 : 1 }]}
            >
              <Ionicons name="arrow-undo-outline" size={16} color={colors.text} />
              <Text style={[styles.actionBtnText, { color: colors.text }]}>Deshacer</Text>
            </Pressable>
            <Pressable
              onPress={clear}
              disabled={disabled || !value.trim()}
              style={[
                styles.actionBtn,
                { borderColor: `${colors.dangerText}55`, backgroundColor: `${colors.dangerText}12`, opacity: disabled || !value.trim() ? 0.4 : 1 },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.dangerText} />
              <Text style={[styles.actionBtnText, { color: colors.dangerText }]}>Limpiar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.canvasContainer}>
          {/* Grilla táctil unificada: los hijos usan pointerEvents="none" para evitar saltos de locationX/Y */}
          <View
            collapsable={false}
            accessibilityLabel="Cuadrícula 3 por 3 para dibujar patrón de desbloqueo"
            onStartShouldSetResponder={() => !disabled && !manualMode}
            onMoveShouldSetResponder={() => !disabled && !manualMode}
            onResponderTerminationRequest={() => false}
            onResponderGrant={handleResponderGrant}
            onResponderMove={handleResponderMove}
            onResponderRelease={handleResponderRelease}
            onResponderTerminate={handleResponderTerminate}
            style={[
              styles.grid,
              {
                width: GRID_SIZE,
                height: GRID_SIZE,
                borderColor: dragCursor ? colors.accent : colors.border,
                backgroundColor: colors.isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(241, 245, 249, 0.75)',
              },
            ]}
          >
            {/* Líneas entre puntos conectados */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {segments.map((seg) => (
                <View
                  key={seg.key}
                  style={[
                    styles.lineSegment,
                    {
                      left: seg.midX - seg.length / 2,
                      top: seg.midY - LINE_THICKNESS / 2,
                      width: seg.length,
                      height: LINE_THICKNESS,
                      borderRadius: LINE_THICKNESS / 2,
                      backgroundColor: colors.accent,
                      transform: [{ rotate: `${seg.angleDeg}deg` }],
                    },
                  ]}
                />
              ))}
              {liveSegment ? (
                <View
                  style={[
                    styles.liveLineSegment,
                    {
                      left: liveSegment.midX - liveSegment.length / 2,
                      top: liveSegment.midY - 2,
                      width: liveSegment.length,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.accent,
                      transform: [{ rotate: `${liveSegment.angleDeg}deg` }],
                    },
                  ]}
                />
              ) : null}
            </View>

            {/* 9 puntos de la grilla */}
            <View pointerEvents="none" style={styles.gridOverlay}>
              {[0, 1, 2].map((row) => (
                <View key={`row-${row}`} style={styles.gridRow}>
                  {[0, 1, 2].map((col) => {
                    const dotNumber = row * 3 + col + 1;
                    const indexInPattern = dots.indexOf(dotNumber);
                    const isSelected = indexInPattern !== -1;
                    const activeColor = isSelected ? dotColor(indexInPattern, dots.length, colors) : colors.border;

                    return (
                      <View key={`dot-${dotNumber}`} style={styles.cell}>
                        <View
                          style={[
                            styles.dotCircle,
                            {
                              borderColor: isSelected ? activeColor : colors.border,
                              backgroundColor: isSelected
                                ? colors.card
                                : colors.isDark
                                  ? 'rgba(30, 41, 59, 0.9)'
                                  : '#FFFFFF',
                            },
                          ]}
                        >
                          {isSelected ? (
                            <View style={[styles.orderBadge, { backgroundColor: activeColor }]}>
                              <Text style={styles.orderBadgeText}>{indexInPattern + 1}</Text>
                            </View>
                          ) : (
                            <View style={[styles.dotCore, { backgroundColor: colors.muted }]} />
                          )}
                          <Text style={[styles.dotLabel, { color: isSelected ? activeColor : colors.muted }]}>
                            {dotNumber}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {dots.length >= 2 ? (
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.isDark ? '#22C55E' : '#16A34A' }]} />
                <Text style={[styles.legendText, { color: colors.muted }]}>Inicio</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.legendText, { color: colors.muted }]}>Recorrido</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.isDark ? '#F43F5E' : '#E11D48' }]} />
                <Text style={[styles.legendText, { color: colors.muted }]}>Fin</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.gestureTip, { color: colors.muted }]}>
              Uní al menos 2 puntos en orden. También podés tocar uno por uno.
            </Text>
          )}

          {dots.length > 0 ? (
            <View style={[styles.sequenceBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.seqLabel, { color: colors.muted }]}>Ruta:</Text>
              <View style={styles.seqPills}>
                {dots.map((dot, idx) => {
                  const tone = dotColor(idx, dots.length, colors);
                  return (
                    <React.Fragment key={`seq-${dot}-${idx}`}>
                      {idx > 0 ? <Text style={[styles.arrowText, { color: colors.muted }]}>→</Text> : null}
                      <View style={[styles.seqPill, { backgroundColor: `${tone}1E`, borderColor: tone }]}>
                        <Text style={[styles.seqPillText, { color: tone }]}>{dot}</Text>
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={removeLast}
              disabled={disabled || dots.length === 0}
              style={[styles.actionBtn, { borderColor: colors.border, opacity: disabled || dots.length === 0 ? 0.4 : 1 }]}
              accessibilityLabel="Deshacer último punto"
            >
              <Ionicons name="arrow-undo-outline" size={16} color={colors.text} />
              <Text style={[styles.actionBtnText, { color: colors.text }]}>Deshacer</Text>
            </Pressable>
            <Pressable
              onPress={clear}
              disabled={disabled || dots.length === 0}
              style={[
                styles.actionBtn,
                {
                  borderColor: `${colors.dangerText}55`,
                  backgroundColor: `${colors.dangerText}12`,
                  opacity: disabled || dots.length === 0 ? 0.4 : 1,
                },
              ]}
              accessibilityLabel="Borrar patrón"
            >
              <Ionicons name="trash-outline" size={16} color={colors.dangerText} />
              <Text style={[styles.actionBtnText, { color: colors.dangerText }]}>Limpiar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {error ? <Text style={[styles.errorText, { color: colors.dangerText }]}>{error}</Text> : null}
    </View>
  );
}

/** Vista compacta de solo lectura para mostrar un patrón guardado en el detalle de la orden. */
export function PatternPreview({
  value,
  size = 132,
  showRoute = true,
}: {
  value?: string | null;
  size?: number;
  showRoute?: boolean;
}) {
  const colors = usePalette();
  const dots = useMemo(() => parsePatternToDots(value), [value]);
  const segments = useMemo(() => patternSegmentsForGrid(dots, size), [dots, size]);

  if (dots.length === 0) return null;

  const dotDiameter = Math.max(24, Math.round(size * 0.22));
  const badgeDiameter = Math.max(16, Math.round(dotDiameter * 0.62));
  const thickness = Math.max(3, Math.round(size * 0.025));

  return (
    <View style={styles.previewWrap}>
      <View
        pointerEvents="none"
        style={[
          styles.previewGrid,
          {
            width: size,
            height: size,
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <View style={StyleSheet.absoluteFill}>
          {segments.map((seg) => (
            <View
              key={seg.key}
              style={[
                styles.lineSegment,
                {
                  left: seg.midX - seg.length / 2,
                  top: seg.midY - thickness / 2,
                  width: seg.length,
                  height: thickness,
                  borderRadius: thickness / 2,
                  backgroundColor: colors.accent,
                  transform: [{ rotate: `${seg.angleDeg}deg` }],
                },
              ]}
            />
          ))}
        </View>
        {[0, 1, 2].map((row) => (
          <View key={`p-row-${row}`} style={styles.gridRow}>
            {[0, 1, 2].map((col) => {
              const dotNumber = row * 3 + col + 1;
              const idx = dots.indexOf(dotNumber);
              const selected = idx !== -1;
              const tone = selected ? dotColor(idx, dots.length, colors) : colors.border;
              return (
                <View key={`p-dot-${dotNumber}`} style={styles.cell}>
                  <View
                    style={[
                      styles.previewDot,
                      {
                        width: dotDiameter,
                        height: dotDiameter,
                        borderRadius: dotDiameter / 2,
                        borderColor: selected ? tone : colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                  >
                    {selected ? (
                      <View
                        style={[
                          styles.previewBadge,
                          {
                            width: badgeDiameter,
                            height: badgeDiameter,
                            borderRadius: badgeDiameter / 2,
                            backgroundColor: tone,
                          },
                        ]}
                      >
                        <Text style={styles.previewBadgeText}>{idx + 1}</Text>
                      </View>
                    ) : (
                      <View style={[styles.previewCore, { backgroundColor: colors.muted }]} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {showRoute ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.isDark ? '#22C55E' : '#16A34A' }]} />
            <Text style={[styles.legendText, { color: colors.muted }]}>Inicio</Text>
          </View>
          <Text style={[styles.previewRouteText, { color: colors.text }]}>{dots.join(' → ')}</Text>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.isDark ? '#F43F5E' : '#E11D48' }]} />
            <Text style={[styles.legendText, { color: colors.muted }]}>Fin</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  manualWrap: {
    gap: 10,
    paddingTop: 2,
  },
  manualHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  numPad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'center',
    width: 220,
  },
  numKey: {
    width: 68,
    height: 46,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  numKeyText: {
    fontSize: 17,
    fontWeight: '800',
  },
  numKeyOrder: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numKeyOrderText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  manualInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  canvasContainer: {
    alignItems: 'center',
    gap: 10,
  },
  grid: {
    borderWidth: 1.5,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  gridOverlay: {
    flex: 1,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineSegment: {
    position: 'absolute',
    opacity: 0.72,
  },
  liveLineSegment: {
    position: 'absolute',
    opacity: 0.35,
  },
  dotCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dotCore: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  dotLabel: {
    position: 'absolute',
    bottom: 2,
    fontSize: 9,
    fontWeight: '700',
    opacity: 0.7,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gestureTip: {
    fontSize: 11,
    textAlign: 'center',
  },
  sequenceBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  seqLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  seqPills: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  arrowText: {
    fontSize: 12,
    fontWeight: '700',
  },
  seqPill: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 23,
    alignItems: 'center',
  },
  seqPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  previewWrap: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  previewGrid: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  previewDot: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.55,
  },
  previewBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  previewRouteText: {
    fontSize: 12,
    fontWeight: '800',
  },
});

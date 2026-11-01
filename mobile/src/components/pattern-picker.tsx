import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { palette, usePalette } from '@/lib/palette';

export function parsePatternToDots(value?: string | null): number[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  // 1. Formato con coordenadas: "(11-12-22-32)" o similar
  const parenMatches = Array.from(trimmed.matchAll(/\(([^)]+)\)/g));
  const lastParen = parenMatches.length > 0 ? parenMatches[parenMatches.length - 1][1] : null;
  if (lastParen) {
    const codes = lastParen.split(/[-\s,]+/);
    const dots: number[] = [];
    for (const code of codes) {
      if (code.length === 2) {
        const r = parseInt(code[0], 10);
        const c = parseInt(code[1], 10);
        if (r >= 1 && r <= 3 && c >= 1 && c <= 3) {
          const dotNumber = (r - 1) * 3 + c;
          if (!dots.includes(dotNumber)) {
            dots.push(dotNumber);
          }
        }
      }
    }
    if (dots.length > 0) return dots;
  }

  // 2. Formato con dígitos simples 1-9: "1-2-5-8" o "1258"
  const digits = trimmed.replace(/[^1-9]/g, '');
  if (digits.length > 0 && digits.length <= 9) {
    const uniqueDots: number[] = [];
    for (const ch of digits) {
      const d = parseInt(ch, 10);
      if (!uniqueDots.includes(d)) {
        uniqueDots.push(d);
      }
    }
    return uniqueDots;
  }
  return [];
}

export function formatDotsToPattern(dots: number[]): string {
  if (dots.length === 0) return '';
  const seq = dots.join('-');
  const coords = dots
    .map((dot) => {
      const r = Math.floor((dot - 1) / 3) + 1;
      const c = ((dot - 1) % 3) + 1;
      return `${r}${c}`;
    })
    .join('-');
  return `Patrón: ${seq} (${coords})`;
}

const GRID_SIZE = 240;
const CELL_SIZE = GRID_SIZE / 3; // 80px por celda

export function PatternPicker({
  value,
  onChange,
  disabled = false,
  error,
}: {
  value: string;
  onChange: (pattern: string) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const colors = usePalette();
  const [manualMode, setManualMode] = useState(false);
  const dots = useMemo(() => parsePatternToDots(value), [value]);

  const dotsRef = useRef(dots);
  dotsRef.current = dots;

  const addDot = (dotNumber: number) => {
    if (disabled) return;
    const current = dotsRef.current;
    if (current.includes(dotNumber)) return;
    const next = [...current, dotNumber];
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(formatDotsToPattern(next));
  };

  const removeLast = () => {
    if (disabled || dots.length === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = dots.slice(0, -1);
    onChange(formatDotsToPattern(next));
  };

  const clear = () => {
    if (disabled) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onChange('');
  };

  // PanResponder para permitir deslizamiento continuo del dedo entre puntos
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !manualMode,
      onMoveShouldSetPanResponder: () => !disabled && !manualMode,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        handleTouchCoordinate(locationX, locationY);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        handleTouchCoordinate(locationX, locationY);
      },
    })
  ).current;

  const handleTouchCoordinate = (x: number, y: number) => {
    if (x < 0 || x > GRID_SIZE || y < 0 || y > GRID_SIZE) return;
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    if (row >= 0 && row < 3 && col >= 0 && col < 3) {
      // Verificar distancia al centro de la celda para no activar bordes accidentales
      const centerX = col * CELL_SIZE + CELL_SIZE / 2;
      const centerY = row * CELL_SIZE + CELL_SIZE / 2;
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance <= CELL_SIZE * 0.46) {
        const dotNumber = row * 3 + col + 1;
        addDot(dotNumber);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: error ? palette.danger : colors.border }]}>
      {/* Encabezado con estado y modo manual */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: colors.text }]}>Patrón de desbloqueo</Text>
          <Text style={[styles.statusText, { color: dots.length >= 4 ? palette.success : dots.length >= 2 ? '#D97706' : colors.muted }]}>
            {dots.length === 0
              ? 'Tocá o deslizá sobre los puntos'
              : `${dots.length} ${dots.length === 1 ? 'punto' : 'puntos'} conectado${dots.length === 1 ? '' : 's'}${dots.length < 4 ? ' (mínimo 4 recomendado)' : ' ✓'}`}
          </Text>
        </View>
        <Pressable
          onPress={() => setManualMode((prev) => !prev)}
          hitSlop={8}
          style={[styles.modeToggle, { borderColor: colors.border }]}
          accessibilityLabel={manualMode ? 'Volver a la cuadrícula' : 'Modo texto manual'}>
          <Ionicons name={manualMode ? 'grid-outline' : 'keypad-outline'} size={16} color={palette.primary} />
          <Text style={[styles.modeToggleText, { color: palette.primary }]}>{manualMode ? 'Gráfico' : 'Manual'}</Text>
        </Pressable>
      </View>

      {manualMode ? (
        <View style={styles.manualWrap}>
          <Text style={[styles.manualHint, { color: colors.muted }]}>
            Podés escribir la secuencia de números (ej. 1-2-5-8 o 1235789):
          </Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Ej: 1-2-5-8"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={[styles.manualInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          />
        </View>
      ) : (
        <View style={styles.canvasContainer}>
          {/* Cuadrícula interactiva 3x3 */}
          <View style={[styles.grid, { width: GRID_SIZE, height: GRID_SIZE }]} {...panResponder.panHandlers}>
            {[0, 1, 2].map((row) => (
              <View key={`row-${row}`} style={styles.gridRow}>
                {[0, 1, 2].map((col) => {
                  const dotNumber = row * 3 + col + 1;
                  const indexInPattern = dots.indexOf(dotNumber);
                  const isSelected = indexInPattern !== -1;
                  const isFirst = indexInPattern === 0;
                  const isLast = isSelected && indexInPattern === dots.length - 1 && dots.length > 1;

                  return (
                    <Pressable
                      key={`dot-${dotNumber}`}
                      onPress={() => {
                        if (isSelected && isLast) {
                          removeLast();
                        } else if (!isSelected) {
                          addDot(dotNumber);
                        }
                      }}
                      style={styles.cell}>
                      <View
                        style={[
                          styles.dotCircle,
                          {
                            borderColor: isSelected
                              ? isFirst
                                ? palette.success
                                : isLast
                                  ? palette.danger
                                  : palette.primary
                              : colors.border,
                            backgroundColor: isSelected
                              ? isFirst
                                ? `${palette.success}22`
                                : isLast
                                  ? `${palette.danger}22`
                                  : `${palette.primary}18`
                              : colors.background,
                          },
                        ]}>
                        {isSelected ? (
                          <View
                            style={[
                              styles.orderBadge,
                              {
                                backgroundColor: isFirst
                                  ? palette.success
                                  : isLast
                                    ? palette.danger
                                    : palette.primary,
                              },
                            ]}>
                            <Text style={styles.orderBadgeText}>{indexInPattern + 1}</Text>
                          </View>
                        ) : (
                          <View style={[styles.dotCore, { backgroundColor: colors.muted }]} />
                        )}
                        <Text style={[styles.dotLabel, { color: colors.muted }]}>{dotNumber}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Secuencia visual del patrón */}
          {dots.length > 0 && (
            <View style={[styles.sequenceBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.seqLabel, { color: colors.muted }]}>Ruta:</Text>
              <View style={styles.seqPills}>
                {dots.map((dot, idx) => (
                  <React.Fragment key={`seq-${dot}-${idx}`}>
                    {idx > 0 && <Text style={[styles.arrowText, { color: colors.muted }]}>→</Text>}
                    <View
                      style={[
                        styles.seqPill,
                        {
                          backgroundColor:
                            idx === 0
                              ? `${palette.success}25`
                              : idx === dots.length - 1
                                ? `${palette.danger}25`
                                : `${palette.primary}25`,
                          borderColor:
                            idx === 0
                              ? palette.success
                              : idx === dots.length - 1
                                ? palette.danger
                                : palette.primary,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.seqPillText,
                          {
                            color:
                              idx === 0
                                ? palette.success
                                : idx === dots.length - 1
                                  ? palette.danger
                                  : palette.primary,
                          },
                        ]}>
                        {dot}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}

          {/* Botones de acción: Deshacer y Limpiar */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={removeLast}
              disabled={disabled || dots.length === 0}
              style={[
                styles.actionBtn,
                { borderColor: colors.border, opacity: disabled || dots.length === 0 ? 0.4 : 1 },
              ]}
              accessibilityLabel="Deshacer último punto">
              <Ionicons name="arrow-undo-outline" size={16} color={colors.text} />
              <Text style={[styles.actionBtnText, { color: colors.text }]}>Deshacer</Text>
            </Pressable>
            <Pressable
              onPress={clear}
              disabled={disabled || dots.length === 0}
              style={[
                styles.actionBtn,
                { borderColor: palette.danger, backgroundColor: `${palette.danger}10`, opacity: disabled || dots.length === 0 ? 0.4 : 1 },
              ]}
              accessibilityLabel="Borrar patrón">
              <Ionicons name="trash-outline" size={16} color={palette.danger} />
              <Text style={[styles.actionBtnText, { color: palette.danger }]}>Limpiar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  manualWrap: {
    gap: 8,
    paddingVertical: 6,
  },
  manualHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  manualInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  canvasContainer: {
    alignItems: 'center',
    gap: 12,
  },
  grid: {
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.18)',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.02)',
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
    width: 12,
    height: 12,
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
    opacity: 0.6,
  },
  sequenceBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
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
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 22,
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
    gap: 12,
    width: '100%',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
});

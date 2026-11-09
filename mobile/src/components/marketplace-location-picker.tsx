import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from './bottom-sheet';
import { usePalette, palette } from '@/lib/palette';
import type { MarketplaceHome } from '@/lib/marketplace';
import type { MarketplaceLocation } from '../../../src/lib/public/marketplace-location';

/** Devuelve la bandera emoji para cada código de país */
function getCountryFlag(code: string | null | undefined): string {
  if (!code || code === 'all' || code === 'unknown' || code.length !== 2) return '🌎';
  const upper = code.toUpperCase();
  const first = upper.charCodeAt(0) - 65 + 0x1f1e6;
  const second = upper.charCodeAt(1) - 65 + 0x1f1e6;
  return String.fromCodePoint(first, second);
}

export function MarketplaceLocationPicker({
  selection,
  facets,
  onChange,
}: {
  selection: MarketplaceLocation;
  facets: MarketplaceHome['location'];
  onChange: (next: MarketplaceLocation) => void;
}) {
  const colors = usePalette();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(selection);
  const [query, setQuery] = useState('');

  const countries = facets?.countries ?? [];
  const allCities = facets?.allCities ?? facets?.cities ?? [];

  const cities = allCities
    .filter((city) => draft.country === 'all' || (city.countryCode ?? 'unknown') === draft.country)
    .filter((city) =>
      city.label
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(
          query
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
        )
    );

  const countryName =
    selection.country === 'all'
      ? 'Todos los países'
      : countries.find((country) => country.code === selection.country)?.label ?? selection.country;

  const cityName =
    selection.city === 'all'
      ? 'Todas las ciudades'
      : facets?.allCities?.find((city) => city.key === selection.city)?.label ??
        selection.city.split(':').pop();

  const activeFlag = getCountryFlag(selection.country);
  const isCustomLocation = selection.country !== 'all' || selection.city !== 'all';

  const handleOpen = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraft(selection);
    setQuery('');
    setOpen(true);
  };

  const handleApply = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange(draft);
    setOpen(false);
  };

  const handleReset = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraft({ country: 'all', city: 'all' });
    setQuery('');
  };

  return (
    <>
      {/* ── Barra Trigger de Ubicación (Diseño Moderno & Premium) ── */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ubicación activa: ${countryName}, ${cityName}. Toca para cambiar.`}
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.triggerContainer,
          {
            backgroundColor: isCustomLocation ? `${palette.primary}12` : colors.card,
            borderColor: isCustomLocation ? `${palette.primary}40` : colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <View style={styles.triggerLeft}>
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: isCustomLocation
                  ? `${palette.primary}20`
                  : colors.background,
              },
            ]}
          >
            <Ionicons
              name="location-sharp"
              size={18}
              color={palette.primary}
            />
          </View>

          <View style={styles.triggerTextWrap}>
            <View style={styles.triggerHeadingRow}>
              <Text style={[styles.flagEmoji]}>{activeFlag}</Text>
              <Text style={[styles.triggerTitle, { color: colors.text }]} numberOfLines={1}>
                {selection.country === 'all' && selection.city === 'all'
                  ? 'Elegir ubicación'
                  : `${countryName} · ${cityName}`}
              </Text>
            </View>
            <Text style={[styles.triggerSubtitle, { color: colors.muted }]} numberOfLines={1}>
              Comercios con local y entrega directa en tu zona
            </Text>
          </View>
        </View>

        <View style={styles.triggerRight}>
          {isCustomLocation && (
            <Pressable
              hitSlop={8}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange({ country: 'all', city: 'all' });
              }}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </View>
      </Pressable>

      {/* ── Modal BottomSheet de Selección de País y Ciudad ── */}
      <BottomSheet
        visible={open}
        title="Elegí tu ubicación"
        subtitle="Mostramos comercios con atención directa y catálogo disponible en tu zona."
        onClose={() => setOpen(false)}
        tall
        footer={
          <View style={styles.footerRow}>
            <Pressable
              accessibilityRole="button"
              onPress={handleReset}
              style={[styles.resetButton, { borderColor: colors.border }]}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.text} />
              <Text style={[styles.resetButtonText, { color: colors.text }]}>Restablecer</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleApply}
              style={[styles.applyButton, { backgroundColor: palette.primary }]}
            >
              <Text style={styles.applyButtonText}>Aplicar ubicación</Text>
            </Pressable>
          </View>
        }
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
          {/* 1. SELECCIÓN DE PAÍS */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>1. País de compra</Text>

          <View style={styles.countryGrid}>
            {/* Opción Todos los países */}
            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDraft({ country: 'all', city: 'all' });
              }}
              style={({ pressed }) => [
                styles.countryCard,
                {
                  backgroundColor: draft.country === 'all'
                    ? `${palette.primary}18`
                    : colors.card,
                  borderColor: draft.country === 'all'
                    ? palette.primary
                    : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.countryFlag}>🌎</Text>
              <View style={styles.countryTextWrap}>
                <Text style={[styles.countryName, { color: colors.text }]}>Todos los países</Text>
                <Text style={[styles.countryCount, { color: colors.muted }]}>Sin filtro</Text>
              </View>
              {draft.country === 'all' && (
                <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
              )}
            </Pressable>

            {/* Países disponibles */}
            {countries.map((c) => {
              const isSelected = draft.country === c.code;
              const flag = getCountryFlag(c.code);
              return (
                <Pressable
                  key={c.code}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDraft({ country: c.code, city: 'all' });
                    setQuery('');
                  }}
                  style={({ pressed }) => [
                    styles.countryCard,
                    {
                      backgroundColor: isSelected
                        ? `${palette.primary}18`
                        : colors.card,
                      borderColor: isSelected
                        ? palette.primary
                        : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={styles.countryFlag}>{flag}</Text>
                  <View style={styles.countryTextWrap}>
                    <Text style={[styles.countryName, { color: colors.text }]}>{c.label}</Text>
                    <Text style={[styles.countryCount, { color: colors.muted }]}>
                      {c.count} {c.count === 1 ? 'tienda' : 'tiendas'}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* 2. SELECCIÓN DE CIUDAD */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 18 }]}>
            2. Ciudad o Departamento
          </Text>

          {/* Buscador de Ciudad */}
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              accessibilityLabel="Buscar ciudad"
              placeholder="Buscar ciudad por nombre..."
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            )}
          </View>

          {/* Opción Todas las ciudades */}
          <Pressable
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDraft({ ...draft, city: 'all' });
            }}
            style={({ pressed }) => [
              styles.cityRow,
              {
                backgroundColor: draft.city === 'all'
                  ? `${palette.primary}18`
                  : colors.card,
                borderColor: draft.city === 'all'
                  ? palette.primary
                  : colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="globe-outline" size={18} color={colors.muted} />
            <Text style={[styles.cityName, { color: colors.text, fontWeight: draft.city === 'all' ? '800' : '500' }]}>
              Todas las ciudades
            </Text>
            {draft.city === 'all' && (
              <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
            )}
          </Pressable>

          {/* Lista de Ciudades Filtradas */}
          {cities.map((city) => {
            const isSelected = draft.city === city.key;
            const countryOfCity = countries.find(
              (country) => country.code === (city.countryCode ?? 'unknown')
            );
            return (
              <Pressable
                key={city.key}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDraft({
                    country: city.countryCode ?? 'unknown',
                    city: city.key,
                  });
                }}
                style={({ pressed }) => [
                  styles.cityRow,
                  {
                    backgroundColor: isSelected
                      ? `${palette.primary}18`
                      : colors.card,
                    borderColor: isSelected
                      ? palette.primary
                      : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="location-outline" size={18} color={palette.primary} />
                <View style={styles.cityTextWrap}>
                  <Text style={[styles.cityName, { color: colors.text, fontWeight: isSelected ? '800' : '500' }]}>
                    {city.label}
                  </Text>
                  {draft.country === 'all' && countryOfCity && (
                    <Text style={[styles.citySubLabel, { color: colors.muted }]}>
                      {countryOfCity.label}
                    </Text>
                  )}
                </View>
                <View style={[styles.cityCountBadge, { backgroundColor: colors.border }]}>
                  <Text style={[styles.cityCountText, { color: colors.text }]}>{city.count}</Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
                )}
              </Pressable>
            );
          })}

          {!cities.length && (
            <View style={styles.emptyContainer}>
              <Ionicons name="search" size={28} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No se encontraron ciudades con &ldquo;{query}&rdquo;.
              </Text>
            </View>
          )}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  triggerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  triggerHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flagEmoji: {
    fontSize: 16,
  },
  triggerTitle: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  triggerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  triggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    padding: 4,
  },
  sheetScroll: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  countryGrid: {
    gap: 6,
  },
  countryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  countryFlag: {
    fontSize: 22,
  },
  countryTextWrap: {
    flex: 1,
  },
  countryName: {
    fontSize: 13,
    fontWeight: '700',
  },
  countryCount: {
    fontSize: 11,
    marginTop: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 6,
  },
  cityTextWrap: {
    flex: 1,
  },
  cityName: {
    fontSize: 13,
  },
  citySubLabel: {
    fontSize: 10,
    marginTop: 1,
  },
  cityCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cityCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyText: {
    fontSize: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  applyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

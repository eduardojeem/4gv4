import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, usePalette } from '@/lib/palette';

export interface CategoryItem {
  id: string;
  name: string;
  count: number;
}

interface CategoriesSheetProps {
  visible: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
}

export function CategoriesSheet({
  visible,
  onClose,
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoriesSheetProps) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : categories;

  const handleSelect = async (id: string | null) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectCategory(id);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar categorías" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Encabezado */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
                <Ionicons name="grid" size={20} color={palette.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>Todas las Categorías</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  {categories.length} categorías disponibles
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {/* Buscador dentro del modal */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.background,
                borderColor: query ? palette.primary : colors.border,
              },
            ]}>
            <Ionicons name="search-outline" size={17} color={query ? palette.primary : colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar categoría…"
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.muted} />
              </Pressable>
            )}
          </View>

          {/* Lista en cuadrícula */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Opción Todas */}
            <Pressable
              onPress={() => handleSelect(null)}
              style={[
                styles.categoryCard,
                {
                  backgroundColor: selectedCategoryId === null ? 'rgba(37,99,235,0.12)' : colors.background,
                  borderColor: selectedCategoryId === null ? palette.primary : colors.border,
                },
              ]}>
              <View
                style={[
                  styles.categoryIconWrap,
                  { backgroundColor: selectedCategoryId === null ? palette.primary : colors.card },
                ]}>
                <Ionicons
                  name="apps"
                  size={18}
                  color={selectedCategoryId === null ? '#FFFFFF' : palette.primary}
                />
              </View>
              <View style={styles.categoryInfo}>
                <Text
                  style={[
                    styles.categoryName,
                    {
                      color: selectedCategoryId === null ? palette.primary : colors.text,
                      fontWeight: selectedCategoryId === null ? '800' : '700',
                    },
                  ]}>
                  Todas las categorías
                </Text>
                <Text style={[styles.categoryCount, { color: colors.muted }]}>
                  Ver todo el catálogo
                </Text>
              </View>
              {selectedCategoryId === null && (
                <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
              )}
            </Pressable>

            {/* Categorías filtradas */}
            {filtered.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => handleSelect(cat.id)}
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: isSelected ? 'rgba(37,99,235,0.12)' : colors.background,
                      borderColor: isSelected ? palette.primary : colors.border,
                    },
                  ]}>
                  <View
                    style={[
                      styles.categoryIconWrap,
                      { backgroundColor: isSelected ? palette.primary : colors.card },
                    ]}>
                    <Ionicons
                      name="folder-outline"
                      size={18}
                      color={isSelected ? '#FFFFFF' : palette.primary}
                    />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.categoryName,
                        {
                          color: isSelected ? palette.primary : colors.text,
                          fontWeight: isSelected ? '800' : '700',
                        },
                      ]}>
                      {cat.name}
                    </Text>
                    <Text style={[styles.categoryCount, { color: colors.muted }]}>
                      {cat.count} producto{cat.count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  scrollBody: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  categoryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
  },
  categoryCount: {
    fontSize: 12,
    marginTop: 2,
  },
});

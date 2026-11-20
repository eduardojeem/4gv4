import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, usePalette } from '@/lib/palette';
import { addRepairPhoto, removeRepairPhoto } from '@/lib/repair-photos';
import type { Repair } from '@/lib/repairs';

type Photo = NonNullable<Repair['images']>[number];

/**
 * Fotos del equipo en el detalle de la reparación: sacarlas con la cámara o
 * elegirlas de la galería (para registrar cómo llegó), verlas en grande y
 * quitarlas. Usa las mismas rutas y límites de plan que la web.
 */
export function RepairPhotos({ repair, editable, onChanged }: { repair: Repair; editable: boolean; onChanged: (repair: Repair) => void }) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const photos = repair.images ?? [];
  const [uploading, setUploading] = useState(0);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [removing, setRemoving] = useState(false);

  const pick = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Sin acceso a la cámara', 'Habilitá la cámara para Mi TiendaPy en los ajustes del teléfono.');
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: true, selectionLimit: 6 });
    if (result.canceled) return;
    // De a una: el servidor controla el cupo del plan con cada foto.
    for (const asset of result.assets) {
      setUploading((count) => count + 1);
      try {
        const updated = await addRepairPhoto(repair.id, { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
        onChanged(updated);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      } catch (err) {
        Alert.alert('No se pudo subir la foto', err instanceof Error ? err.message : 'Probá de nuevo.');
        setUploading((count) => Math.max(0, count - 1));
        break;
      }
      setUploading((count) => Math.max(0, count - 1));
    }
  };

  const remove = (photo: Photo) => {
    Alert.alert('¿Quitar esta foto?', 'Se borra de la reparación y no se puede recuperar.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          setRemoving(true);
          try {
            const updated = await removeRepairPhoto(repair.id, photo.id);
            onChanged(updated);
            setViewing(null);
          } catch (err) {
            Alert.alert('No se pudo quitar la foto', err instanceof Error ? err.message : 'Probá de nuevo.');
          } finally {
            setRemoving(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.gap}>
      {photos.length > 0 || uploading > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {photos.map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => setViewing(photo)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Ver foto ${index + 1} de ${photos.length}`}>
              <Image source={photo.image_url} style={[styles.thumb, { backgroundColor: colors.background }]} contentFit="cover" transition={150} />
            </Pressable>
          ))}
          {uploading > 0 && (
            <View style={[styles.thumb, styles.center, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
              <ActivityIndicator color={palette.primary} />
              <Text style={[styles.small, { color: colors.muted }]}>Subiendo…</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <Text style={[styles.small, { color: colors.muted }]}>
          {editable ? 'Sacá fotos de cómo llegó el equipo: rayones, pantalla, golpes.' : 'Sin fotos.'}
        </Text>
      )}

      {editable && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => void pick('camera')}
            disabled={uploading > 0}
            accessibilityRole="button"
            style={[styles.action, { borderColor: colors.border, opacity: uploading > 0 ? 0.6 : 1 }]}>
            <Ionicons name="camera-outline" size={18} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>Sacar foto</Text>
          </Pressable>
          <Pressable
            onPress={() => void pick('library')}
            disabled={uploading > 0}
            accessibilityRole="button"
            style={[styles.action, { borderColor: colors.border, opacity: uploading > 0 ? 0.6 : 1 }]}>
            <Ionicons name="images-outline" size={18} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>Galería</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={[styles.viewer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.viewerBar}>
            <Pressable onPress={() => setViewing(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar foto">
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
            {editable && viewing && (
              <Pressable
                onPress={() => remove(viewing)}
                disabled={removing}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Quitar foto"
                style={styles.viewerDelete}>
                {removing ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="trash-outline" size={22} color="#FFFFFF" />}
              </Pressable>
            )}
          </View>
          {viewing && <Image source={viewing.image_url} style={styles.full} contentFit="contain" transition={150} />}
          {viewing?.description ? <Text style={styles.caption}>{viewing.description}</Text> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  row: { gap: 8 },
  thumb: { width: 96, height: 96, borderRadius: 12 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  small: { fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 10 },
  actionText: { fontSize: 14, fontWeight: '700' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', paddingHorizontal: 12 },
  viewerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  viewerDelete: { padding: 6 },
  full: { flex: 1, width: '100%' },
  caption: { color: '#FFFFFF', fontSize: 14, textAlign: 'center', paddingTop: 10 },
});

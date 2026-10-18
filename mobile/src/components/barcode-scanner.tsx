import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/lib/palette';

/**
 * Escáner de código de barras a pantalla completa. Devuelve el primer código
 * leído y se cierra: la cámara manda el mismo código muchas veces por segundo.
 */
export function BarcodeScanner({ visible, onClose, onScanned, title = 'Escaneá el código de barras' }: { visible: boolean; onClose: () => void; onScanned: (code: string) => void; title?: string }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const handled = useRef(false);

  const handle = (result: BarcodeScanningResult) => {
    if (handled.current || !result.data) return;
    handled.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onScanned(result.data.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => (handled.current = false)}>
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
            onBarcodeScanned={visible ? handle : undefined}
          />
        ) : (
          <View style={styles.center}>
            <Ionicons name="camera-outline" size={44} color="#fff" />
            <Text style={styles.message}>Necesitamos la cámara para leer el código de barras.</Text>
            <Pressable onPress={requestPermission} style={styles.grant}>
              <Text style={styles.grantText}>Permitir cámara</Text>
            </Pressable>
          </View>
        )}

        {/* Marco y controles */}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.round} accessibilityLabel="Cerrar escáner">
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={() => setTorch((value) => !value)} hitSlop={10} style={styles.round} accessibilityLabel={torch ? 'Apagar linterna' : 'Encender linterna'}>
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color="#fff" />
          </Pressable>
        </View>
        {permission?.granted && (
          <View pointerEvents="none" style={styles.frameWrap}>
            <View style={styles.frame} />
            <Text style={styles.hint}>Centrá el código dentro del recuadro</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  message: { color: '#fff', fontSize: 16, textAlign: 'center' },
  grant: { backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  grantText: { color: '#fff', fontWeight: '800' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 15, fontWeight: '800' },
  frameWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 16 },
  frame: { width: 270, height: 170, borderRadius: 20, borderWidth: 3, borderColor: '#fff' },
  hint: { color: '#fff', fontSize: 14, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, overflow: 'hidden' },
});

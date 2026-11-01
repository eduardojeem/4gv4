import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/lib/palette';

const BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'qr',
  'pdf417',
  'datamatrix',
] as const;

/**
 * Escáner de código de barras a pantalla completa con cámara trasera y linterna.
 * Funciona de forma adaptativa en celulares y tablets.
 * Devuelve el primer código leído y se cierra con feedback háptico.
 */
export function BarcodeScanner({
  visible,
  onClose,
  onScanned,
  title = 'Escaneá el código de barras',
  hint = 'Centrá el código dentro del recuadro',
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
  title?: string;
  hint?: string;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const handled = useRef(false);

  // Dimensiones dinámicas del recuadro para celulares y tablets
  const frameWidth = Math.min(Math.max(width * 0.72, 270), 420);
  const frameHeight = Math.round(frameWidth * 0.62);

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
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES as unknown as any }}
            onBarcodeScanned={visible ? handle : undefined}
          />
        ) : (
          <View style={styles.center}>
            <Ionicons name="camera-outline" size={48} color="#fff" />
            <Text style={styles.message}>Necesitamos acceso a la cámara para escanear el IMEI o código de barras.</Text>
            <Pressable onPress={requestPermission} style={styles.grant}>
              <Text style={styles.grantText}>Permitir cámara</Text>
            </Pressable>
          </View>
        )}

        {/* Marco y controles superiores */}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.round} accessibilityLabel="Cerrar escáner">
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={() => setTorch((value) => !value)} hitSlop={10} style={styles.round} accessibilityLabel={torch ? 'Apagar linterna' : 'Encender linterna'}>
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Guía visual con recuadro centrado */}
        {permission?.granted && (
          <View pointerEvents="none" style={styles.frameWrap}>
            <View style={[styles.frame, { width: frameWidth, height: frameHeight }]} />
            <Text style={styles.hint}>{hint}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  message: { color: '#fff', fontSize: 16, textAlign: 'center', lineHeight: 22 },
  grant: { backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  grantText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 10 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center', flex: 1, marginHorizontal: 8 },
  frameWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 16 },
  frame: { borderRadius: 20, borderWidth: 3, borderColor: '#fff' },
  hint: { color: '#fff', fontSize: 13, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, overflow: 'hidden', textAlign: 'center', maxWidth: '85%' },
});

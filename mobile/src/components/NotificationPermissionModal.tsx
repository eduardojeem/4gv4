import React from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { usePalette, palette } from '@/lib/palette'

interface NotificationPermissionModalProps {
  visible: boolean
  onAccept: () => void
  onDismiss: () => void
}

export function NotificationPermissionModal({
  visible,
  onAccept,
  onDismiss,
}: NotificationPermissionModalProps) {
  const colors = usePalette()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: palette.primary + '15' }]}>
            <Ionicons name="notifications" size={32} color={palette.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            Recibí avisos importantes de tu negocio
          </Text>

          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Mantenete al tanto en tiempo real de lo que pasa en tu tienda:
          </Text>

          <View style={styles.list}>
            <View style={styles.listItem}>
              <Ionicons name="checkmark-circle" size={18} color={palette.primary} style={styles.checkIcon} />
              <Text style={[styles.listText, { color: colors.text }]}>Nuevas ventas registradas</Text>
            </View>
            <View style={styles.listItem}>
              <Ionicons name="checkmark-circle" size={18} color={palette.primary} style={styles.checkIcon} />
              <Text style={[styles.listText, { color: colors.text }]}>Reparaciones asignadas y listas</Text>
            </View>
            <View style={styles.listItem}>
              <Ionicons name="checkmark-circle" size={18} color={palette.primary} style={styles.checkIcon} />
              <Text style={[styles.listText, { color: colors.text }]}>Reservas y turnos de clientes</Text>
            </View>
            <View style={styles.listItem}>
              <Ionicons name="checkmark-circle" size={18} color={palette.primary} style={styles.checkIcon} />
              <Text style={[styles.listText, { color: colors.text }]}>Alertas de stock bajo y caja</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onAccept}
              accessibilityRole="button"
              accessibilityLabel="Activar notificaciones"
              style={[styles.primaryBtn, { backgroundColor: palette.primary }]}>
              <Text style={styles.primaryBtnText}>Activar notificaciones</Text>
            </Pressable>

            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Ahora no"
              style={styles.secondaryBtn}>
              <Text style={[styles.secondaryBtnText, { color: colors.muted }]}>Ahora no</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  list: {
    width: '100%',
    marginBottom: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkIcon: {
    marginRight: 10,
  },
  listText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    width: '100%',
    gap: 8,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
})

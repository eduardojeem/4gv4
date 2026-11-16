import { useLocalSearchParams } from 'expo-router'
import { MyAppointmentDetailScreen } from '@/components/my-appointments'
export default function MyBookingDetail() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  return <MyAppointmentDetailScreen id={Array.isArray(id) ? id[0] : id} />
}

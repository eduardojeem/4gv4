import { Redirect } from 'expo-router';

export default function OffersScreen() {
  return <Redirect href={{ pathname: '/', params: { tab: 'ofertas' } }} />;
}

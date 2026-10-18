import { Redirect } from 'expo-router';

export default function ProductsScreen() {
  return <Redirect href={{ pathname: '/', params: { tab: 'productos' } }} />;
}

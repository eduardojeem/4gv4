import { Redirect } from 'expo-router';

export default function StoresScreen() {
  return <Redirect href={{ pathname: '/', params: { tab: 'tiendas' } }} />;
}

import { Redirect } from 'expo-router';

/** «Administración» del menú del panel abre su área aparte, como /admin en la web. */
export default function AdministrationRedirect() {
  return <Redirect href="/admin" />;
}

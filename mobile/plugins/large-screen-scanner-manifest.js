/**
 * Cambio puro del manifiesto (sin dependencias, para poder probarlo): quita
 * la orientación fija de la actividad del escáner de Google ML Kit.
 */
const SCANNER_ACTIVITY = 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

function removeScannerOrientation(androidManifest) {
  const manifest = androidManifest.manifest;
  manifest.$ = manifest.$ || {};
  manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
  const application = manifest.application && manifest.application[0];
  if (!application) return androidManifest;
  application.activity = application.activity || [];
  let activity = application.activity.find((item) => item.$ && item.$['android:name'] === SCANNER_ACTIVITY);
  if (!activity) {
    activity = { $: { 'android:name': SCANNER_ACTIVITY } };
    application.activity.push(activity);
  }
  delete activity.$['android:screenOrientation'];
  activity.$['tools:remove'] = 'android:screenOrientation';
  return androidManifest;
}

module.exports = { SCANNER_ACTIVITY, removeScannerOrientation };

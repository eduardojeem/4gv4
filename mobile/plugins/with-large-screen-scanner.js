const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Play Console pide quitar las restricciones de orientación para pantallas
 * grandes (Android 16 las ignora en tablets y plegables). La única que tiene la
 * app viene de la actividad del escáner de códigos de Google ML Kit, que trae
 * `expo-camera` fijada en vertical. Acá se le quita `screenOrientation` al
 * unir los manifiestos, sin tocar la librería.
 */
const SCANNER_ACTIVITY = 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

function withLargeScreenScanner(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    const application = manifest.application?.[0];
    if (!application) return cfg;
    application.activity = application.activity || [];
    let activity = application.activity.find((item) => item.$?.['android:name'] === SCANNER_ACTIVITY);
    if (!activity) {
      activity = { $: { 'android:name': SCANNER_ACTIVITY } };
      application.activity.push(activity);
    }
    delete activity.$['android:screenOrientation'];
    activity.$['tools:remove'] = 'android:screenOrientation';
    return cfg;
  });
}

module.exports = withLargeScreenScanner;
module.exports.SCANNER_ACTIVITY = SCANNER_ACTIVITY;

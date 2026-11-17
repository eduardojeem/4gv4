const { withAndroidManifest } = require('expo/config-plugins');
const { removeScannerOrientation, SCANNER_ACTIVITY } = require('./large-screen-scanner-manifest');

/**
 * Play Console pide quitar las restricciones de orientación para pantallas
 * grandes (Android 16 las ignora en tablets y plegables). La única que tiene la
 * app viene de la actividad del escáner de códigos de Google ML Kit, que trae
 * `expo-camera` fijada en vertical. Acá se le quita `screenOrientation` al
 * unir los manifiestos, sin tocar la librería.
 */
function withLargeScreenScanner(config) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = removeScannerOrientation(cfg.modResults);
    return cfg;
  });
}

module.exports = withLargeScreenScanner;
module.exports.SCANNER_ACTIVITY = SCANNER_ACTIVITY;

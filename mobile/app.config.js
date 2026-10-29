const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

/**
 * `google-services.json` (Firebase, para las notificaciones push en Android)
 * no se versiona. En EAS llega como variable de tipo archivo
 * `GOOGLE_SERVICES_JSON` con la ruta; en una máquina local, si existe el
 * archivo junto a este config, se usa ese. Sin ninguno de los dos la app
 * compila igual, pero sin push en Android.
 */
function googleServicesFile() {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON?.trim();
  if (fromEnv) return fromEnv;
  return existsSync(resolve(__dirname, 'google-services.json')) ? './google-services.json' : undefined;
}

/** @param {import('expo/config').ConfigContext} context */
module.exports = ({ config }) => {
  const file = googleServicesFile();
  return {
    ...config,
    android: {
      ...config.android,
      ...(file ? { googleServicesFile: file } : {}),
    },
  };
};

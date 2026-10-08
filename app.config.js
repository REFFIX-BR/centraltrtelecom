const fs = require('fs');
const appJson = require('./app.json');

/**
 * Android push (FCM) precisa do google-services.json no build nativo.
 * - Local/EAS: coloque ./google-services.json na raiz
 * - Ou defina GOOGLE_SERVICES_JSON (caminho do arquivo secret no EAS)
 */
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (fs.existsSync('./google-services.json')
    ? './google-services.json'
    : undefined);

module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  },
};

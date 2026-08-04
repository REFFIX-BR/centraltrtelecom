const path = require('path');

/**
 * PM2 — API Central do Assinante
 *
 * Segredos e DB ficam em admin/.env (dotenv no server/index.mjs).
 * Não duplique senhas aqui.
 *
 * Subir:
 *   cd admin && npm install --omit=dev
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * Atualizar código:
 *   pm2 restart trtelecom-propagandas-api --update-env
 */
module.exports = {
  apps: [
    {
      name: 'trtelecom-propagandas-api',
      script: 'server/index.mjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
      error_file: path.join(__dirname, 'logs', 'api-error.log'),
      out_file: path.join(__dirname, 'logs', 'api-out.log'),
      merge_logs: true,
    },
  ],
};

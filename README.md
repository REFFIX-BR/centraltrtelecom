# Central do Assinante — TR Telecom

Aplicativo Expo Go (SDK 54) da Central do Assinante da TR Telecom, com identidade visual em azul e branco e integração inicial de autenticação.

## Como rodar

```bash
npm install
npx expo start
```

Abra o app no **Expo Go** (SDK 54) lendo o QR Code.

## API

Base padrão:

```env
EXPO_PUBLIC_API_URL=https://webhook.trtelecom.net
```

### Login integrado

1. `GET /webhook/listar-logins?documento=CPF`
2. `POST /webhook/login-sac` com `documento`, `senha`, `codigo_gerado` e `timestamp`

O login técnico do assinante é consultado silenciosamente e persistido apenas para uso interno nas próximas integrações.

## Módulos

- Login e Primeiro acesso
- Início (resumo de fatura, alertas e atalhos)
- Plano
- Faturas e pagamento (aguardando integração)
- Suporte (diagnóstico, FAQ e protocolos)
- Mais (perfil, notificações, documentos e logout)

# Integração — Central do Assinante

Guia único para o backend da Central. Base: `https://contrato.trtelecom.net`

A chave (`CONTRACTS_INTEGRATION_API_KEY`) fica **só no servidor** da Central. Nunca no frontend.

---

## Autenticação

Em toda rota com API Key:

```http
Authorization: Bearer SUA_API_KEY
```

Alternativa: `x-api-key: SUA_API_KEY`

| HTTP | Significado |
|------|-------------|
| 401 | Chave ausente ou inválida |
| 503 | Chave não configurada no servidor de contratos |

---

## Matriz

| Necessidade | Rota | Auth |
|-------------|------|------|
| Saber se tem contrato / status | `GET /api/integrations/contracts/status-by-client` | API Key |
| Criar contrato + link de assinatura | `POST /api/contracts/solicitacao` | API Key |
| Cliente assinar | Abrir `assinaturaUrl` no browser | Público (token no link) |
| Ver 2ª via assinada (página) | `GET /view/{contractId}` | Público |
| Ver 2ª via assinada (JSON) | `GET /api/view/{contractId}` | Público |

Não use rotas do painel (`/api/contracts/...` com cookie). Elas exigem sessão de usuário interno.

---

## 1. Consultar contratos

```http
GET /api/integrations/contracts/status-by-client?cpf=12345678909
Authorization: Bearer SUA_API_KEY
```

Ou:

```http
GET /api/integrations/contracts/status-by-client?clientLogin=20222925
Authorization: Bearer SUA_API_KEY
```

Regras:

- Informe **apenas um**: `cpf` **ou** `clientLogin`
- CPF/CNPJ aceita com ou sem máscara
- Login ignora maiúsculas/minúsculas
- Até 50 contratos, do mais recente ao mais antigo

### Resposta 200

```json
{
  "found": true,
  "total": 2,
  "pendingSignature": 1,
  "pendingReview": 0,
  "signed": 1,
  "contracts": [
    {
      "contractId": "uuid",
      "contractNumber": "2026-651",
      "clientName": "João da Silva",
      "clientLogin": "20222925",
      "cpf": "123.456.789-09",
      "status": "pending",
      "createdAt": "2026-07-30T13:00:00.000Z",
      "updatedAt": "2026-07-30T13:15:00.000Z",
      "assinaturaUrl": "https://contrato.trtelecom.net/sign/token"
    }
  ]
}
```

Sem contratos (ainda **200**):

```json
{
  "found": false,
  "total": 0,
  "pendingSignature": 0,
  "pendingReview": 0,
  "signed": 0,
  "contracts": []
}
```

### Status

| `status` | Significado | Ação na Central |
|----------|-------------|-----------------|
| `draft` | Rascunho | Não oferecer assinatura |
| `pending` | Aguardando assinatura | Usar `assinaturaUrl` |
| `pending_review` | Assinado, em análise | Informar “em análise” |
| `signed` | Assinado e aprovado | Oferecer 2ª via |
| `cancelled` | Cancelado | Não oferecer |

`assinaturaUrl` é `null` se ainda não existir link.

### Erros da consulta

| HTTP | Quando |
|------|--------|
| 400 | Faltou parâmetro, ou enviou `cpf` e `clientLogin` juntos |
| 401 / 503 | Auth (ver tabela acima) |
| 500 | Erro interno |

---

## 2. Criar contrato

```http
POST /api/contracts/solicitacao
Authorization: Bearer SUA_API_KEY
Content-Type: application/json
```

### Campos obrigatórios

| Campo canônico | Alternativas aceitas | Descrição |
|----------------|----------------------|-----------|
| `modalidade` | — | Nome do modelo (ex.: `Termo de Adesão`). Obrigatória mesmo se usar `templateId` |
| `cpf` | `CPF` | CPF ou CNPJ |
| `clientName` | `nomeCompleto` | Nome completo |
| `phone` | `telefone` | Telefone |
| `email` | `emailContato` | E-mail válido |
| `address` | `enderecoCompleto` | Endereço |

Opcionais úteis: `clientLogin`, `templateId`, `companyId`, `birthDate`, `clientCEP`, dados de plano/câmeras conforme o modelo.

A modalidade é resolvida pelo **nome** do template ativo (busca flexível, sem acento). Se enviar `templateId`, o modelo precisa existir e estar **ativo**.

### Exemplo

```bash
curl -sS -X POST "https://contrato.trtelecom.net/api/contracts/solicitacao" \
  -H "Authorization: Bearer SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "modalidade": "Termo de Adesão",
    "CPF": "123.456.789-09",
    "nomeCompleto": "João da Silva",
    "telefone": "(24) 99999-8888",
    "emailContato": "joao@email.com",
    "enderecoCompleto": "Rua Exemplo, 123, Centro, Três Rios - RJ",
    "clientLogin": "20222925"
  }'
```

### Resposta 201

```json
{
  "cpf": "123.456.789-09",
  "assinaturaUrl": "https://contrato.trtelecom.net/sign/token"
}
```

O contrato nasce com status `pending` e link de assinatura já gerado.

### Erros da criação

| HTTP | Quando |
|------|--------|
| 400 | Dados inválidos (Zod), ou template inativo |
| 401 / 503 | Auth |
| 404 | Modalidade/`templateId` não encontrado (`availableTemplates` na resposta, se por modalidade) |
| 500 | Erro interno / template não configurado |

---

## 3. Validar situação e visualizar

### Validar na Central (após consulta)

```javascript
const precisaAssinar = resultado.pendingSignature > 0;
const emAnalise = resultado.pendingReview > 0;
const temAssinado = resultado.signed > 0;

if (!resultado.found) {
  // sem contratos neste sistema
} else if (precisaAssinar) {
  const pendente = resultado.contracts.find((c) => c.status === "pending");
  // redirecionar cliente para pendente.assinaturaUrl
} else if (emAnalise) {
  // avisar que a assinatura está em análise
} else if (temAssinado) {
  const assinado = resultado.contracts.find((c) => c.status === "signed");
  // 2ª via: /view/{assinado.contractId}
}
```

### Página da 2ª via (browser)

```text
https://contrato.trtelecom.net/view/{contractId}
```

Só funciona se `status === "signed"`.

### JSON da 2ª via (sem API Key)

```http
GET /api/view/{contractId}
```

Resposta 200 (resumo):

```json
{
  "contract": {
    "contractNumber": "2026-651",
    "clientName": "João da Silva",
    "generatedContract": "texto completo do contrato...",
    "aiSummary": null,
    "createdAt": "..."
  },
  "signature": {
    "signerName": "João da Silva",
    "signedAt": "...",
    "signatureType": "draw",
    "signatureImage": "data:image/png;base64,..."
  }
}
```

| HTTP | Quando |
|------|--------|
| 403 | Contrato ainda não está `signed` |
| 404 | Contrato ou assinatura não encontrados |

Não há endpoint de PDF na API Key. PDF/impressão é no browser (página `/view/...`) ou a partir do JSON acima.

---

## Fluxo recomendado

1. Consultar por CPF ou login.
2. Se `pendingSignature > 0` → abrir `assinaturaUrl` do item `pending`.
3. Se `pendingReview > 0` → mostrar “em análise”.
4. Se `signed > 0` → oferecer `/view/{contractId}` ou `GET /api/view/{contractId}`.
5. Se `found === false` e precisar de contrato novo → `POST /solicitacao` com Bearer; guardar `assinaturaUrl` da resposta.

---

## Exemplos rápidos

### Consulta (JS)

```javascript
async function consultarPorCpf(cpf, apiKey) {
  const res = await fetch(
    `https://contrato.trtelecom.net/api/integrations/contracts/status-by-client?cpf=${encodeURIComponent(cpf)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (res.status === 401) throw new Error("API Key inválida");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### Consulta (cURL)

```bash
curl -sS \
  -H "Authorization: Bearer SUA_API_KEY" \
  "https://contrato.trtelecom.net/api/integrations/contracts/status-by-client?cpf=12345678909"
```

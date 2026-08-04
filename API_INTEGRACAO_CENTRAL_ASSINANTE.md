# Integração — Consulta de contratos com API Key

Documento para o time da Central do Assinante.

Esta API permite verificar se um cliente possui contratos no sistema da TR Telecom e qual o status de cada um (pendente de assinatura, em análise, assinado, etc.).

---

## URL

```text
GET https://contrato.trtelecom.net/api/integrations/contracts/status-by-client
```

---

## Autenticação

Toda requisição precisa enviar a chave de API no cabeçalho.

### Forma recomendada

```http
Authorization: Bearer SUA_API_KEY
```

### Forma alternativa

```http
x-api-key: SUA_API_KEY
```

A chave deve ficar **somente no backend** da Central. Nunca no frontend, app do cliente ou repositório público.

Se a chave estiver ausente ou inválida, a API responde:

```http
HTTP/1.1 401 Unauthorized
```

```json
{
  "error": "Chave de API ausente ou inválida"
}
```

---

## Parâmetros

Informe **apenas um** dos parâmetros abaixo na query string:

| Parâmetro     | Exemplo                         | Descrição                          |
|---------------|---------------------------------|------------------------------------|
| `cpf`         | `12345678909` ou `123.456.789-09` | CPF ou CNPJ do cliente            |
| `clientLogin` | `20222925`                      | Login PPPoE do cliente             |

### Consulta por CPF

```http
GET /api/integrations/contracts/status-by-client?cpf=12345678909
Authorization: Bearer SUA_API_KEY
```

### Consulta por login

```http
GET /api/integrations/contracts/status-by-client?clientLogin=20222925
Authorization: Bearer SUA_API_KEY
```

Não envie `cpf` e `clientLogin` ao mesmo tempo.

---

## Resposta de sucesso

**HTTP 200**

```json
{
  "found": true,
  "total": 2,
  "pendingSignature": 1,
  "pendingReview": 0,
  "signed": 1,
  "contracts": [
    {
      "contractId": "uuid-do-contrato",
      "contractNumber": "2026-651",
      "clientName": "João da Silva",
      "clientLogin": "20222925",
      "cpf": "123.456.789-09",
      "status": "pending",
      "createdAt": "2026-07-30T13:00:00.000Z",
      "updatedAt": "2026-07-30T13:15:00.000Z",
      "assinaturaUrl": "https://contrato.trtelecom.net/sign/abc123"
    },
    {
      "contractId": "uuid-do-contrato-2",
      "contractNumber": "2026-402",
      "clientName": "João da Silva",
      "clientLogin": "20222925",
      "cpf": "123.456.789-09",
      "status": "signed",
      "createdAt": "2026-04-02T10:00:00.000Z",
      "updatedAt": "2026-04-03T09:20:00.000Z",
      "assinaturaUrl": "https://contrato.trtelecom.net/sign/def456"
    }
  ]
}
```

### Campos do resumo

| Campo               | Tipo    | Significado                                              |
|---------------------|---------|----------------------------------------------------------|
| `found`             | boolean | Existe pelo menos um contrato para o identificador       |
| `total`             | number  | Quantidade de contratos retornados                       |
| `pendingSignature`  | number  | Contratos aguardando assinatura (`status = pending`)     |
| `pendingReview`     | number  | Contratos aguardando aprovação manual                    |
| `signed`            | number  | Contratos assinados e aprovados                          |
| `contracts`         | array   | Lista de contratos (mais recente primeiro, até 50)       |

### Campos de cada contrato

| Campo            | Tipo           | Descrição                                      |
|------------------|----------------|------------------------------------------------|
| `contractId`     | string         | ID interno do contrato                         |
| `contractNumber` | string         | Número exibido ao cliente                      |
| `clientName`     | string         | Nome do cliente                                |
| `clientLogin`    | string \| null | Login PPPoE                                    |
| `cpf`            | string         | CPF/CNPJ                                       |
| `status`         | string         | Status atual                                   |
| `createdAt`      | string (ISO)   | Data de criação                                |
| `updatedAt`      | string (ISO)   | Última atualização                             |
| `assinaturaUrl`  | string \| null | Link para assinar/visualizar; `null` se ainda não houver link |

---

## Quando o cliente não tem contrato

A API **não** retorna 404. Retorna HTTP 200 com:

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

Trate assim:

```javascript
if (!resultado.found) {
  // Cliente sem contratos neste sistema
}
```

---

## Status possíveis

| Valor            | Significado na Central                         |
|------------------|------------------------------------------------|
| `draft`          | Rascunho (ainda não liberado para assinatura)  |
| `pending`        | **Pendente de assinatura**                     |
| `pending_review` | Assinado, aguardando análise/aprovação         |
| `signed`         | Assinado e aprovado                            |
| `cancelled`      | Cancelado                                      |

### Regras sugeridas na UI

```javascript
const precisaAssinar = resultado.pendingSignature > 0;
const emAnalise = resultado.pendingReview > 0;
const temAssinado = resultado.signed > 0;
```

Para redirecionar o cliente ao fluxo de assinatura, use `assinaturaUrl` do contrato com `status === "pending"`.

---

## Erros comuns

| HTTP | Situação                                      |
|------|-----------------------------------------------|
| 400  | Faltou parâmetro, ou enviou `cpf` e `clientLogin` juntos |
| 401  | Chave ausente ou inválida                     |
| 500  | Erro interno no servidor de contratos         |
| 503  | Chave ainda não configurada no servidor       |

Exemplos:

```json
{ "error": "Informe clientLogin ou cpf na query string." }
```

```json
{ "error": "Informe apenas clientLogin ou cpf, não ambos." }
```

```json
{ "error": "Chave de API ausente ou inválida" }
```

---

## Exemplos prontos

### cURL

```bash
curl -sS \
  -H "Authorization: Bearer SUA_API_KEY" \
  "https://contrato.trtelecom.net/api/integrations/contracts/status-by-client?cpf=12345678909"
```

```bash
curl -sS \
  -H "Authorization: Bearer SUA_API_KEY" \
  "https://contrato.trtelecom.net/api/integrations/contracts/status-by-client?clientLogin=20222925"
```

### JavaScript (Node / backend)

```javascript
async function consultarContratosPorCpf(cpf, apiKey) {
  const url =
    "https://contrato.trtelecom.net/api/integrations/contracts/status-by-client" +
    `?cpf=${encodeURIComponent(cpf)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (response.status === 401) {
    throw new Error("API Key inválida");
  }

  if (!response.ok) {
    throw new Error(`Falha na consulta: HTTP ${response.status}`);
  }

  return response.json();
}

// Uso
const resultado = await consultarContratosPorCpf("12345678909", process.env.CONTRACTS_API_KEY);

if (!resultado.found) {
  console.log("Sem contratos");
} else if (resultado.pendingSignature > 0) {
  const pendente = resultado.contracts.find((c) => c.status === "pending");
  console.log("Assinar em:", pendente?.assinaturaUrl);
}
```

### PHP

```php
<?php
$apiKey = getenv('CONTRACTS_API_KEY');
$cpf = '12345678909';

$url = 'https://contrato.trtelecom.net/api/integrations/contracts/status-by-client?cpf=' . urlencode($cpf);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $apiKey,
    ],
]);

$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($code !== 200) {
    throw new Exception('Falha ao consultar contratos. HTTP ' . $code);
}

$resultado = json_decode($body, true);

if (!$resultado['found']) {
    // Sem contratos
} elseif ($resultado['pendingSignature'] > 0) {
    // Cliente precisa assinar
}
```

---

## Checklist rápido para o integrador

1. Guardar a API Key em variável de ambiente no backend.
2. Chamar `GET /api/integrations/contracts/status-by-client` com `Authorization: Bearer ...`.
3. Passar `cpf` **ou** `clientLogin`.
4. Se `found === false`, o cliente não tem contrato neste sistema.
5. Se `pendingSignature > 0`, mostrar aviso e usar `assinaturaUrl` do contrato `pending`.
6. Se `pendingReview > 0`, informar que a assinatura está em análise.
7. Se `signed > 0`, o cliente já possui contrato assinado.

---

## Observações

- A lista vem do mais recente para o mais antigo.
- Limite de 50 contratos por consulta.
- A rota antiga com login/cookie (`/api/contracts/status-by-client`) **não** deve ser usada pela Central; use apenas esta rota com API Key.
- Em caso de dúvida ou troca de chave, contatar o time responsável pelo sistema de contratos.

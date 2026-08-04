# Consulta de status de contratos por CPF/CNPJ ou login

Esta API permite que sistemas externos, como a Central do Assinante, consultem o contrato mais recente associado a um CPF/CNPJ ou login PPPoE.

## Endpoint

```http
GET /api/contracts/status-by-client
```

**URL de produção:**

```text
https://contrato.trtelecom.net/api/contracts/status-by-client
```

**Autenticação:** sessão HTTP por cookie. O usuário utilizado na integração precisa estar cadastrado e aprovado no sistema de contratos.

## Consulta por CPF ou CNPJ

```http
GET /api/contracts/status-by-client?cpf=12345678909
```

O documento pode ser enviado com ou sem máscara:

```http
GET /api/contracts/status-by-client?cpf=123.456.789-09
```

## Consulta por login PPPoE

```http
GET /api/contracts/status-by-client?clientLogin=20222925
```

A comparação do login:

- ignora diferenças entre letras maiúsculas e minúsculas;
- remove espaços no início e no fim.

Envie somente um identificador por requisição. Não envie `cpf` e `clientLogin` juntos.

## Resposta de sucesso

**Status HTTP:** `200`

```json
{
  "contractId": "uuid-do-contrato",
  "contractNumber": "2026-651",
  "clientName": "João da Silva",
  "clientLogin": "20222925",
  "cpf": "123.456.789-09",
  "status": "pending",
  "createdAt": "2026-07-30T13:00:00.000Z",
  "updatedAt": "2026-07-30T13:15:00.000Z",
  "assinaturaUrl": "https://contrato.trtelecom.net/sign/token"
}
```

`assinaturaUrl` será `null` quando o contrato ainda não possuir link de assinatura.

## Status possíveis

| Status | Significado |
|---|---|
| `draft` | Contrato em rascunho |
| `pending` | Aguardando assinatura |
| `pending_review` | Assinado e aguardando aprovação manual |
| `signed` | Assinado e aprovado |
| `cancelled` | Cancelado |

Exemplo de tratamento:

```javascript
const pendenteAssinatura = contrato.status === "pending";
const aguardandoAnalise = contrato.status === "pending_review";
const assinado = contrato.status === "signed";
const cancelado = contrato.status === "cancelled";
```

## Contrato não encontrado

**Status HTTP:** `404`

```json
{
  "error": "Nenhum contrato encontrado para este identificador."
}
```

Nesse caso, a Central do Assinante pode considerar que não existe contrato cadastrado para o identificador informado.

## Erros de validação

### Nenhum identificador informado

**Status HTTP:** `400`

```json
{
  "error": "Informe clientLogin ou cpf na query string."
}
```

### CPF e login enviados juntos

**Status HTTP:** `400`

```json
{
  "error": "Informe apenas clientLogin ou cpf, não ambos."
}
```

Outros retornos:

- `401`: sessão ausente ou expirada;
- `403`: usuário da integração não aprovado;
- `500`: erro interno ao consultar o contrato.

## Autenticação

Primeiro, faça login:

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "USUARIO",
  "password": "SENHA"
}
```

O servidor retorna um cookie de sessão, por exemplo `connect.sid`. O cliente HTTP deve armazenar esse cookie e reenviá-lo nas consultas seguintes.

### Exemplo com JavaScript

```javascript
const baseUrl = "https://contrato.trtelecom.net";

await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    username: "USUARIO",
    password: "SENHA"
  })
});

const response = await fetch(
  `${baseUrl}/api/contracts/status-by-client?cpf=${encodeURIComponent(cpf)}`,
  {
    credentials: "include"
  }
);

if (response.status === 404) {
  return {
    possuiContrato: false
  };
}

if (!response.ok) {
  throw new Error("Não foi possível consultar o contrato");
}

const contrato = await response.json();

return {
  possuiContrato: true,
  pendenteAssinatura: contrato.status === "pending",
  aguardandoAnalise: contrato.status === "pending_review",
  assinado: contrato.status === "signed",
  contrato
};
```

### Exemplo com cURL

```bash
BASE="https://contrato.trtelecom.net"
COOKIE_JAR="$(mktemp)"

curl -sS -c "$COOKIE_JAR" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"USUARIO","password":"SENHA"}'

curl -sS -b "$COOKIE_JAR" \
  "$BASE/api/contracts/status-by-client?cpf=12345678909"
```

Consulta por login:

```bash
curl -sS -b "$COOKIE_JAR" \
  "$BASE/api/contracts/status-by-client?clientLogin=20222925"
```

## Limitação atual

A rota retorna somente o contrato **mais recentemente atualizado** para o CPF/CNPJ ou login informado, independentemente do status.

Se houver mais de um contrato para o mesmo cliente, os demais não serão incluídos na resposta. Caso a Central do Assinante precise listar todos os contratos e seus respectivos status, será necessário disponibilizar um endpoint específico que retorne uma coleção.

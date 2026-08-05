# Consulta externa de status de venda por documento

## Endpoint em produção

**`GET https://comercial.trtelecom.net/api/vendas/status?documento={CPF_OU_CNPJ}`**

Consulta o **status do cadastro/venda** na plataforma comercial a partir do **CPF** ou **CNPJ** do cliente.

| Item | Valor |
|------|--------|
| Método | `GET` |
| URL | `https://comercial.trtelecom.net/api/vendas/status` |
| Auth | Pública (sem JWT), no mesmo padrão de `/api/vendachat` |
| Query | `documento` (obrigatório) — CPF (11) ou CNPJ (14), com ou sem máscara |

Aliases aceitos no lugar de `documento`: `cpf`, `cnpj`, `document`.

---

## Status possíveis (campo `status`)

Valores gravados na venda (`sales.status`):

| Status |
|--------|
| `Aguardando Análise` |
| `Aprovada` |
| `Agendada` |
| `Instalado` |
| `Cancelado` |
| `Desistência` |
| `Prospecção` |
| `Inadimplente` |

> Observação: no sistema o status aprovado/agendado usa a forma feminina (**Aprovada** / **Agendada**).

Se existir mais de uma venda para o mesmo documento, `status` e `venda` referem-se à **mais recente**. O array `vendas` traz todas, da mais nova para a mais antiga.

---

## Exemplo de sucesso (`200`)

```http
GET /api/vendas/status?documento=12345678901
```

```json
{
  "success": true,
  "encontrado": true,
  "documento": "12345678901",
  "tipoDocumento": "CPF",
  "status": "Aguardando Análise",
  "venda": {
    "id": "uuid-da-venda",
    "status": "Aguardando Análise",
    "saleDate": "2026-08-05T12:00:00.000Z",
    "createdAt": "2026-08-05T12:00:00.000Z",
    "updatedAt": "2026-08-05T12:00:00.000Z",
    "installedAt": null,
    "planId": 12,
    "pedidoTipo": "1° Ponto",
    "clienteNome": "Nome do Cliente",
    "clienteTelefone": "24999999999"
  },
  "total": 1,
  "vendas": [
    {
      "id": "uuid-da-venda",
      "status": "Aguardando Análise",
      "saleDate": "2026-08-05T12:00:00.000Z",
      "createdAt": "2026-08-05T12:00:00.000Z",
      "updatedAt": "2026-08-05T12:00:00.000Z",
      "installedAt": null,
      "planId": 12,
      "pedidoTipo": "1° Ponto",
      "clienteNome": "Nome do Cliente",
      "clienteTelefone": "24999999999"
    }
  ]
}
```

---

## Documento não encontrado (`404`)

```json
{
  "success": false,
  "encontrado": false,
  "documento": "12345678901",
  "tipoDocumento": "CPF",
  "status": null,
  "message": "Nenhuma venda encontrada para o documento informado."
}
```

---

## Erros de validação (`400`)

- Sem `documento`
- CPF/CNPJ com quantidade de dígitos inválida

---

## Exemplos de chamada

```bash
curl "https://comercial.trtelecom.net/api/vendas/status?documento=123.456.789-01"
```

```bash
curl "https://comercial.trtelecom.net/api/vendas/status?documento=12345678000199"
```

```javascript
const documento = '12345678901';
const res = await fetch(
  `https://comercial.trtelecom.net/api/vendas/status?documento=${encodeURIComponent(documento)}`
);
const data = await res.json();

if (data.encontrado) {
  console.log('Status do cadastro:', data.status);
} else {
  console.log('Sem venda para este documento');
}
```

---

## Código

- Handler: `GET /api/vendas/status` em `backend/index.js`

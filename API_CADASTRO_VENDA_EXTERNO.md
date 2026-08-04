# Cadastro externo de venda via API (produção)

## Endpoint em produção

**`POST https://comercial.trtelecom.net/api/vendachat`**

Esse é o endpoint indicado para **integrações externas** (chatbots, parceiros, sistemas terceiros) que cadastram uma **venda completa** na plataforma comercial, com **vendedor obrigatório**.

| Item | Valor |
|------|--------|
| Método | `POST` |
| URL | `https://comercial.trtelecom.net/api/vendachat` |
| Auth | Pública (sem JWT). Opcionalmente `X-API-Key` para rastreio. |
| Header | `Content-Type: application/json` |
| Status inicial | `Aguardando Análise` (ou o enviado em `status`) |

> **Alternativas**
> - Sem vendedor (landing / site): `POST /api/site-lead` — vendedor fica como `"Site"`.
> - Payload em inglês (CRM externo): `POST /api/external-lead`.
> - Painel interno (JWT): `POST /api/sales`.

---

## Body — campos obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `vendedor` | `object` ou `string` | Identifica o consultor. Obrigatório. |
| `nome_cliente` | `string` | Nome completo do cliente |
| `telefone_cliente` | `string` | Telefone com DDD |
| `plano_id` | `number` \| `string` | ID de um plano **ativo** |
| `endereco` | `object` | Endereço completo (ver abaixo) |

### `endereco` (obrigatório)

| Campo | Tipo |
|-------|------|
| `endereco` | `string` (logradouro) |
| `numero` | `string` |
| `bairro` | `string` |
| `cidade` | `string` |
| `estado` | `string` (UF) |
| `cep` | `string` |

### `vendedor` (obrigatório)

Informe **ao menos um** identificador. O backend resolve nesta ordem: `id` → `codigo` → `email` → `telefone` → `nome`.

```json
"vendedor": {
  "id": "uuid-do-consultor",
  "codigo": "CONSULT123",
  "email": "consultor@trtelecom.com",
  "telefone": "(24) 99999-8888",
  "nome": "Fulano de Tal"
}
```

Também aceita string simples, por exemplo `"CONSULT123"` ou o UUID do usuário.

Se o vendedor não for encontrado ou estiver inativo → **`404`**.

---

## Body — campos opcionais (recomendados)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `email_cliente` | `string` | E-mail |
| `cpf_cliente` | `string` | CPF (PF) |
| `cnpj_cliente` | `string` | CNPJ (PJ) |
| `tipo_cliente` | `string` | Ex.: `"PJ"` |
| `nome_mae` | `string` | Nome da mãe |
| `data_nascimento` | `string` | `YYYY-MM-DD` |
| `rg` | `string` | RG |
| `sexo` | `string` | Ex.: `"F"` / `"M"` |
| `estado_civil` | `string` | Ex.: `"C"` |
| `dia_vencimento` | `number` | Dia do vencimento da mensalidade |
| `forma_pagamento_instalacao` | `string` | Ex.: `"Cartão"` |
| `valor_mensal` | `number` \| `string` | Se omitido, usa o preço do plano |
| `produtos_adicionais` / `addons` | `array` | Produtos adicionais |
| `observacoes` | `string` | Observações / origem |
| `status` | `string` | Default: `Aguardando Análise` |
| `pedido_tipo` | `string` | Ex.: `1° Ponto`, `2° Ponto`, `Upgrade`, `Reativação` |
| `is_installation_waived` | `boolean` | Isenção de taxa de instalação |
| `contract_url` | `string` | URL do contrato |
| `tag` | `string` | Tag da venda |
| `utm_source` / `utm_medium` / `utm_campaign` | `string` | Tracking |
| `documentos` | `object` | URLs de selfie e documentos |

### `documentos` (opcional)

```json
"documentos": {
  "selfie_url": "https://cdn.exemplo.com/selfie.png",
  "documento_frente_url": "https://cdn.exemplo.com/rg-frente.png",
  "documento_verso_url": "https://cdn.exemplo.com/rg-verso.png"
}
```

Campos faltantes entram em `itens_pendentes` na resposta (selfie, RG, e-mail, etc.).

---

## Exemplo completo de body

```json
{
  "vendedor": {
    "codigo": "CONSULT123"
  },
  "nome_cliente": "Maria Santos",
  "telefone_cliente": "(24) 99999-1111",
  "email_cliente": "maria@email.com",
  "cpf_cliente": "123.456.789-00",
  "nome_mae": "Ana Santos",
  "data_nascimento": "1993-05-12",
  "rg": "12.345.678-9",
  "sexo": "F",
  "estado_civil": "C",
  "dia_vencimento": 10,
  "forma_pagamento_instalacao": "Cartão",
  "produtos_adicionais": [],
  "plano_id": 23,
  "status": "Aguardando Análise",
  "observacoes": "Cadastro externo via API",
  "utm_source": "parceiro",
  "utm_medium": "api",
  "utm_campaign": "integracao",
  "documentos": {
    "selfie_url": "https://cdn.exemplo.com/selfie.png",
    "documento_frente_url": "https://cdn.exemplo.com/rg-frente.png",
    "documento_verso_url": "https://cdn.exemplo.com/rg-verso.png"
  },
  "endereco": {
    "endereco": "Rua Antônio Barreiros",
    "numero": "325",
    "bairro": "Centro",
    "cidade": "Volta Redonda",
    "estado": "RJ",
    "cep": "27260-123",
    "complemento": "Casa",
    "referencia": "Próximo ao supermercado"
  }
}
```

---

## Exemplo `curl`

```bash
curl -X POST https://comercial.trtelecom.net/api/vendachat \
  -H "Content-Type: application/json" \
  -d '{
    "vendedor": { "codigo": "CONSULT123" },
    "nome_cliente": "Maria Santos",
    "telefone_cliente": "(24) 99999-1111",
    "plano_id": 23,
    "endereco": {
      "endereco": "Rua Antônio Barreiros",
      "numero": "325",
      "bairro": "Centro",
      "cidade": "Volta Redonda",
      "estado": "RJ",
      "cep": "27260-123"
    }
  }'
```

---

## Resposta de sucesso (`201`)

```json
{
  "success": true,
  "message": "Venda recebida e processada com sucesso",
  "sale_id": "uuid-da-venda",
  "status": "Aguardando Análise",
  "vendedor": {
    "id": "uuid",
    "nome": "Consultor XPTO",
    "codigo_indicacao": "CONSULT123"
  },
  "itens_pendentes": [
    "Foto/Selfie",
    "Data de nascimento"
  ]
}
```

Guarde o `sale_id` para acompanhamento no painel.

---

## Erros comuns

| HTTP | Situação |
|------|----------|
| `400` | Campos obrigatórios faltando, plano inválido/inativo |
| `404` | Vendedor não encontrado ou inativo |
| `500` | Erro interno ao persistir a venda |

---

## Comportamentos importantes

1. O `plano_id` deve existir e estar **ativo** (`GET https://comercial.trtelecom.net/api/plans`).
2. Se o CPF/CNPJ já existir, o sistema pode ajustar `pedido_tipo` para **`2° Ponto`** automaticamente.
3. Telefone é normalizado pelo backend; preferir formato BR com DDD.
4. Valores monetários aceitam `number` ou string numérica (`"149.90"`).
5. Quanto mais completo o body (documentos, mãe, RG, vencimento), menos itens ficam em `itens_pendentes`.

---

## Referência no código

- Handler: `POST /api/vendachat` em `backend/index.js`
- Utilitários de vendedor / pendências: `backend/vendachatUtils.js`
- Visão geral de todos os cadastros: `docs/CADASTROS_API.md`

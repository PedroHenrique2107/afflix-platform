# Endpoints REST — Contratos de implementação

## Convenções

- Base `/api/v1`, JSON UTF-8, erros tipados, `application/json`.
- Instalação local protegida por bind `127.0.0.1`; autenticação obrigatória antes de exposição remota.
- Valores monetários e taxas serializados como **strings decimais**, e IDs marketplace como string.
- `source` indica `mock` ou `shopee`; não ocultar esse campo.

## GET /health — implementado no scaffold

Resposta: `200 {"status":"ok"}`.

## GET /products/search — implementado no scaffold

Query `keyword=organizador%20de%20cozinha&minCommissionPercent=8&page=1&limit=20`.

Parâmetros: keyword 3–100 chars, min comissão 0–100, page >=1, limit 1–50; minPrice/maxPrice opcionais e minRating 0–5. Retorna `{ data: Offer[], meta: { page,limit,hasNextPage,source } }`.

Exemplo fictício:

```json
{
 "data":[{"marketplace":"SHOPEE","itemId":"123","shopId":"456","name":"Organizador de cozinha (DADO FICTÍCIO)","productUrl":"https://shopee.com.br/product/456/123","price":"59.90","commissionRate":"0.080000","commissionPercent":"8.00","saved":false}],
 "meta":{"page":1,"limit":20,"hasNextPage":false,"source":"mock"}
}
```

## Rotas do backlog (não implementadas no scaffold)

| Método | Endpoint | Regras |
|---|---|---|
| GET | `/products` | Paginação local, favoritos, filtros |
| GET | `/products/:id` | Retornar dados e último snapshot |
| POST | `/products/import` | Body: marketplace/shopId/itemId; consultar provider ou cache válido; upsert atômico |
| POST | `/products/:id/refresh` | Atualizar com fonte e horário, preservar snapshot |
| GET | `/products/:id/history` | Preços/taxas anteriores com timezone UTC |
| POST | `/affiliate-links` | `productId,channel,campaign,subIds`; validar URL de origem permitida |
| GET | `/integrations/shopee/status` | modo, acesso configurado, status, sem revelar segredo |
| POST | `/media` | asset com origem, direitos, caminho e hash |
| POST | `/publications` | rascunho com produto, mídia, canal |
| PATCH | `/publications/:id` | transições e URL publicada manualmente |

## Respostas e erros

`400` validação, `404` desconhecido, `409` conflito de estado, `429` cota local, `502` upstream inválido, `503` credenciais ausentes/upstream indisponível. GraphQL pode retornar HTTP 200 com `errors`: tratar como erro. Erros públicos não expõem secrets, body autenticado ou detalhes do banco.

## Idempotência

Importação identifica produto por `(marketplace,shopId,itemId)`; geração de links deve adotar chave de idempotência ou deduplicar por `productId+channel+campaign+subIds` quando garantias do fornecedor permitirem. Nunca repetir mutation cegamente após timeout.

## Evolução sem quebrar consumidores

Adicionar campos opcionais; não alterar tipo monetário de string para float; usar versionamento REST para mudanças incompatíveis. Testar contratos React/API em cada PR.

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

O campo `saved` agora reflete o catálogo persistido (`true` se `[marketplace, shopId, itemId]` já existe em `Product`). Se o banco estiver indisponível, a busca continua funcionando e devolve `saved:false` (aviso no log).

## POST /products/import — implementado (SW-1)

Importa ofertas selecionadas para o catálogo, com upsert idempotente pela unique `[marketplace, shopId, itemId]`. Cada oferta grava produto e `PriceSnapshot` (preço e comissão observados) na mesma transação.

Body: `{ "offers": Offer[] }`, de 1 a 50 ofertas.

- Obrigatórios por oferta: `marketplace` (`SHOPEE`), `shopId`, `itemId`, `name`, `productUrl` (http/https).
- Opcionais: `offerUrl`, `imageUrl`, `price`, `priceMax`, `estimatedCommission` (decimal >= 0), `commissionRate` (decimal de 0 a 1, `0.08` = 8%), `rating` (0 a 5), `sales` (inteiro >= 0).
- Decimais são strings. Valores além da escala do schema são arredondados half-up: 2 casas para dinheiro e rating, 6 para `commissionRate`.
- Campo opcional ausente: grava `NULL` na criação e **mantém o valor atual** na atualização.
- Campo desconhecido no body gera `400`.

Resposta `200`:

```json
{ "data": { "created": 1, "updated": 1, "total": 2 } }
```

Cada oferta é transacional por si; se uma falhar, as anteriores do lote já foram gravadas. Como o upsert é idempotente, repetir o lote é seguro.

## GET /products — implementado (SW-1)

Lista o catálogo persistido (`isArchived: false`), ordenado por `lastSyncedAt` decrescente. Query `page` (>=1, padrão 1) e `limit` (1–50, padrão 20).

```json
{
 "data":[{"id":"…","marketplace":"SHOPEE","shopId":"456","itemId":"123","name":"…","productUrl":"…","price":"59.90","commissionRate":"0.080000","commissionPercent":"8.00","rating":"4.80","lastSyncedAt":"…"}],
 "meta":{"page":1,"limit":20,"total":1,"hasNextPage":false}
}
```

Decimais saem como string na escala do schema (`"0.080000"`, nunca `0.08`); campos sem valor saem `null`.

## Rotas do backlog (não implementadas no scaffold)

| Método | Endpoint | Regras |
|---|---|---|
| GET | `/products/:id` | Retornar dados e último snapshot |
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

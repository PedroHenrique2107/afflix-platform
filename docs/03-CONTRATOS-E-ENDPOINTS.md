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

`productId` (SW-2): id do produto no catálogo quando `saved:true`, `null` caso contrário. Permite gerar link sem reimportar.

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
{ "data": { "created": 1, "updated": 1, "total": 2,
  "items": [{ "id": "…", "marketplace": "SHOPEE", "shopId": "456", "itemId": "123" }] } }
```

`items` (SW-2, campo adicional): um registro por produto distinto do lote, com o `id` do catálogo.

Cada oferta é transacional por si; se uma falhar, as anteriores do lote já foram gravadas. Como o upsert é idempotente, repetir o lote é seguro.

## POST /affiliate-links — implementado (SW-2)

Gera link de afiliado rastreável para um produto do catálogo e persiste em `AffiliateLink`. Tipos do contrato em `@afflix/shared` (`CreateAffiliateLinkRequest`, `CreateAffiliateLinkResponse`).

Body:

- `productId` (UUID, obrigatório): produto do catálogo, não arquivado.
- `channel` (obrigatório): um de `AFFILIATE_CHANNELS` (`INSTAGRAM`, `TIKTOK`, `SHOPEE_VIDEO`, `TELEGRAM`).
- `campaign` (opcional): até 60 caracteres; só espaços equivale a ausente.
- `subIds` (opcional): até 5, cada um alfanumérico de 1 a 50 caracteres. Ausente: derivados de canal e campanha (`["instagram","natal2026"]`). **Limites a confirmar na conta homologada.**

Resposta `200`:

```json
{ "data": { "id":"…","productId":"…","channel":"INSTAGRAM","campaign":"Natal 2026",
  "subIds":["instagram","natal2026"],"shortUrl":"https://link-ficticio.invalid/51f1f26ff04b","createdAt":"…" },
  "meta": { "reused": false, "source": "mock" } }
```

- **Idempotência:** `dedupeKey` único = sha256 de `source+productId+channel+campaign+subIds`. Pedido igual devolve o registro existente com `reused:true`, sem chamar a Shopee. Em corrida, a segunda requisição devolve o registro vencedor.
- A mutation `generateShortLink` é chamada **uma vez**, sem retry automático.
- Origem do link: só `https` em `shopee.com.br` ou subdomínio; fora disso `409`. `shortUrl` da Shopee só é aceito em host da Shopee (`502` caso contrário).
- Modo mock: link fictício em `link-ficticio.invalid` (domínio reservado, nunca resolve), `source:"mock"`. A fonte entra na chave, então link mock nunca é reaproveitado no live.
- Erros: `400` validação, `404` produto inexistente/arquivado, `409` origem não permitida, `502`/`503` Shopee.

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

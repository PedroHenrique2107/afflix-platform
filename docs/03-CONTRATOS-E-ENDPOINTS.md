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

## GET /integrations/status — implementado (SW-3 / RF08)

Estado da integração Shopee sem revelar segredo. Tipo do contrato em `@afflix/shared` (`IntegrationStatusResponse`).

```json
{ "data": { "shopee": { "mode": "live", "lastSuccessfulSyncAt": "2026-11-20T12:34:56.000Z" } } }
```

- `mode`: `live` só com `SHOPEE_MOCK_MODE=false` exato; qualquer outro valor é `mock`.
- `lastSuccessfulSyncAt`: última chamada bem-sucedida à Shopee (busca ou link) desde que a api subiu. Fica em memória: `null` após reiniciar, até a primeira chamada OK. Em `mock` permanece `null`.
- Nunca inclui App ID, secret, fragmento deles ou URL com credencial.

## Resiliência da chamada à Shopee (SW-3 / RNF03)

- Timeout de 15s por tentativa.
- **Queries** (busca) repetem só em falha transitória: HTTP 429, 5xx, timeout, falha de rede e códigos GraphQL `10030` (limite) e `10000` (System Error da Shopee, equivalente a 5xx; observado na conta real em 20/11/2026). Backoff exponencial com jitter (500ms, 1s, 2s… teto 8s); `Retry-After` do 429 é respeitado e, acima de 30s, a api desiste na hora.
- Teto de novas tentativas em `SHOPEE_MAX_RETRIES` (padrão 2, máximo 5, `0` desliga).
- Nunca repetem: `10020` (autenticação), `10035` (sem acesso), outros 4xx e erros de schema.
- A **mutation** `generateShortLink` nunca é repetida automaticamente (não é idempotente).
- Mensagens públicas: `10020` → `502 Falha de autenticação com a Shopee`; `10035` → `502 Conta sem acesso à API da Shopee`; limite → `503`; `10000` após esgotar as tentativas → `502 Shopee indisponível no momento`. O código e a mensagem da Shopee vão só para o log da api.

## Biblioteca de mídia — implementado (SW-16 / RF09)

Tipos do contrato em `@afflix/shared` (`MediaAssetView`, `CreateMediaAssetFields`, `UpdateMediaAssetRequest`, `ListMediaAssetsResponse`, `MEDIA_LICENSE_TYPES`).

### POST /media

`multipart/form-data` com o arquivo no campo `file` (só `video/*`, até 500 MB) e os campos em texto:

- `title` (obrigatório): até 200 caracteres.
- `licenseType` (obrigatório): um de `ORIGINAL`, `COMMERCIAL_LICENSE`, `CREATOR_CONSENT`, `CC_COMMERCIAL`.
- `sourceUrl` (opcional): URL http/https de origem.
- `rightsEvidence` (opcional): prova de licença (contrato, termo, nota da compra), até 2000 caracteres.
- `licenseExpiresAt` (opcional): `YYYY-MM-DD` (vale até o fim do dia, UTC) ou ISO 8601. Ausente = sem vencimento.

`sha256` e `storagePath` **nunca** vêm do cliente (enviar qualquer um vira `400`). A api calcula o SHA-256 do arquivo em stream e o grava em `MEDIA_STORAGE_DIR` (padrão `data/media`, fora do Git) como `<sha256>.<ext>`; `storagePath` é relativo a essa pasta.

Resposta `201`:

```json
{ "data": { "id":"…","title":"Unboxing","storagePath":"961a…4ae8.mp4","sha256":"961a…4ae8",
  "sourceUrl":"https://exemplo.com/v","licenseType":"CREATOR_CONSENT","rightsEvidence":null,
  "licenseExpiresAt":"2027-06-30T23:59:59.999Z","licenseStatus":"MISSING_EVIDENCE","publishable":false,"createdAt":"…" } }
```

- Erros: `400` validação (sem `licenseType`, sem arquivo, arquivo que não é vídeo), `409` arquivo com o mesmo SHA-256 já cadastrado, `413` acima do limite. Em qualquer erro o arquivo enviado é apagado.

### GET /media

Lista paginada, mais recente primeiro. Query `page` (>=1, padrão 1) e `limit` (1–50, padrão 20). Mesmo `meta` do `GET /products`.

### PATCH /media/:id

JSON só com metadados: `title`, `licenseType`, `sourceUrl`, `rightsEvidence`, `licenseExpiresAt`. Ausente mantém; `null` ou vazio limpa os opcionais. Arquivo, `storagePath` e `sha256` são imutáveis (`400`). `404` se o asset não existe.

### Regra de licença

`licenseStatus` é calculado a cada resposta: `VALID` (tem `rightsEvidence` e não venceu), `MISSING_EVIDENCE` ou `EXPIRED`. `publishable` = `VALID`. O módulo de publicações chama `assertMediaPublishable()` (`apps/api/src/modules/media/media-license.ts`) ao associar um asset e de novo ao marcar `READY` e `PUBLISHED_MANUALLY`: fora de `VALID` responde `409`.

## GET /affiliate-links — implementado (SW-20)

Query `productId` (UUID, obrigatório) e `channel` (opcional). Devolve `{ data: AffiliateLinkView[] }` com os links já gerados do produto, mais recente primeiro (até 50). Não chama a Shopee.

## Publicação manual — implementado (SW-19 / RF10)

Tipos do contrato em `@afflix/shared` (`PublicationView`, `CreatePublicationRequest`, `UpdatePublicationRequest`, `ChangePublicationStatusRequest`, `PUBLICATION_TRANSITIONS`, `DEFAULT_CTA_BY_CHANNEL`).

### Transições

| De | Para |
|---|---|
| `DRAFT` | `READY`, `ARCHIVED` (descartar rascunho) |
| `READY` | `DRAFT` (voltar para edição), `PUBLISHED_MANUALLY` |
| `PUBLISHED_MANUALLY` | `ARCHIVED` |
| `ARCHIVED` | nenhuma |

Qualquer outra transição responde `400`. Cada `PublicationView` traz `allowedTransitions`.

### POST /publications

JSON: `productId` e `channel` (obrigatórios), `caption`, `cta`, `affiliateLinkId`, `mediaAssetId` (opcionais). Nasce `DRAFT`. Sem `cta`, usa o padrão do canal. O link precisa ser do mesmo produto e do mesmo canal (`400`); mídia fora de `VALID` → `409`; produto, link ou mídia inexistente → `404`.

### PATCH /publications/:id

Só em `DRAFT` (`409` nos demais). Campos: `channel`, `caption`, `cta`, `affiliateLinkId`, `mediaAssetId`. Ausente mantém; `null` ou vazio limpa. Trocar o canal exige link do novo canal.

### POST /publications/:id/status

JSON `{ "status": "...", "externalUrl"?: "...", "publishedAt"?: "..." }`, resposta `200` com a publicação.

- `READY` exige legenda, CTA e link de afiliado (`400` dizendo o que falta).
- `PUBLISHED_MANUALLY` exige `externalUrl` (http/https) e `publishedAt` (`YYYY-MM-DD` ou ISO 8601, não pode estar no futuro).
- `externalUrl`/`publishedAt` em outro destino → `400`.
- Grava só se o status ainda for o lido; corrida entre duas abas → `409`.

### GET /publications/:id/briefing (SW-21)

Download `text/plain; charset=utf-8` (`Content-Disposition: attachment`, `briefing-<canal>-<produto>-<id>.txt`) com produto (nome, preço, página), link de afiliado, legenda, CTA, texto pronto para colar, mídia (arquivo, SHA-256, licença e prova) ou o aviso de que não há mídia, e o checklist manual. `409` se faltar legenda, CTA ou link; `409` se a publicação ainda não foi publicada e a licença da mídia deixou de valer. Funciona sem mídia associada.

### GET /publications e GET /publications/:id

Lista paginada (`page`, `limit` 1–50, `status` opcional), ordenada pela última alteração. Mesmo `meta` do `GET /products`.

## Métricas de publicação — implementado (SW-23 / RF11)

Tipos em `@afflix/shared` (`RecordPublicationMetricRequest`, `PublicationMetricView`, `MetricsReportResponse`). Cada registro é o **valor acumulado observado** num instante, sempre com fonte, referência da origem e data de observação.

- `kind`: `VIEWS`, `CLICKS`, `ORDERS` (pedidos atribuídos) ou `COMMISSION` (BRL). Contagens são inteiras; comissão tem até 2 casas.
- `source`: `MANUAL` (anotado pelo operador) ou `OFFICIAL_REPORT` (transcrito de relatório oficial: painel de afiliados, insights do canal). Na V1 os dois são digitados; a importação automática do relatório da Shopee está no roadmap da V2.
- `value` é serializado como string decimal (`"120"`, `"4.35"`).

### POST /publications/:id/metrics

Body: `kind`, `value` (número ou string, >= 0), `source`, `sourceReference` (3–200 caracteres, de onde o número saiu), `observedAt` (`YYYY-MM-DD` ou ISO 8601). Todos obrigatórios. Resposta `201 { data: PublicationMetricView }`.

- `404` publicação inexistente; `409` publicação sem `publishedAt` (só publicação já publicada recebe métrica).
- `400` campo ausente, fonte fora da lista, referência em branco, valor negativo ou com mais de 2 casas, contagem fracionada, `observedAt` no futuro ou anterior à publicação (data sem hora compara pelo dia).

### GET /publications/:id/metrics

Histórico completo da publicação, mais recente primeiro (`observedAt` e, no empate, o registro mais novo). `404` se a publicação não existir.

### GET /metrics/report?groupBy=publication|product

Relatório agregado. Para cada publicação vale o **último** registro por métrica e fonte (somar o histórico contaria em dobro). `groupBy=product` soma esse último valor das publicações do produto.

- Manual e relatório oficial ficam em células separadas e **nunca são somados**.
- Cada célula traz `value`, `source`, `publicationCount`, `observedAt` (observação mais recente), `oldestObservedAt` (mais antiga) e `sourceReferences`.
- Só aparecem combinações com registro: nenhum número sem origem, nenhum zero inventado.
- `400` sem `groupBy` ou com valor fora da lista. Agregação em memória, dimensionada para o volume do MVP.

## Rotas do backlog (não implementadas no scaffold)

| Método | Endpoint | Regras |
|---|---|---|
| GET | `/products/:id` | Retornar dados e último snapshot |
| POST | `/products/:id/refresh` | Atualizar com fonte e horário, preservar snapshot |
| GET | `/products/:id/history` | Preços/taxas anteriores com timezone UTC |

## Respostas e erros

`400` validação, `404` desconhecido, `409` conflito de estado, `429` cota local, `502` upstream inválido, `503` credenciais ausentes/upstream indisponível. GraphQL pode retornar HTTP 200 com `errors`: tratar como erro. Erros públicos não expõem secrets, body autenticado ou detalhes do banco.

## Idempotência

Importação identifica produto por `(marketplace,shopId,itemId)`; geração de links deve adotar chave de idempotência ou deduplicar por `productId+channel+campaign+subIds` quando garantias do fornecedor permitirem. Nunca repetir mutation cegamente após timeout.

## Evolução sem quebrar consumidores

Adicionar campos opcionais; não alterar tipo monetário de string para float; usar versionamento REST para mudanças incompatíveis. Testar contratos React/API em cada PR.

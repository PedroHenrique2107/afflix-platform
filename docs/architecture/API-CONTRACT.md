# Contrato REST V1 (planejado)

Prefixo `/api/v1`. `GET /health` para saúde. Erros: `{ "code": "...", "message": "...", "requestId": "..." }`; não vazar detalhes do provedor.

| Método | Rota | Descrição | Status scaffold |
|---|---|---|---|
| GET | /products/search?keyword=organizador%20de%20cozinha&minCommission=8&page=1&limit=20 | Busca e filtra ofertas | Implementado em modo mock |
| GET | /products | Lista salvos | Planejado |
| GET | /products/:id | Detalhe | Planejado |
| POST | /products/import | Importa produto após revalidação | Planejado |
| POST | /products/:id/refresh | Atualiza produto | Planejado |
| GET | /products/:id/history | Histórico | Planejado |
| POST | /affiliate-links | Gera shortlink e subIds | Planejado |
| GET | /integrations/shopee/status | Estado sem credenciais | Planejado |
| POST | /media | Registra arquivo/licença | Planejado |
| POST | /publications | Registra publicação manual | Planejado |

## Busca
Query: `keyword` 2–120 caracteres; `minCommission` 0–100 (padrão 8); `page` >=1; `limit` 1–50; filtros opcionais `minPrice`, `maxPrice`, `minRating`. Preço BRL. Resultado `{data: ProductOffer[], meta: {page,limit,hasNextPage,source, fetchedAt}}`.

## Idempotência
`POST /products/import` usa chave `(provider,shopId,externalId)`; shortlinks podem ser reutilizados por produto+canal+campanha+subIds se política do provedor permitir.

## Autorização
V1: acesso somente localhost, sem endpoints públicos; se houver acesso remoto, adicionar login e proteção CSRF/cookies, CORS estrito, RBAC e auditoria antes da exposição.

# Status do Afflix — 08/11/2026

**Estado:** PR-001 validada de ponta a ponta neste ambiente, incluindo Docker/Postgres/migrações, API e **frontend React validado manualmente no navegador pelo usuário** (busca padrão retorna as 2 ofertas mock; filtro 12% retorna lista vazia). Dois bugs reais de DI/validação encontrados e corrigidos durante a validação.

## Validado
- `pnpm install`: OK.
- `pnpm --filter @afflix/api prisma:generate`: OK.
- `pnpm test`: 13/13 testes passaram.
- `pnpm build` (api + web): OK, sem erros de tipo.
- `docker compose up -d`: Postgres sobe e fica `healthy`.
- `pnpm --filter @afflix/api prisma:migrate`: aplica a migração `init` com sucesso.
- `pnpm --filter @afflix/api dev`: NestJS sobe e responde.
- `GET /api/v1/health`: retorna `{"status":"ok"}`.
- `GET /api/v1/products/search?keyword=organizador de cozinha&minCommissionPercent=8`: retorna as 2 ofertas mock (8% e 11%); com corte de 12% retorna lista vazia — confirma que a de 7,5% (e demais abaixo do corte) é excluída.
- Frontend (`pnpm dev`, http://localhost:5173, proxy Vite → API): validado manualmente no navegador. Formulário pré-preenchido, busca padrão mostra os 2 cards mock com aviso de dado demonstrativo, filtro 12% zera a lista.

## Bugs encontrados e corrigidos nesta validação
1. **`apps/api/tsconfig.json`**: `moduleResolution: "Node"` estava deprecated (TS 5.9) e `target: "ES2022"` ativava `useDefineForClassFields: true`, o que quebra parameter properties com decorators. Corrigido (removido `moduleResolution` explícito, adicionado `useDefineForClassFields: false`).
2. **DI quebrada em runtime com `tsx`/esbuild**: `tsx` (via esbuild) não suporta `emitDecoratorMetadata`, então o NestJS não conseguia resolver o tipo de parâmetros injetados apenas por tipagem implícita. Isso quebrava:
   - `DiscoveryController` (injeção de `DiscoveryService`) e `ShopeeOfferProvider` (injeção de `ShopeeGraphqlClient`) → corrigido com `@Inject(Classe)` explícito.
   - `@Query() query: SearchProductsDto` no `DiscoveryController.search` nunca era transformado/validado (chegava como strings cruas) → corrigido instanciando e validando o DTO manualmente com `plainToInstance`/`validate` dentro do controller, em vez de depender da reflexão implícita de tipo do Nest.

## SW-1 — Persistência: produtos e importação com upsert (em andamento, branch `feat/SW-1-persistencia-produtos-importacao-upsert`)
- `PrismaModule` global + `PrismaService` (conecta/desconecta no ciclo de vida do Nest; `enableShutdownHooks` no `main.ts`).
- `POST /api/v1/products/import`: upsert idempotente + `PriceSnapshot` por oferta, na mesma transação. Retorna `{created, updated, total}`.
- `GET /api/v1/products`: catálogo paginado (`lastSyncedAt desc`, sem arquivados).
- `saved` da busca agora vem do catálogo (consulta em lote; sem banco, cai para `false`).
- Decimais via `Prisma.Decimal` com arredondamento half-up na escala do schema; nunca `Number`.
- Validado: `pnpm test` 30/30 e `pnpm build` OK (Prisma mockado em memória nos testes).
- Validado contra Postgres real (18/11/2026): API sobe com DI via `tsx`; importar a mesma oferta duas vezes resultou em 1 `Product` e 2 `PriceSnapshot` (`59.90/0.080000` e `62.35/0.100000`); decimais exatos no banco; `GET /products` paginado; `saved` correto na busca (modo mock); body inválido e `page=0` retornam 400.
- Pendente: provar a migração em banco limpo com `prisma migrate reset` (o banco local já tinha a `init` aplicada).
- Fora de escopo: `AffiliateLink` real, MediaAsset, publicações, UI do `saved`.

## SW-2 — Links de afiliado rastreáveis (em andamento, branch `feat/SW-2-links-afiliado`)
- SW-8: `ShopeeGraphqlClient.generateShortLink` (sem retry; `shortLink` só aceito em host da Shopee).
- SW-9: `POST /api/v1/affiliate-links` com persistência em `AffiliateLink`; migration `affiliate_link_dedupe_key` (`dedupeKey` único, sem duplicar link); `LinkProvider` mock/shopee por `SHOPEE_MOCK_MODE`.
- `packages/shared` agora é consumido por api e web (build CJS em `dist`; testes e Vite leem `src`). Canais, limites de subIds e tipos do link vivem lá.
- Import devolve `items` com `id`; busca devolve `productId` (campos adicionais, sem quebra).
- SW-10: card com canal, campanha, "Gerar link" e "Copiar"; aviso de link fictício em modo mock.
- Validado (18/11/2026): `pnpm test` 57/57, `pnpm build` OK; api via `node dist` e via `tsx` contra Postgres real em mock forçado: import → link → mesmo pedido reaproveitado (1 linha no banco), 400 canal inválido, 404 produto inexistente.
- Conta real (18/11/2026, teste do Pedro): schema exige input inline e `subIds: [String!]` (o tipo `GenerateShortLinkInput` não existe, erro 10010). Com isso, `generateShortLink` gerou link `https://s.shopee.com.br/...` com e sem subIds a partir da URL `/product/<shop>/<item>`.
- **Pendente:** confirmar a atribuição dos subIds no painel da conta (critério do card) e o limite máximo de subIds.

## Pendente
- Validar query GraphQL com acesso real aprovado pela Shopee.
- Implementar publicações manuais em PRs futuras.
- Avaliar extensão do mesmo padrão explícito (`@Inject`) a outros módulos que venham a ser criados, enquanto o dev runner continuar sendo `tsx`.
- Push/PR não realizados (aguardando autorização do usuário).

Ver `docs/PR-001-IMPLEMENTACAO.md` e `docs/EXECUCAO-LOCAL-E-CLAUDE-CODE.md`.

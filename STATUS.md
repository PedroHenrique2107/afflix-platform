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

## SW-3 — Homologação da integração Shopee com credenciais reais (branch `feat/SW-3-homologacao-shopee`)
- SW-4: `productOfferV2` homologado na conta real (20/11/2026) via `pnpm --filter @afflix/api shopee:homologar` (introspecção + busca; saída sem credencial). Query aceita sem ajuste; `commissionRate` é fração (confirmado: `commission = priceMin × rate`); IDs `Int64` com ~11 dígitos (seguros). Provider descarta ID fora do intervalo seguro e mapeia `ratingStar "0"` como sem avaliação. Resultado em `docs/05`.
- SW-5: testes por fixture para 10020, 10035, 429, `data + errors` e timeout; nenhum cenário vaza credencial em mensagem HTTP ou log.
- SW-6: retry com backoff exponencial + jitter só na busca, em 429/5xx/timeout/rede/10030/10000; respeita `Retry-After` (desiste acima de 30s); teto em `SHOPEE_MAX_RETRIES` (padrão 2). Nunca repete 10020/10035/4xx nem a mutation `generateShortLink`.
- SW-7: `GET /api/v1/integrations/status` → `{ mode, lastSuccessfulSyncAt }` (em memória). `ShopeeModule` com instância única do client; chave mock/live centralizada em `isShopeeLiveMode()`.
- Validado (20/11/2026): `pnpm test` 96/96, `pnpm build` OK. Com `SHOPEE_MOCK_MODE=false` e Postgres real (teste do Pedro): status `live`/`null` → busca com 3 ofertas reais (`source: "shopee"`) → status com `lastSuccessfulSyncAt` preenchido. Shopee devolveu `10000 System Error` numa tentativa (body idêntico ao do script que funcionou) — motivou incluir 10000 no retry.
- Observação fora do escopo: a api não sobe sem Postgres (`PrismaService.onModuleInit`), embora a busca tolere banco indisponível.

## SW-11 — Catálogo: produtos salvos na interface (branch `feat/SW-11-catalogo-interface`)
Só `apps/web` e tipos em `packages/shared`; api e banco sem mudança (consome os endpoints da SW-1).
- SW-13: botão "Salvar no catálogo" no card da busca (`POST /products/import`), com feedback de sucesso e de erro. Reimportar não duplica (upsert da SW-1).
- SW-14: produto já salvo fica destacado (borda + selo "✓ No catálogo") e a ação de salvar vira "✓ Salvo no catálogo" desabilitado, evitando reimport e `PriceSnapshot` extra.
- SW-12: abas Buscar/Catálogo (estado, sem roteador; a busca sobrevive à troca de aba). Catálogo via `GET /products`, 12 por página, com estados de carregando, vazio ("Ir para a busca") e erro ("Tentar novamente"). Card do catálogo mostra sincronização e gera link de afiliado direto pelo `productId`.
- Formulário de link extraído para `AffiliateLinkForm` (busca e catálogo) e chamadas HTTP centralizadas em `apps/web/src/api.ts`. Contrato novo no shared: `ImportProductsResponse`, `CatalogProduct`, `ListProductsResponse`.
- Validado (20/11/2026): `pnpm build` OK e `pnpm test` 96/96 a cada subtask. No navegador (Playwright contra `pnpm dev`, modo live, sem gerar link real): salvar 3→4 produtos e 3→4 snapshots; botão desabilitado não reimporta; `saved` volta do banco numa nova busca; catálogo na ordem da api; paginação real com `limit` 2; vazio e erro com resposta simulada; "Gerar link" envia o `productId` certo sem reimportar.
- Limitações: o `apps/web` não tem testes automatizados (sem vitest); produto salvo em modo mock aparece no catálogo com URL fictícia, porque o banco não guarda a origem (mock/live).

## SW-15 — Frontend: quebra do App.tsx em rotas e componentes (branch `refactor/SW-15-quebra-app-tsx`)
Só `apps/web`; api, banco e shared sem mudança. Refactor sem mudança funcional, preparando as telas de Mídia, Publicação e Métricas.
- Navegação com `react-router-dom` (dependência nova): `/busca` e `/catalogo`; `/` e rota desconhecida redirecionam para `/busca`. Menu em `layout/AppLayout.tsx` (nova tela = entrada no `NAV` + `<Route>` no `App.tsx`).
- Estado da busca em `search/useProductSearch.ts`, mantido no layout e repassado por `<Outlet context>`: a busca sobrevive à troca de tela, o catálogo recarrega ao abrir (igual às abas da SW-12).
- Chamadas HTTP só em `src/api/` (`client.ts`, `products.ts`, `affiliateLinks.ts`); páginas em `pages/`, componentes em `components/` (`SearchForm` e `CatalogCard` extraídos). Maior arquivo do web: 73 linhas (teto adotado: 350).
- Validado (20/11/2026): `pnpm test` 96/96 e `pnpm build` OK. No navegador (Playwright + Edge contra `pnpm dev`, modo live, só leitura): `/` → `/busca`, busca com 20 resultados, navegação para o catálogo (4 produtos, paginação), volta para a busca mantendo os resultados, botão voltar, F5 em `/catalogo` e rota desconhecida → `/busca`; nenhuma requisição de escrita e nenhum erro de JS.
- Fora do escopo, observado: `/favicon.ico` responde 404 (já acontecia antes).

## SW-16 — Mídia: biblioteca com licença e proveniência (branch `feat/SW-16-biblioteca-midia`)
api, web e shared; sem migration (o model `MediaAsset` já existia) e sem dependência nova.
- SW-17: módulo `media` na api. `POST /api/v1/media` (multipart, só vídeo, até 500 MB) com `licenseType` obrigatório e SHA-256 calculado em stream pela api, nunca recebido do cliente; `GET /api/v1/media` paginado; `PATCH /api/v1/media/:id` só de metadados. Arquivo salvo como `<sha256>.<ext>` em `MEDIA_STORAGE_DIR` (variável opcional, padrão `data/media`, ignorado pelo Git) atrás de um adaptador de storage (ADR-006). Mesmo arquivo duas vezes → `409`; erro em qualquer etapa apaga o arquivo enviado.
- Regra "sem prova de licença não entra em publicação": `licenseStatus` (`VALID`/`MISSING_EVIDENCE`/`EXPIRED`) + `publishable` em cada asset e `assertMediaPublishable()` pronta para o futuro módulo de publicações (não há endpoint de publicação ainda).
- SW-18: tela `/midia` (menu "Mídia") com formulário de cadastro e listagem mostrando tipo de licença, validade (vencida em vermelho), origem, prova, hash e selo de status; estados de carregando, vazio e erro; paginação.
- Validado (20/11/2026): `pnpm test` 114/114 e `pnpm build` OK. api via `tsx` contra Postgres real: hash gravado igual ao `sha256sum` local; 400 sem `licenseType`, com `sha256` do cliente, arquivo não vídeo e sem arquivo; 409 duplicado; PATCH com prova muda o status para `VALID`; pasta temporária vazia após os erros. Tela conferida no Edge headless (lista com asset publicável e bloqueado, estado vazio). Registros de teste removidos do banco.
- Fora do escopo: editar metadados pela tela (a api já tem o PATCH), excluir asset, player/preview do vídeo.

## SW-19 — Publicação: ciclo manual de rascunho a publicado (branch `feat/SW-19-publicacao-manual`)
api, web e shared. Migration `publication_affiliate_link_cta`: `Publication` ganha `affiliateLinkId` (FK opcional para `AffiliateLink`, `ON DELETE SET NULL`) e `cta`. Sem dependência nova nem variável de ambiente nova.
- SW-20: módulo `publications` na api. `POST/GET /publications`, `GET/PATCH /publications/:id` (PATCH só em `DRAFT`, senão `409`) e `POST /publications/:id/status`. Transições em `PUBLICATION_TRANSITIONS` (shared): DRAFT→READY/ARCHIVED, READY→DRAFT/PUBLISHED_MANUALLY, PUBLISHED_MANUALLY→ARCHIVED; qualquer outra → `400`. READY exige legenda, CTA e link; PUBLISHED_MANUALLY exige URL http(s) e data (não futura). Link tem que ser do mesmo produto e canal. Mídia passa por `assertMediaPublishable()` ao associar e de novo em READY e PUBLISHED_MANUALLY (`409`). Gravação condicional ao status lido (corrida → `409`). Novo `GET /affiliate-links?productId=&channel=` (só leitura, não chama a Shopee).
- SW-21: `GET /publications/:id/briefing` baixa `.txt` UTF-8 com produto (nome, preço, página), link, legenda, CTA, texto pronto para colar, mídia (arquivo, SHA-256, licença, prova) ou aviso de "sem mídia", e checklist. `409` se faltar legenda/CTA/link ou se a licença da mídia deixou de valer antes de publicar.
- SW-22: tela `/publicacoes` (menu "Publicações"): formulário de rascunho (produto do catálogo, canal, link do produto+canal, vídeo só com licença válida, legenda, CTA pré-preenchido por canal), edição em rascunho, filtro por status, card com selo de status e checklist de 7 itens, exportar briefing e registro da publicação com URL, confirmação do canal e data/hora obrigatórios.
- Validado (20/11/2026): `pnpm install --frozen-lockfile`, `pnpm test` 161/161 e `pnpm build` OK (mesma sequência da CI). Migration aplicada no Postgres local. api via `tsx` (modo live): ciclo completo por HTTP, 400 ao pular etapa, 409 ao editar fora de rascunho, 400 sem data, briefing com `Content-Disposition` e UTF-8. Tela no Edge headless (Playwright, `POST /affiliate-links` bloqueado): rascunho → briefing baixado e conferido → pronta → canal divergente recusado → publicada (checklist 7/7) → filtro → arquivada; nenhum erro de JS. Registros de teste removidos do banco.
- Atenção: um smoke por HTTP em modo live gerou 1 short link real na Shopee (`POST /affiliate-links`, 20/11/2026 19:09 UTC); o link ficou no catálogo.
- Fora do escopo: métricas de publicação (RF11), excluir publicação, guardar no banco que o briefing foi exportado (o item do checklist vale só na sessão).

## SW-23 — Métricas: registro e relatórios com fonte e timestamp (branch `feat/SW-23-metricas-relatorios`)
api, web e shared. Migration nova `publication_metrics`; sem dependência nova nem variável de ambiente nova.
- SW-24: model `PublicationMetric` (enums `MetricKind` e `MetricSource`), com `value Decimal(14,2)`, `source`, `sourceReference` e `observedAt` obrigatórios, mais CHECK de valor >= 0 e referência não vazia. Cada registro é o acumulado observado naquele instante.
- SW-25: módulo `metrics` na api. `POST /publications/:id/metrics` (só publicação com `publishedAt`, senão `409`; contagem inteira, comissão até 2 casas, `observedAt` nem futuro nem anterior à publicação), `GET /publications/:id/metrics` (histórico) e `GET /metrics/report?groupBy=publication|product` (último acumulado por publicação, métrica e fonte; manual e oficial nunca somados; cada número com fonte, intervalo de observação e referências).
- SW-26: tela `/metricas` (menu "Métricas"): formulário de registro (publicações publicadas, métrica, valor, fonte, referência e data de observação) e relatório por publicação ou por produto, com selo da fonte, data de observação e origem em cada linha, histórico por publicação e estados de carregando, vazio e erro.
- Validado (20/11/2026): `pnpm test` 180/180 e `pnpm build` OK. Migration aplicada em banco limpo (banco temporário, `prisma migrate deploy` das 4 migrations) e no Postgres local via `pnpm --filter @afflix/api prisma:migrate`. api via `tsx` contra Postgres real: 409 em rascunho, 400 sem fonte/sem data/referência em branco/pedido fracionado/negativo/futuro/antes da publicação, 404 inexistente; 50→120 no mesmo canal vira 120 no relatório; 120 manual e 110 oficial em linhas separadas; por produto 120+30 = 150 com `n=2`. Tela no Edge headless (Playwright, rotas da Shopee bloqueadas): relatório nas duas visões, histórico, registro pela tela atualizando o relatório, erro da api exibido, contagem fracionada barrada no formulário; nenhum erro de JS da aplicação. Registros de teste e banco temporário removidos.
- Fora do escopo: importar o relatório oficial da Shopee pela API (registrado no roadmap V2), editar ou excluir registro de métrica, filtros por período/canal no relatório, CTR calculado.

## Pendente
- ~~Validar query GraphQL com acesso real aprovado pela Shopee.~~ Feito na SW-3 (busca). Atribuição dos subIds no painel segue pendente (SW-2).
- Tabela "Estado atual do projeto" do `README.md` desatualizada desde a PR-001 (ainda marca banco e migrações como planejados).
- Infra de testes no `apps/web` (vitest + testing-library) para cobrir busca e catálogo.
- Avaliar extensão do mesmo padrão explícito (`@Inject`) a outros módulos que venham a ser criados, enquanto o dev runner continuar sendo `tsx`.
- Push/PR não realizados (aguardando autorização do usuário).

Ver `docs/PR-001-IMPLEMENTACAO.md` e `docs/EXECUCAO-LOCAL-E-CLAUDE-CODE.md`.

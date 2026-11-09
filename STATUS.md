# Status do Afflix — 08/11/2026

**Estado:** PR-001 validada de ponta a ponta neste ambiente, incluindo Docker/Postgres/migrações e a API rodando de verdade. Dois bugs reais de DI/validação encontrados e corrigidos durante a validação.

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

## Bugs encontrados e corrigidos nesta validação
1. **`apps/api/tsconfig.json`**: `moduleResolution: "Node"` estava deprecated (TS 5.9) e `target: "ES2022"` ativava `useDefineForClassFields: true`, o que quebra parameter properties com decorators. Corrigido (removido `moduleResolution` explícito, adicionado `useDefineForClassFields: false`).
2. **DI quebrada em runtime com `tsx`/esbuild**: `tsx` (via esbuild) não suporta `emitDecoratorMetadata`, então o NestJS não conseguia resolver o tipo de parâmetros injetados apenas por tipagem implícita. Isso quebrava:
   - `DiscoveryController` (injeção de `DiscoveryService`) e `ShopeeOfferProvider` (injeção de `ShopeeGraphqlClient`) → corrigido com `@Inject(Classe)` explícito.
   - `@Query() query: SearchProductsDto` no `DiscoveryController.search` nunca era transformado/validado (chegava como strings cruas) → corrigido instanciando e validando o DTO manualmente com `plainToInstance`/`validate` dentro do controller, em vez de depender da reflexão implícita de tipo do Nest.

## Pendente
- Validar query GraphQL com acesso real aprovado pela Shopee.
- Implementar persistência, links e publicações manuais em PRs futuras.
- Avaliar extensão do mesmo padrão explícito (`@Inject`) a outros módulos que venham a ser criados, enquanto o dev runner continuar sendo `tsx`.
- Push/PR não realizados (aguardando autorização do usuário).

Ver `docs/PR-001-IMPLEMENTACAO.md` e `docs/EXECUCAO-LOCAL-E-CLAUDE-CODE.md`.

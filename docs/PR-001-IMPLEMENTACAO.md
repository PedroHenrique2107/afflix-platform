# PR 001 — Fundação do MVP e descoberta de produtos (mock)

**Título:** `feat: scaffold monorepo e descoberta de ofertas em modo mock`

**Branch:** `feat/mvp-v1-product-discovery` → `main`

## Objetivo
Entregar a primeira funcionalidade executável: pesquisa de ofertas simuladas com filtro de comissão mínima de 8%, frontend React e API NestJS, sem depender de credenciais Shopee.

## Entregas incluídas
- Monorepo pnpm com React/Vite, NestJS e TypeScript.
- PostgreSQL em Docker Compose e esquema Prisma (a persistência de produtos ainda não é operacional).
- `GET /api/v1/health` e `GET /api/v1/products/search`.
- `OfferProvider` com implementação mock e implementação Shopee experimental.
- Validação de entrada e filtro de comissão com Decimal.
- Testes unitários do cliente de assinatura, DTO e filtros.
- CI para testes e builds.
- Documentação de configuração local e roadmap.

## Fora do escopo desta PR
- Integração homologada com API Shopee; aprovação de acesso pendente.
- Importação/persistência de produtos e links de afiliado.
- Autenticação remota, biblioteca de vídeos, agendamento e publicações.
- Testes reais de PostgreSQL e integração GraphQL.

## Riscos e restrições
- Query `productOfferV2` e escalas de campos exigem validação com schema oficial associado à conta.
- Mock contém produtos e links fictícios; não são ofertas válidas.
- A API é limitada a loopback local e não deve ser exposta sem autenticação.
- O banco local usa senha de desenvolvimento, nunca adequada a produção.

## Critérios de aceite
- [ ] `pnpm install` conclui e gera `pnpm-lock.yaml`.
- [ ] `pnpm --filter @afflix/api prisma:generate` conclui.
- [ ] `pnpm test` passa.
- [ ] `pnpm build` passa.
- [ ] `docker compose up -d` sobe PostgreSQL saudável.
- [ ] `pnpm --filter @afflix/api prisma:migrate` aplica schema.
- [ ] `pnpm dev` inicia React e NestJS.
- [ ] Pesquisa `organizador de cozinha` com 8% retorna 2 ofertas mock (8% e 11%).
- [ ] A oferta de 7,5% não aparece.
- [ ] `GET /api/v1/health` retorna `status: ok`.
- [ ] Nenhuma credencial, `.env`, dump ou mídia não licenciada foi incluída.

## Rollback
Reverter o merge commit ou a PR. Não realizar alterações destrutivas no banco; migrações futuras devem ter plano próprio de rollback.

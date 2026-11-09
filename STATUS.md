# Status do Afflix — 07/11/2026

**Estado:** scaffold revisado e ajustado; execução de dependências, build e testes de aplicação ainda não homologada neste ambiente.

## Presente no código
- React + Vite, NestJS, DTO de busca, adaptadores mock/Shopee, assinatura SHA256, filtro Decimal, schema Prisma, Docker Compose, CI e testes unitários.
- Testes adicionais para busca mock e validação de parâmetros; links de exemplo mock não são clicáveis no frontend.

## Pendente
- `pnpm install`, `prisma generate`, `pnpm test`, `pnpm build` em máquina com dependências disponíveis.
- Criar `pnpm-lock.yaml` e tornar CI reprodutível.
- Criar repositório privado e abrir PR.
- Validar query GraphQL com acesso real aprovado pela Shopee.
- Implementar persistência, links e publicações manuais em PRs futuras.

Ver `docs/PR-001-IMPLEMENTACAO.md` e `docs/EXECUCAO-LOCAL-E-CLAUDE-CODE.md`.

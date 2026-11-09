# Afflix Platform — projeto de afiliados (nome provisório)

> **07/11/2026 | Planejamento + scaffold técnico.** Não é produto pronto, não há integração Shopee homologada e nenhuma conta real foi conectada.

Monorepo de React + TypeScript e NestJS + TypeScript para uma plataforma de descoberta, organização e divulgação orgânica de ofertas afiliadas. Operação inicial **local e com publicações manuais**; a API de afiliados será integrada pela conta aprovada da sócia.

## Decisões centrais

- Um único Git privado, com `apps/web` e `apps/api` separadas para build e implantação independentes.
- PostgreSQL + Prisma local, sem Redis nem n8n na primeira entrega.
- `OfferProvider` mock/live; a V1 deve funcionar sem credenciais Shopee enquanto o acesso à API é avaliado.
- Busca inicial: `organizador de cozinha`, comissão mínima de **8%**.
- Gradualmente: histórico, geração de links, biblioteca de vídeos licenciados, rascunhos e registros de publicação manual.
- Nenhuma funcionalidade de postagem automática prometida para Shopee Video.

## Documentação

1. [Planejamento e requisitos V1](docs/01-MVP-V1-PLANEJAMENTO.md)
2. [Arquitetura detalhada](docs/02-ARQUITETURA-DETALHADA.md)
3. [Endpoints e contratos REST](docs/03-CONTRATOS-E-ENDPOINTS.md)
4. [Persistência e migrações](docs/04-PRISMA-DADOS-E-MIGRACOES.md)
5. [Arquivos para integração Shopee](docs/05-INTEGRACAO-SHOPEE-IMPLEMENTACAO.md)
6. [QA, segurança e operação](docs/06-QA-SEGURANCA-OPERACAO.md)
7. [Backlog e milestones](docs/07-BACKLOG-ENTREGAS.md)
8. [Nomes, repositório e governança](docs/08-NOMES-REPOSITORIO-E-GOVERNANCA.md)
9. [Guia para trabalhar com Claude Code](docs/09-GUIA-CLAUDE-CODE.md)

**Roadmap em arquivos próprios:** [V2](docs/roadmap/V2-AUTOMACAO-PARCIAL.md), [V3](docs/roadmap/V3-OPERACAO-NUVEM.md), [V4](docs/roadmap/V4-SAAS.md), [V5](docs/roadmap/V5-OTIMIZACAO-IA-E-MARKETPLACES.md).

## Estrutura

```text
afflix-platform/
├── apps/
│   ├── web/                 # React Vite: tela de busca
│   └── api/                 # NestJS: busca, Shopee, Prisma schema
├── packages/shared/        # tipos de domínio compartilháveis
├── docs/                   # requisitos, ADRs, roadmap
├── .github/                # template PR + CI
├── docker-compose.yml      # PostgreSQL local
└── pnpm-workspace.yaml
```

## Primeiro start (requer Node 22, Corepack/pnpm, Docker Compose)

```bash
corepack enable
pnpm install
docker compose up -d
cp apps/api/.env.example apps/api/.env
pnpm --filter @afflix/api prisma:generate
pnpm --filter @afflix/api prisma:migrate
pnpm dev
```

No Windows PowerShell: `Copy-Item apps/api/.env.example apps/api/.env`.

Frontend: http://localhost:5173. Backend: http://127.0.0.1:3000/api/v1/health.

```text
GET /api/v1/products/search?keyword=organizador%20de%20cozinha&minCommissionPercent=8
```

O modo mock é o padrão. Para testes reais, as credenciais (`SHOPEE_APP_ID`, `SHOPEE_APP_SECRET`) devem ser obtidas **legalmente** pela titular aprovada, configuradas no backend e testadas com o contrato disponível à sua conta. Não publicar `.env`.

## Escopo real do código fornecido

**Incluído:** cliente de assinatura SHA256, consulta GraphQL inicial a validar, adaptadores mock/real, filtros decimais, controller de pesquisa, tela React simples, schema Prisma, Docker Compose e testes de unidade iniciais.

**Ainda por implementar:** endpoints de importação e refresh, histórico operacional, links de afiliado persistidos, biblioteca de mídia funcional, central de publicações, analytics real, segurança de acesso remoto e homologação live. Consultar backlog.

## Avisos

- Mock não representa ofertas reais nem garante comissão.
- Repositório privado; propriedade intelectual entre sócios deve ser formalizada.
- Os comandos de build/test devem ser executados na máquina de desenvolvimento; este pacote não foi homologado com credenciais nem infraestrutura externa.
- Dependências de terceiros devem ser auditadas e versões travadas (`pnpm-lock.yaml`) após o primeiro install validado.

## Primeira PR revisada

- [Escopo e checklist PR 001](docs/PR-001-IMPLEMENTACAO.md)
- [Execução local no Windows e Claude Code](docs/EXECUCAO-LOCAL-E-CLAUDE-CODE.md)

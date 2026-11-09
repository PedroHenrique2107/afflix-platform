# Afflix

> **Plataforma de descoberta, gestão e distribuição de conteúdo para marketing de afiliados.**
>
> **Status:** planejamento concluído; implementação do MVP V1 ainda não validada. **Nome provisório.**

## Visão geral

O **Afflix** é uma plataforma própria para organizar a operação de marketing de afiliados: identificar produtos, analisar oportunidades de comissão, gerar links rastreáveis, relacionar vídeos aos produtos, preparar publicações e medir resultados comerciais. A operação começa com a **Shopee Brasil** e poderá incorporar outros marketplaces no futuro.

O desenvolvimento será incremental, começando com uma aplicação local, sem hospedagem paga e com **publicações manuais**. O objetivo inicial é validar conteúdo e conversões orgânicas antes de investir em automações e infraestrutura contínua.

**Importante:** o Afflix é um projeto independente, não é produto oficial da Shopee e não deve ser apresentado como afiliado institucional ou parceiro técnico autorizado sem confirmação formal.

## Estado atual do projeto

| Item | Estado |
| --- | --- |
| Repositório privado e documentação inicial | Disponíveis |
| Frontend React e backend NestJS no repositório | **Ainda não publicados/verificados** |
| Busca demonstrativa com dados simulados | Planejada para PR 001 |
| Integração real Shopee Affiliate Open API | **Acesso solicitado; aprovação pendente** |
| Banco de dados e migrações | Planejados |
| Publicações automáticas | Fora do escopo V1 |
| Testes, build e CI | Ainda não validados |

Este README descreve a **arquitetura-alvo e o plano de implementação**. Não interprete funcionalidades planejadas como funcionalidades já entregues.

## Objetivos do MVP V1

1. Pesquisar ofertas da Shopee por palavra-chave, inicialmente **`organizador de cozinha`**.
2. Aplicar filtros de comissão, começando por **8%**, além de preço e avaliação quando disponíveis.
3. Normalizar os dados retornados pelo provedor e apresentar resultados no dashboard.
4. Selecionar, importar e manter produtos em um catálogo próprio, sem duplicações.
5. Gerar links de afiliado rastreáveis, quando a API estiver autorizada.
6. Registrar alterações de preço e comissão, com data da consulta.
7. Organizar vídeos com origem e licença de uso documentadas.
8. Preparar legenda, material e checklist para publicação **manual**.
9. Registrar métricas e comissões, inicialmente por entrada manual ou importação autorizada.
10. Operar localmente, sem exigência de serviços pagos de hospedagem.

**Fora do escopo da primeira PR:** biblioteca de vídeos completa, edição avançada por IA, publicação automática, integração real sem credenciais, relatórios financeiros completos e multiusuário SaaS.

## Arquitetura proposta

```mermaid
flowchart TD
  U[Operador / navegador] --> W[React + TypeScript / Vite]
  W -->|REST / JSON| A[NestJS + TypeScript]
  A --> D[(PostgreSQL / Prisma)]
  A --> P[Interface de provedor de ofertas]
  P --> M[Mock Provider - desenvolvimento]
  P --> S[Shopee Affiliate GraphQL - após aprovação]
  A --> F[Arquivos locais / biblioteca de mídia]
  A --> L[Preparação de links e publicações manuais]
```

### Responsabilidades

| Camada | Tecnologia | Responsabilidade |
| --- | --- | --- |
| Interface | React, TypeScript, Vite | Catálogo, filtros, formulários, dashboards e acompanhamento |
| API | NestJS, TypeScript | Validação, regras comerciais, endpoints, tratamento de erros |
| Persistência | PostgreSQL, Prisma | Produtos, histórico, links, campanhas e futuras publicações |
| Integração | Cliente GraphQL isolado | Autenticação e consultas Shopee, sem expor segredos |
| Simulação | Mock Provider | Desenvolvimento sem credenciais externas |
| Mídia | Armazenamento local; FFmpeg posteriormente | Organização e processamento de arquivos |
| Testes | Jest, Supertest, Playwright | Regras, API e fluxos do usuário |
| Infraestrutura local | Docker Compose | Inicialização reproduzível do PostgreSQL |

### Monorepo: por que frontend e backend juntos?

O repositório é único para facilitar colaboração, versionamento de contratos e revisão por pull request. **Frontend e backend permanecem aplicações separadas** e poderão ser implantados independentemente no futuro. Não é necessário criar um repositório para cada serviço na V1.

### Estrutura-alvo

```text
afflix-platform/
├── apps/
│   ├── web/                       # React + Vite
│   │   └── src/
│   │       ├── pages/
│   │       ├── components/
│   │       ├── hooks/
│   │       └── services/
│   └── api/                       # NestJS
│       ├── src/
│       │   ├── modules/
│       │   │   ├── products/
│       │   │   ├── shopee/
│       │   │   ├── affiliate-links/
│       │   │   └── publications/  # Entrega posterior
│       │   └── common/
│       └── prisma/
├── packages/
│   └── shared/                    # Tipos e contratos comuns
├── docs/                          # Especificações e roadmap
├── .github/workflows/             # CI, quando implementado
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

> **Nota:** a árvore acima é uma proposta de organização. Os diretórios de código ainda precisam ser adicionados ao repositório.

## Fluxo de funcionamento

1. O operador informa a palavra-chave e os filtros no dashboard.
2. O frontend envia uma solicitação REST ao backend.
3. O backend consulta o **Mock Provider** ou a **Shopee Affiliate Open API**, conforme a configuração.
4. O resultado é validado e normalizado; comissões são tratadas como valores decimais para evitar erros de precisão.
5. A interface apresenta os produtos elegíveis e permite selecioná-los.
6. Os produtos escolhidos são persistidos com identificação externa única e data da coleta.
7. Quando permitido pela API, o sistema gera o link rastreável com identificadores de campanha.
8. O operador associa material de vídeo licenciado, prepara a legenda e publica manualmente nas redes sociais.
9. O desempenho é registrado para comparar conteúdo, canais, cliques e comissões.

### Critérios comerciais iniciais

- Palavra-chave padrão: **organizador de cozinha**.
- Comissão mínima: **8%**.
- A taxa deverá ser normalizada antes de comparar: `0.08` equivale a `8%` **somente quando esse for o formato documentado pela API**.
- Preços e comissões são informações temporais, não garantias de venda ou pagamento.
- Produtos sem informações necessárias para determinado filtro não devem ser classificados como aprovados por padrão.
- Deduplicação por identificadores estáveis da Shopee, como `shopId + itemId`, sujeitos ao contrato efetivo da API.

## Integração Shopee

A integração será feita pela **Shopee Affiliate Open API**, distinta das APIs destinadas à gestão de lojas/vendedores. O programa de afiliados já está ativo na conta titular do negócio, mas **o acesso à Open API foi solicitado e está pendente**.

### Pré-requisitos externos

- Conta do Programa de Afiliados aprovada e regular.
- Permissão específica para uso da Affiliate Open API.
- `App ID` e `Secret` disponibilizados no portal.
- Confirmação das operações e dos campos disponíveis para a conta.
- Respeito aos limites de uso, termos do programa e regras de divulgação.

### Segurança das credenciais

- O **Secret nunca vai para o React** ou para o navegador.
- Guardar credenciais apenas em variáveis de ambiente no backend.
- Não publicar `.env`, chaves, tokens, dados pessoais ou arquivos de configuração sensíveis.
- Nunca registrar o Secret nos logs.
- Assinar requisições exatamente conforme a especificação vigente da API, usando os mesmos bytes enviados no corpo HTTP.
- Tratar erros GraphQL, falhas HTTP, timeout e limites de taxa.
- O acesso a produtos **não** implica permissão para publicar automaticamente na Shopee Video.

### Modos de operação

| Modo | Descrição |
| --- | --- |
| `mock` | Dados fictícios controlados para desenvolvimento e testes |
| `real` | Consultas autenticadas à Shopee, apenas após aprovação e homologação |

Não utilizar scraping ou automação não autorizada como substituto automático para uma API indisponível.

## API REST planejada

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/api/v1/products/search` | Pesquisa de ofertas com filtros |
| GET | `/api/v1/products` | Lista de produtos salvos |
| GET | `/api/v1/products/:id` | Detalhe de produto |
| POST | `/api/v1/products/import` | Importação selecionada |
| POST | `/api/v1/products/:id/refresh` | Atualização de oferta |
| GET | `/api/v1/products/:id/history` | Histórico de preço/comissão |
| POST | `/api/v1/affiliate-links` | Geração de link rastreável |
| GET | `/api/v1/integrations/shopee/status` | Estado de configuração da integração |

**Exemplo de contrato planejado:**

```http
GET /api/v1/products/search?keyword=organizador%20de%20cozinha&minCommission=8&page=1&limit=20
```

Os endpoints serão implementados e validados progressivamente; sua presença nesta tabela não indica disponibilidade imediata.

## Modelo de dados inicial

- **Product:** identificação externa, loja, título, URLs, preço, comissão, avaliação, status e última sincronização.
- **PriceHistory:** produto, preço, comissão e instante da coleta.
- **AffiliateLink:** produto, canal, campanha, link gerado e identificadores de rastreamento.

Tabelas futuras: **VideoAsset**, **Publication**, **Campaign**, **Conversion**, **User** e **Workspace**. Dados financeiros devem distinguir comissões estimadas, pendentes e efetivamente validadas.

## Requisitos para executar localmente

### Ferramentas

- Windows 10/11, macOS ou Linux.
- Git e VS Code (ou editor equivalente).
- Node.js em versão LTS compatível com o scaffold adotado.
- `pnpm` via Corepack, na versão definida pelo `packageManager` do projeto.
- Docker Desktop ou Docker Engine com Compose para PostgreSQL.
- Claude Code **opcional**, com acesso/licença conforme o plano utilizado.
- Espaço em disco suficiente para banco e vídeos locais.

### Configuração planejada

Quando o scaffold for publicado, o procedimento será:

```bash
# Dentro da raiz do repositório
corepack enable
pnpm install

# Criar o arquivo local de ambiente da API
# PowerShell: Copy-Item .env.example .env
# bash: cp .env.example .env

docker compose up -d
pnpm --filter @afflix/api prisma:generate
pnpm --filter @afflix/api prisma:migrate
pnpm test
pnpm build
pnpm dev
```

**Atenção:** estes comandos são o **contrato operacional pretendido**, e ainda não são executáveis no repositório atual, que contém apenas documentação. Antes de utilizá-los, a PR 001 deverá adicionar `package.json`, workspace, aplicações e scripts correspondentes. A migração Prisma pode exigir comando interativo, conforme o script configurado.

### Variáveis de ambiente previstas

```dotenv
DATABASE_URL=postgresql://afflix:afflix@localhost:5432/afflix
PORT=3000
SHOPEE_MOCK_MODE=true
SHOPEE_API_URL=https://open-api.affiliate.shopee.com.br/graphql
SHOPEE_APP_ID=
SHOPEE_APP_SECRET=
```

Esses valores são **exemplos para desenvolvimento**. A URL e a autenticação precisam ser confrontadas com a documentação atual da Shopee antes da homologação. Nunca faça commit de `.env` real.

### Endereços locais previstos

- Interface: `http://localhost:5173`
- API: `http://localhost:3000`
- Banco PostgreSQL: acesso interno configurado pelo Docker Compose

## Qualidade e testes

A primeira PR deverá executar, com resultados registrados:

- Instalação determinística via `pnpm-lock.yaml`.
- Geração do Prisma Client e migrações em banco local.
- Testes unitários de filtros, precisão de comissão, normalização e deduplicação.
- Testes do cliente Shopee com mocks para assinatura, timeout e erros HTTP/GraphQL.
- Testes de integração REST e persistência.
- Build do backend e do frontend.
- Verificação manual da busca por `organizador de cozinha` e comissão mínima de 8%.
- Auditoria para garantir ausência de credenciais e dados pessoais no Git.

A integração real com a Shopee deverá ter testes próprios após a liberação da API, sem tornar o pipeline de CI dependente de credenciais reais.

## Roadmap

| Versão | Objetivo | Dependências |
| --- | --- | --- |
| **V1 — MVP local** | Descoberta de produtos, catálogo, links, biblioteca inicial, publicação manual e métricas | Scaffold, banco, acesso à API para dados reais |
| **V2 — Automação parcial** | Agendamento, processamento de mídia, integrações de publicação permitidas | V1 validada, permissões das plataformas |
| **V3 — Operação em nuvem** | Execução contínua, observabilidade, backup, storage e segurança remota | Viabilidade comercial e orçamento |
| **V4 — SaaS** | Multiusuário, multiempresa, permissões e cobrança | Demanda comprovada e requisitos legais |
| **V5 — IA e marketplaces** | Seleção otimizada, experimentos e integrações adicionais | Dados históricos e autorizações |

### Sequência sugerida de PRs

| PR | Escopo |
| --- | --- |
| 001 | Monorepo, React, NestJS, PostgreSQL, Prisma, busca mock e CI inicial |
| 002 | Importação, catálogo persistido e histórico |
| 003 | Integração real Shopee, após credenciais e validação do contrato |
| 004 | Links rastreáveis e campanhas |
| 005 | Biblioteca de vídeos e direitos de uso |
| 006 | Preparação e checklist de publicação manual |
| 007 | Métricas e dashboard comercial |

## Estratégia de crescimento

A aquisição inicial será **orgânica**, com vídeos curtos e conteúdo original ou licenciado para uso comercial. Não haverá investimento obrigatório em anúncios ou hospedagem durante a validação local. A decisão de migrar para nuvem será tomada quando a operação exigir disponibilidade contínua, acesso remoto ou capacidade adicional, considerando custos e receita efetiva.

O desempenho será medido por publicações, alcance, cliques, conversões, comissões aprovadas e custo operacional. Visualizações isoladas não demonstram rentabilidade.

## Governança e colaboração

- Repositório **privado** na fase inicial.
- `main` como branch estável; novas funcionalidades em branches `feat/*`.
- Pull requests pequenas, com descrição, evidências e testes.
- Claude Code pode auxiliar no desenvolvimento, mas alterações devem ser revisadas e testadas.
- Nenhuma alteração destrutiva de banco, publicação automática ou exposição de segredo sem autorização explícita.
- Documentação e status devem ser atualizados em cada entrega.

## Documentação do projeto

Os documentos abaixo já foram publicados na raiz do repositório e serão reorganizados em `docs/` quando a estrutura inicial for consolidada:

- [Planejamento MVP V1](01-MVP-V1-PLANEJAMENTO.md)
- [Arquitetura detalhada](02-ARQUITETURA-DETALHADA.md)
- [Integração Shopee](05-INTEGRACAO-SHOPEE-IMPLEMENTACAO.md)
- [Backlog](07-BACKLOG-ENTREGAS.md)
- [Guia Claude Code](09-GUIA-CLAUDE-CODE.md)
- [Execução local](EXECUCAO-LOCAL-E-CLAUDE-CODE.md)
- [Escopo da PR 001](PR-001-IMPLEMENTACAO.md)
- [Roadmap V2](V2-AUTOMACAO-PARCIAL.md)
- [Roadmap V3](V3-OPERACAO-NUVEM.md)
- [Roadmap V4](V4-SAAS.md)
- [Roadmap V5](V5-OTIMIZACAO-IA-E-MARKETPLACES.md)

## Próximos passos imediatos

1. Publicar este README e manter a documentação existente.
2. Criar a branch `feat/mvp-v1-product-discovery` a partir de `main`.
3. Adicionar o scaffold executável de React, NestJS, Prisma, PostgreSQL e Docker Compose.
4. Implementar o Mock Provider, busca e filtros com testes.
5. Executar `pnpm install`, migrations, testes e build localmente.
6. Abrir a PR 001 com evidências e pendências explícitas.
7. Integrar a Shopee real somente após autorização da Open API.

---

**Afflix** — tecnologia própria para uma operação de afiliados orientada a dados, validação comercial e evolução incremental.
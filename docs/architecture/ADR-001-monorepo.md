# ADR-001 — Monorepo TypeScript

**Status:** aceito para V1.

## Decisão
Um repositório privado com `apps/web` (React + Vite), `apps/api` (NestJS), `packages/shared` (tipos/validações), `infra` e `docs`. Backend e frontend têm builds, testes e implantações independentes.

## Alternativas
- Dois repositórios: melhor isolamento organizacional, mas maior custo de sincronização de contratos e PRs para equipe pequena.
- Python + React: forte para ML, mas aumenta linguagens e ferramentas para um sistema majoritariamente de API.
- C# + React: robusto, mas maior custo de contexto inicial sem vantagem determinante neste MVP.
- n8n como núcleo: rápido para automações simples, porém lógica comercial complexa e SaaS podem exigir maior controle e atenção à licença.

## Evolução
Extrair worker ou serviços só após medição de gargalos; introduzir Redis/BullMQ quando houver filas reais; frontend/backend podem ser hospedados separadamente sem mudar o monorepo.

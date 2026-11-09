# Afflix Platform — contexto para Claude Code

Este arquivo não é versionado (está no `.gitignore`). Serve para registrar regras e contexto locais deste repositório.

## Pesquisa e planejamento
- Para qualquer pesquisa, planejamento ou implementação neste repositório, usar as ferramentas do **graphify** (MCP) sempre que disponíveis, em vez de depender só de grep/leitura manual de arquivos.
- Repositório indexado no graphify: `PedroHenrique2107/afflix-platform` (repository_id: `e2e1faf1-72ae-41a5-b414-e23cb0acc80b`).

## Regras obrigatórias do projeto (vindas do usuário)
- Manter frontend e backend separados dentro do mesmo monorepo.
- Não utilizar credenciais reais da Shopee.
- Não contratar nem configurar hospedagem paga.
- Não implementar funcionalidades fora do escopo da PR em andamento sem autorização.
- Não utilizar scraping.
- Não armazenar segredos no Git.
- Não alterar a branch `main` diretamente.
- Não executar push ou merge sem autorização explícita do usuário.
- Não declarar testes como aprovados sem executá-los de fato.

## README
- `README.md` é o README padrão/atual do projeto (contém status real, tabela de estado, visão geral).
- `README copy.md` é um rascunho antigo/planejamento inicial — não é o padrão. Avaliar remoção ou consolidação futura.

## Validação local (estado em 08/11/2026)
- `pnpm install`, `prisma:generate`, `pnpm test` (13/13) e `pnpm build` (api + web) validados OK.
- `docker compose up -d` / `prisma:migrate` ainda pendentes — ambiente sem Docker instalado (usuário está instalando Docker Desktop).
- Ver `STATUS.md` para o estado mais recente.

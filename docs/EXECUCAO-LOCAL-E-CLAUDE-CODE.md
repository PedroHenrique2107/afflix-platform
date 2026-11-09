# Execução local e Claude Code — Windows PowerShell

## Pré-requisitos
- Git; Node.js 22 LTS; Corepack/pnpm 10.18.0; Docker Desktop com engine ativa; Claude Code instalado e autenticado, se desejar assistência.
- Docker Desktop requer virtualização/WSL2 conforme configuração do Windows.
- Não é necessário Railway nem API Shopee aprovada para testar o modo mock.

## Primeira execução
```powershell
cd C:\dev\GitHub\afflix-platform
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
# Confirme SHOPEE_MOCK_MODE=true
docker compose up -d
pnpm --filter @afflix/api prisma:generate
pnpm --filter @afflix/api prisma:migrate
pnpm test
pnpm build
pnpm dev
```

> `pnpm-lock.yaml` deve ser incluído no commit após o primeiro `pnpm install` bem-sucedido. No CI, substituir `--no-frozen-lockfile` por `--frozen-lockfile` depois de gerar o lockfile.

## Endereços
- React: http://localhost:5173
- Saúde: http://127.0.0.1:3000/api/v1/health
- Pesquisa: http://127.0.0.1:3000/api/v1/products/search?keyword=organizador%20de%20cozinha&minCommissionPercent=8

## Comandos úteis
```powershell
pnpm test
pnpm build
docker compose ps
docker compose logs postgres --tail 50
pnpm --filter @afflix/api prisma:studio
```

## Git e primeira PR
Crie `afflix-platform` como repositório **privado** em https://github.com/new, sem README inicial. Na pasta extraída:
```powershell
git init -b main
git add README.md
git commit -m "docs: initialize Afflix repository"
git remote add origin https://github.com/PedroHenrique2107/afflix-platform.git
git push -u origin main
git switch -c feat/mvp-v1-product-discovery
# Adicione o scaffold e as correções revisadas à branch de feature
git add .
git commit -m "feat(discovery): implement mock offer search"
git push -u origin feat/mvp-v1-product-discovery
```
Abra a PR em GitHub → Pull requests → New pull request, base `main`, compare `feat/mvp-v1-product-discovery`.

**Importante:** o commit inicial contém apenas README. A branch de feature contém o restante do scaffold e das correções, criando um diff real para a PR. Antes de abrir a PR, execute os testes e inclua o `pnpm-lock.yaml` gerado.

## Prompt para Claude Code
```text
Atue como engenheiro sênior TypeScript/NestJS/React. Leia README.md, STATUS.md,
docs/PR-001-IMPLEMENTACAO.md e docs/05-INTEGRACAO-SHOPEE-IMPLEMENTACAO.md.
Objetivo: preparar a primeira PR do Afflix, com busca mock de ofertas,
filtro de comissão >= 8%, validação DTO, testes e build reproduzíveis.
Não implemente recursos fora da PR, não invente respostas reais da Shopee,
não exponha segredos, não modifique o roadmap sem justificar.
Primeiro execute install, prisma generate, testes e build; relate erros exatos.
Corrija falhas, crie testes de regressão e atualize STATUS.md.
Peça confirmação antes de executar migrations destrutivas ou comandos Git remotos.
```

## Problemas comuns
- `git não é reconhecido`: instalar Git for Windows e reabrir terminal.
- `pnpm não é reconhecido`: executar Corepack ou instalar pnpm compatível.
- Docker indisponível: abrir Docker Desktop e verificar `docker compose ps`.
- Porta 5432 ocupada: alterar mapeamento local e DATABASE_URL conjuntamente.
- HTTP 502 Shopee: manter mock; não inserir credenciais fictícias.

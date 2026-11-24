# Backup e restauração do PostgreSQL local

Atende ao RNF08 (backup local) e ao item S4 do backlog (recuperação demonstrada).

O banco roda no Docker Compose, no volume `pgdata`. **Volume não é backup:** um
`docker compose down -v`, um reset do Docker Desktop ou a troca de máquina apagam
tudo. A rede de proteção é um dump lógico (`pg_dump`) guardado fora do volume.

## Onde o dump fica

- Pasta local: `data/backups/`. O `.gitignore` já ignora `data/`, `*.dump` e
  `*.sql`, então **nenhum dump entra no Git**. Confira com
  `git check-ignore -v data/backups/<arquivo>.dump` antes de qualquer commit.
- Formato: custom (`-Fc`). É comprimido, e o `pg_restore` consegue listar e
  restaurar o conteúdo dele.
- `data/backups/` continua na mesma máquina. Para sobreviver a uma perda do
  disco, copie o arquivo para outro lugar (HD externo, pasta sincronizada).
  O dump contém os dados do catálogo e os links de afiliado, então trate-o como
  dado privado.

## Pré-requisitos

- Docker Desktop rodando e o Postgres de pé: `docker compose up -d --wait`.
- Comandos executados na **raiz do repositório**.
- `pg_dump` e `pg_restore` rodam **dentro do container**, então não é preciso
  instalar o Postgres no Windows.

## Fazer o backup (PowerShell)

```powershell
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$arquivo = "data/backups/afflix-$ts.dump"
New-Item -ItemType Directory -Force data/backups | Out-Null
docker compose exec -T postgres pg_dump -U afflix -d afflix -Fc -f /tmp/afflix.dump
docker compose cp postgres:/tmp/afflix.dump $arquivo
docker compose exec -T postgres rm /tmp/afflix.dump
Get-Item $arquivo
```

O dump é gravado **dentro do container** e depois copiado com `docker compose cp`.
Não use `docker compose exec ... pg_dump > arquivo` no PowerShell 5.1, porque o
`>` grava em UTF-16 e corrompe o arquivo binário (veja "Armadilhas").

### Conferir o dump

Um dump que não foi lido não é backup. Confira se o `pg_restore` consegue ler o
arquivo e se todas as tabelas estão lá:

```powershell
docker compose cp $arquivo postgres:/tmp/verifica.dump
docker compose exec -T postgres pg_restore -l /tmp/verifica.dump
docker compose exec -T postgres rm /tmp/verifica.dump
```

A lista precisa ter uma linha `TABLE DATA` para cada tabela do
`apps/api/prisma/schema.prisma` e para `_prisma_migrations`.

## Restaurar

A restauração **substitui** o conteúdo atual do banco `afflix` pelo conteúdo do
dump. Antes de restaurar:

1. Pare a API (`pnpm dev`), para que nenhuma conexão escreva no banco durante o
   processo.
2. Se o banco atual tiver algo que você queira guardar, faça um backup dele antes.

```powershell
$arquivo = 'data/backups/afflix-AAAAMMDD-HHMMSS.dump'   # o dump escolhido
docker compose up -d --wait
docker compose cp $arquivo postgres:/tmp/restore.dump
docker compose exec -T postgres pg_restore -U afflix -d afflix --clean --if-exists --no-owner --single-transaction --exit-on-error /tmp/restore.dump
"pg_restore exit: $LASTEXITCODE"
docker compose exec -T postgres rm /tmp/restore.dump
```

- `--clean --if-exists`: remove os objetos existentes antes de recriá-los. O mesmo
  comando serve para um banco recém-criado (depois de um `down -v`) e para um
  banco com dados.
- `--single-transaction --exit-on-error`: tudo ou nada. Se algo falhar, o banco
  fica como estava antes do restore.
- `--no-owner`: não tenta reaplicar o dono dos objetos.

`pg_restore exit: 0` significa sucesso. Qualquer outro valor significa que nada
foi aplicado: leia a mensagem de erro antes de tentar de novo.

### Recuperação depois de um `down -v`

```powershell
docker compose down -v
docker compose up -d --wait
# em seguida, o bloco "Restaurar" acima
```

Não rode `prisma:migrate` antes do restore: o dump já traz o schema e a tabela
`_prisma_migrations`.

## Verificar a restauração

### 1. Impressão digital dos dados

Gere a contagem e o hash do conteúdo de cada tabela **antes do backup** e
**depois do restore**, e compare. Os dois resultados precisam ser iguais linha a
linha. Se o schema ganhar uma tabela nova, inclua uma linha para ela nesta
consulta.

```powershell
$q = @'
SELECT 'Product' AS tabela, count(*) AS linhas, md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS hash FROM "Product" t
UNION ALL SELECT 'PriceSnapshot', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM "PriceSnapshot" t
UNION ALL SELECT 'AffiliateLink', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM "AffiliateLink" t
UNION ALL SELECT 'MediaAsset', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM "MediaAsset" t
UNION ALL SELECT 'Publication', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM "Publication" t
UNION ALL SELECT 'PublicationMetric', count(*), md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM "PublicationMetric" t
UNION ALL SELECT '_prisma_migrations', count(*), md5(coalesce(string_agg(t.migration_name || t.checksum, '|' ORDER BY t.migration_name), '')) FROM _prisma_migrations t;
'@
$q | docker compose exec -T postgres psql -U afflix -d afflix
```

O `'@` que fecha o here-string precisa ficar na coluna 0, sem espaço antes.

### 2. Migrations e schema

Confira se o banco bate com as migrations do repositório. O Prisma precisa
receber o `.env` da raiz, como nos scripts `prisma:*` da api, por isso o
`pnpm exec prisma` puro não funciona aqui:

```powershell
Push-Location apps/api
node --env-file-if-exists=../../.env ./node_modules/prisma/build/index.js migrate status
Pop-Location
```

O resultado esperado é `Database schema is up to date!`.

## Armadilhas (PowerShell 5.1 + Docker)

| Armadilha | O que acontece | O que fazer |
|---|---|---|
| `pg_dump ... > arquivo` | O `>` do PowerShell 5.1 grava em UTF-16 e corrompe o dump binário | `pg_dump -f` dentro do container + `docker compose cp` |
| SQL com aspas duplas em `psql -c "..."` | O PowerShell 5.1 remove as aspas internas ao chamar um executável nativo, e `"Product"` vira `Product` (`relation "product" does not exist`) | Mandar o SQL pela entrada padrão: `$q \| docker compose exec -T postgres psql ...` |
| Esquecer o `-T` no `exec` | Sem TTY, a entrada e a saída redirecionadas não funcionam | Usar sempre `docker compose exec -T` em comandos com redirecionamento |
| `pnpm --filter @afflix/api exec prisma ...` | `Command "prisma" not found`, e o Prisma não leria o `.env` da raiz | `node --env-file-if-exists=../../.env ./node_modules/prisma/build/index.js` dentro de `apps/api` |
| Versão do Postgres | O `pg_restore` não lê dump de uma versão **mais nova** do servidor | Restaurar em versão igual ou mais nova que a do dump (hoje `postgres:17-alpine`) |

## Evidência: restauração executada em 23/11/2026

Cenário real de desastre, executado com os comandos deste documento, no
PowerShell 5.1 + Docker Desktop (Windows 11), `postgres:17-alpine` (17.11):

1. Impressão digital do banco `afflix` antes do backup.
2. Backup: `afflix-20261123-223751.dump`, 18.651 bytes, formato custom.
   `pg_restore -l` leu o arquivo com as 7 tabelas. O sha256 da cópia no host
   (`abda4be5…29bf0e`) bate com o do arquivo lido dentro do container.
   `git check-ignore` confirmou que o arquivo é ignorado (regra `data/`).
3. `docker compose down -v`: volume `afflix-platform_pgdata` removido. O banco
   novo subiu com **0 tabelas** no schema `public`.
4. Restore com `pg_restore ... --single-transaction --exit-on-error`:
   `pg_restore exit: 0`.
5. Impressão digital depois do restore, **idêntica** à de antes:

| Tabela | Linhas | Hash (antes = depois) |
|---|---:|---|
| Product | 4 | `910b711555dfc64ffdf9fe24d2355fe6` |
| PriceSnapshot | 4 | `8a0adbbb436a0fda2d0d11fbddc2da43` |
| AffiliateLink | 4 | `ff7693237da44dabd716d16e272227d6` |
| MediaAsset | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| Publication | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| PublicationMetric | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| _prisma_migrations | 4 | `0521bbf801017f5b57121b7164a38075` |

6. `prisma migrate status`: `4 migrations found` / `Database schema is up to date!`.
7. `prisma migrate diff` do banco restaurado contra o `schema.prisma`:
   `No difference detected.` Índices, constraints e FKs voltaram iguais.
8. Os blocos PowerShell deste documento foram extraídos do próprio arquivo e
   executados sem alteração (só o nome do dump de exemplo foi trocado): backup
   novo, conferência (`pg_restore -l` com 43 entradas, incluindo índices e FKs),
   restore **sobre o banco já populado** (`--clean`, `exit 0`), impressão digital
   igual à da tabela acima e `migrate status` em dia.

## Fora deste procedimento

- **Mídia** (`data/media`): os vídeos não estão no banco. O backup deles é uma
  cópia de pasta, ainda não documentada aqui.
- Agendamento automático do backup, retenção de versões antigas e criptografia
  do arquivo.
- Cópia para fora da máquina: é manual, como descrito em "Onde o dump fica".

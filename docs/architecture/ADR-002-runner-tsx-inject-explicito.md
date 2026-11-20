# ADR-002 — Runner da API: manter `tsx` com `@Inject` explícito verificado por teste

**Status:** aceito (SW-29, 20/11/2026).

## Contexto
`apps/api` roda em dev com `tsx watch` (esbuild), os testes rodam no `vitest` (também esbuild) e o build de produção usa `tsc` (`node dist/main.js`).

O esbuild não implementa `emitDecoratorMetadata`. Sem a metadata `design:paramtypes`, o NestJS não descobre o tipo dos parâmetros do construtor e **injeta `undefined` sem erro**. Reproduzido na SW-29 com um provider `constructor(readonly dep: Dep)` sem `@Inject`:

| Execução | `design:paramtypes` | Resultado |
| --- | --- | --- |
| `tsx` | `undefined` | app sobe; `dep` é `undefined`; quebra só na primeira chamada (`Cannot read properties of undefined`) |
| `tsc` + `node` | `[Dep]` | injeta normalmente |

Hoje os 12 construtores com DI da API já usam `@Inject(Token)`, mas nada impedia um provider novo de esquecer. Os testes unitários não pegavam porque instanciam as classes na mão. O MVP ainda vai ganhar vários módulos com DI, então a decisão precisava vir antes.

## Alternativas avaliadas

| Critério | `tsx` (atual) | `ts-node` | `nest start` (`@nestjs/cli`) |
| --- | --- | --- | --- |
| Decorator metadata no dev | não | sim (compilador do TypeScript) | sim (`tsc`, ou SWC com `decoratorMetadata`) |
| Subida e reload no dev | rápido (sem checagem de tipos) | lento; `--transpile-only` ajuda, mas ainda é mais pesado | mais lento: compila o projeto antes de subir |
| Dependências novas | nenhuma | `ts-node` | `@nestjs/cli` + `nest-cli.json` (SWC: `@swc/cli`, `@swc/core`) |
| Atrito conhecido | nenhum hoje | manutenção lenta; atrito com Node 22/ESM | nenhum relevante |
| Resolve o `vitest`? | não | **não** | **não** |
| Scripts (`shopee:homologar`) | já usa `tsx` | trocar também | continuariam em `tsx` |

O ponto que decide: **trocar o runner de dev não muda o `vitest`**. Testes que sobem o Nest de verdade (como o HTTP do `DiscoveryController`, SW-28) continuariam sem metadata. Então ou o `@Inject` continua obrigatório nos testes, ou entra mais uma camada (`unplugin-swc` + `@swc/core`) só para o vitest. Com `nest start` ou `ts-node`, dev e testes passariam a se comportar de jeitos diferentes: um provider sem `@Inject` funcionaria no dev e falharia no teste, ou o contrário.

## Decisão
1. Manter `tsx` como runner de dev e de scripts.
2. **Toda injeção por construtor declara o token com `@Inject(Token)`**, inclusive quando o token é a própria classe. Em `useFactory`, o `inject` lista todos os parâmetros da factory.
3. A regra é verificada por teste: `apps/api/src/modules/app.module.di.spec.ts` percorre a árvore de módulos a partir do `AppModule` (só metadata: não instancia nada, não abre banco) e falha, apontando módulo, classe e posição do parâmetro, se:
   - um controller, provider de classe ou `useClass` tiver parâmetro de construtor sem `@Inject`;
   - um `useFactory` receber mais parâmetros do que o seu `inject` lista.

   O teste roda no `pnpm test`, então quebra a CI.

## Consequências
- Positivas: dev, testes e scripts têm o mesmo comportamento de DI; nenhuma dependência nova; o erro aparece no teste, com o nome da classe, em vez de `undefined` em runtime.
- Negativas: `@Inject` é verboso; o `tsx` continua sem checagem de tipos no dev (o `tsc` do `pnpm build` cobre isso).
- Limites do teste: ele só enxerga o que está no grafo do `AppModule`. Um módulo que não for importado nele fica de fora (mas também não sobe na API). Módulos dinâmicos de terceiros (ex.: `MulterModule`) são ignorados, porque vêm compilados com `tsc` e já trazem metadata. Parâmetros com valor padrão não contam como injeção (`Function.length`).
- A `ValidationPipe` global também depende de metadata para descobrir o DTO. Por isso os controllers validam com `parseDto` explícito, a mesma família de problema já tratada na SW-28.

## Quando revisitar
Se a API passar a usar ESM nativo, se o `tsx`/esbuild ganhar suporte a decorator metadata, ou se o `vitest` for configurado com um transformador que emita metadata (SWC). Nesses casos, reavaliar se o `@Inject` explícito ainda é necessário.

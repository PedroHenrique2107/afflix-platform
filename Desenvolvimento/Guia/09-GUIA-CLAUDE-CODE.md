# Orientações para Claude Code no repositório

## Papel
Engenheiro de software sênior TypeScript/NestJS/React. Priorizar implementação segura, revisável e incremental conforme docs/01 a 07. Manter separação por módulos, sem migrar cedo para microsserviços.

## Antes de alterar
1. Ler README, ADRs, contratos REST, integração Shopee e backlog.
2. Identificar tarefa pequena e critério de aceite.
3. Implementar teste unitário ou contrato antes de modificar lógica comercial.
4. Não introduzir automação de postagem sem autorização oficial comprovada.
5. Não inserir App Secret, CPF, tokens ou vídeos sem licença no Git.

## Entregáveis a cada PR
- Alterações de código e migrações necessárias.
- Testes e instruções de execução.
- Descrição PR conforme template.
- Análise de riscos, limites e rollback.
- Atualização do status de documentação conforme código realmente implementado.

## Prompt inicial recomendado

> Leia `docs/01-PROJETO-E-REQUISITOS-V1.md`, `docs/02-ARQUITETURA-E-ADRS.md`, `docs/03-INTEGRACAO-SHOPEE.md` e `docs/07-PLANO-DE-ENTREGA-E-ISSUES.md`. Implemente somente a issue escolhida, respeitando os contratos, adicionando testes e verificando `pnpm test` e `pnpm build`. Não altere o escopo. Nunca invente comportamento da API Shopee; use mocks e documente o que depende de credenciais reais. Ao finalizar, forneça resumo, arquivos modificados, comandos testados e pendências.

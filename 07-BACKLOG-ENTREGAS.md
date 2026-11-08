# Backlog V1 — Entregas e critérios de aceite

| Sprint | Tarefa | Condição para concluir |
|---|---|---|
| S0 | Boot monorepo e CI | `pnpm install`, `pnpm dev`, build/test local sem erro |
| S1 | Provider mock + busca | React apresenta ofertas simuladas claramente sinalizadas |
| S1 | Filtro 8% | Decimal exato e casos de borda testados |
| S1 | Shopee GraphQL | Consulta live documentada e permissões homologadas |
| S2 | Prisma migrations | Banco nasce limpo e migra; chaves únicas verificadas |
| S2 | Importação/upsert | Produto reimportado não duplica e gera snapshot correto |
| S2 | Affiliate links | Origem verificada, `subIds`, atribuição confirmada |
| S3 | Biblioteca de vídeos | Licença, origem e hash associados ao asset |
| S3 | Publicação manual | Rascunho→exportação→publicado com URL e data |
| S3 | Métricas e analytics | manual vs relatório oficial separados |
| S4 | Segurança e backup | Sem secrets no Git, recuperação demonstrada |
| S4 | Experimento orgânico | 10 produtos / 30 criativos (meta, não promessa) |

**Status inicial:** as implementações de busca mock, filtros, assinatura e scaffold React/NestJS foram preparadas como base de código, não homologadas por pipeline real. As demais continuam no backlog.

## Definição de pronto

Código revisado, tipos compilando, testes passando, migração validada, documentação atualizada, zero secrets, evidência na PR e `rollback` descrito. Mudança de escopo requer decisão explícita registrada em ADR.

## Prazos

3–5 semanas de engenharia parcial para MVP completo conforme experiência e disponibilidade; aprovação externa Shopee é dependência imprevisível. Validar em pequenos incrementos antes de expandir.

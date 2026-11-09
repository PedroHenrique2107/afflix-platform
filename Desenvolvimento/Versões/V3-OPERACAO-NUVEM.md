# V3 — Operação contínua na nuvem

**Gatilho:** automações precisam rodar com computador desligado; acesso remoto seguro; receita ou ganho operacional justificam custo.

## Entregas
- Hospedagem separada web/API/worker; PostgreSQL gerenciado ou backup confiável.
- Storage de objetos para vídeos, CDN quando necessária.
- Redis/BullMQ para jobs; healthchecks, métricas, logs, alertas, backups e restauração testada.
- CI/CD com GitHub Actions; ambientes dev/staging/prod; secrets por ambiente.
- Autenticação de operadores, RBAC mínimo, HTTPS e auditoria.
- Rate limiting e quotas por integração; política de custos por job de mídia.

## Critérios
RTO/RPO definidos, orçamento máximo mensal, rollback testado, monitoramento de filas e erros, backup restaurável.

## Risco
Hospedagem de vídeo e transcodificação podem custar mais que API e banco; medir antes de contratar.

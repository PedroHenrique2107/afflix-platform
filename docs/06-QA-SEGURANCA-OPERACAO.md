# QA, segurança, configuração e operação

## Plano de testes

Unitários: filtro 8%; percentuais inválidos; assinatura SHA256; conversão Decimal; validação DTO; paginação.

Contratos: fixtures de resposta do GraphQL incluindo campos ausentes, erros parciais, rate-limit e timeouts.

Integração: Prisma+PostgreSQL, upsert por marketplace+shop+item, histórico, links por campanha, registros de publicação manual.

E2E: busca React→NestJS em mock, estados loading/erro/vazio, segurança contra divulgação de credenciais.

Live: smoke test controlado na conta da sócia, sem expor payload confidencial.

## Regras operacionais

- Dev bind em 127.0.0.1 (não abrir porta em rede pública).
- CORS para frontend local, `.env` ignorado; em nuvem exigir auth/TLS.
- Dados de terceiros sanitizados, sem interpolar HTML; evitar SSRF em short links e fetch externo.
- `429` e `5xx`: retry seletivo exponencial e limitado; mutation não deve duplicar link/post.
- Controle de quotas; um request GraphQL pode falhar com HTTP 200 e `errors`.
- Registro de vídeos deve conter licença e direitos comerciais; acesso a produtos da Shopee não concede direitos sobre vídeos de terceiros.
- Relatórios de comissão podem ter estados pendente/aprovado/rejeitado.

## Backup

Backups periódicos `pg_dump`; arquivos de mídia fora do Git, cópia independente da máquina, restauração de teste. Docker volume não substitui backup.

## Deploy e custo

V1 roda localmente; sem custo de hospedagem, mas há energia, armazenamento e possíveis licenças/API de IA. Só mover para cloud quando houver necessidade de disponibilidade contínua e orçamento sustentável.

## Gates para produção

QA automatizado, revisão de segurança, teste de restauração, evidência de aprovação API, limites de uso, política de privacidade/termos se acesso por terceiros, identidade visual sem conflito de marca e reconciliação real das comissões.

# V2 — Automação parcial de conteúdo

**Gatilho de início:** V1 em operação, métricas coletadas, fluxo manual estável e evidência inicial de demanda.

## Entregas
- Editor com presets de FFmpeg, legendas e exportação 9:16.
- Filas locais com BullMQ/Redis **se** volume justificar; antes disso, jobs simples controlados.
- Templates de copy e roteiros assistidos por IA com revisão humana.
- Agendamento e publicação automática **somente onde APIs e aprovações permitirem** (Telegram como candidato inicial; Instagram sujeito às regras da Meta).
- Logs de tentativas, estados `draft/ready/scheduled/published/failed` e reprocessamento idempotente.

## Não fazer
Não automatizar Shopee Video ou TikTok por engenharia reversa ou bypass de restrições. Não publicar mídia sem direitos.

## Aceite
Tempo médio por conteúdo reduzido, rastreabilidade de cada publicação, falhas recuperáveis, direitos de mídia documentados.

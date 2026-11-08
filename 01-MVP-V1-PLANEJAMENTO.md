# Planejamento detalhado — MVP V1

## 1. Resumo executivo
Construir uma ferramenta interna para duas pessoas identificarem ofertas da Shopee, analisarem comissões, salvarem oportunidades e prepararem conteúdo orgânico com **publicação manual**. O objetivo é validar demanda e comissões antes de assumir infraestrutura recorrente.

## 2. Hipóteses de negócio
- Vídeos originais ou com licença comercial adequada podem atrair audiência orgânica.
- Produtos de casa/cozinha com comissão anunciada >=8% podem ser testados; **comissão nominal não é margem líquida nem garantia de pagamento**.
- Seleção de ofertas e disciplina de publicação podem ser melhoradas com software próprio.
- Conversões e comissões atribuídas são indicadores mais importantes que visualizações.

## 3. Personas e papéis
- Operador de catálogo: pesquisa, seleciona, importa e atualiza produtos.
- Operador de conteúdo: prepara mídia, copy, CTA, link e publica manualmente.
- Administrador: gerencia credenciais e analisa resultados. Na V1 esses papéis podem ser exercidos pelos mesmos sócios, sem RBAC.

## 4. Escopo V1
**Incluído:** busca por termo, filtro de comissão mínima, consulta remota com mock alternativo, listagem, persistência de favoritos, histórico de preços/comissões, geração de links via integração autorizada, registro manual de publicações e métricas, catálogo de arquivos de vídeo com proveniência/licença, exportação de briefing/legenda e operação local.

**Não incluído:** publicação automática em Instagram/TikTok/Shopee Video, scraping, disparos massivos, contas de clientes, pagamentos, edição generativa de vídeos em escala, otimização por IA, infraestrutura 24x7.

## 5. Jornada principal
1. Abrir dashboard local.
2. Pesquisar `organizador de cozinha` com comissão mínima de 8%.
3. API consulta provedor mock ou Shopee autorizada.
4. Normalizar taxas, preços, moeda e identidade do item; filtrar.
5. Inspecionar detalhes e salvar produto (upsert por provedor+shopId+itemId).
6. Associar mídia licenciada e registrar direitos de uso.
7. Gerar link de afiliado rastreável somente quando necessário.
8. Exportar arquivo e legenda; publicar manualmente; marcar URL/canal/data.
9. Registrar métricas e vendas atribuídas conforme dados disponíveis.

## 6. Requisitos funcionais
RF01 Busca com keyword, paginação e estado vazio; RF02 comissão mínima 8% por padrão; RF03 filtros preço/avaliação somente quando disponíveis; RF04 normalização e deduplicação; RF05 favoritos e histórico; RF06 links com subIds e associação a campanha; RF07 modo mock; RF08 status de integração sem expor segredos; RF09 biblioteca de vídeos e prova de licença; RF10 checklist de publicação manual; RF11 relatórios de métricas com fonte e timestamp.

## 7. Requisitos não funcionais
RNF01 credenciais somente backend; RNF02 resposta sem PII; RNF03 timeout, rate limit e retries com backoff para falhas transitórias; RNF04 observabilidade sem registrar segredos; RNF05 migrações reproduzíveis; RNF06 testes determinísticos com fixtures; RNF07 compatibilidade Windows via Docker; RNF08 backup local; RNF09 execução sem custo de hospedagem; RNF10 arquitetura preparada para trocar storage e publishers.

## 8. Regras de negócio
- `commissionRate` armazenada em fração (0.08 = 8%); conversão validada com fixtures reais autorizadas.
- `price` em BRL decimal; não usar `float` para cálculos monetários críticos.
- Comissões variam e podem ser revogadas; exibir data da última sincronização.
- Não preencher resultados filtrados por meio de paginação enganosa; indicar origem e `hasNextPage` remoto.
- Não importar nem publicar mídia sem licença/consentimento apropriado.
- SubIds devem seguir limites e formatos permitidos pela Shopee.
- Evitar consulta em excesso e respeitar limites do programa.

## 9. Métricas de validação (metas de experimento, não previsão)
30 vídeos, até 90 publicações manuais em três canais, 10 produtos testados, registrar cliques e conversões atribuídas. Medir: publicações por semana, tempo de produção, CTR quando disponível, conversão, comissão validada, custo de produção, lucro operacional.

## 10. Critérios de pronto
Busca mock e real (após liberação), filtro 8% testado, deduplicação, migrações, tratamento de erros, link gerado em ambiente autorizado, testes unitários/integração, documentação de segurança e fluxo manual demonstrado. Itens dependentes de API ficam `blocked`, nunca considerados concluídos antes de teste real.

## 11. Dependências e riscos
Acesso à API Shopee sujeito a aprovação; schema/quotas podem mudar; limites de postagem em outras plataformas; direitos de mídia; regras de atribuição; dependência de audiência orgânica. Plano de contingência: modo mock e cadastro manual provisório.

## 12. Fases
Semana 1: fundação, banco, contratos e mocks. Semana 2: GraphQL, filtros, catálogo. Semana 3: links, histórico, mídia e publicações manuais. Semana 4: QA e operação piloto. Prazos são estimativas, não compromisso.

# Nome, marca, GitHub e propriedade do código

## Nomes candidatos

- **Afflix** (`afflix-platform`) — associação de afiliados e tecnologia; preferência provisória.
- **Comissio** (`comissio-platform`) — posicionamento em comissões.
- **OfferPilot** (`offerpilot`) — descoberta guiada de ofertas.
- **NexaFlow** (`nexaflow-platform`) — automação expansível.
- **Linkora** (`linkora-platform`) — links, campanhas e marketing.

Nenhum nome foi certificado como disponível. Verificar INPI, domínio, redes sociais e colisões antes de branding público. Evitar marca de terceiros no produto.

## Por que monorepo, não dois repositórios?

Os dois aplicativos têm deployments separados (`apps/web` e `apps/api`) mesmo dentro do mesmo Git. A V1 terá muitos PRs afetando DTOs, React e API simultaneamente; um monorepo evita dessincronização de contratos. Se a equipe crescer e serviços forem independentes, a separação futura é possível.

## Governança recomendada

Repositório inicialmente **Private**. Não adicionar licença open source automaticamente. Formalizar por escrito titularidade e divisão de propriedade intelectual entre os sócios, acesso à conta da titular do afiliado, receitas e responsabilidades.

Branches: `main`, `feat/*`, `fix/*`; Conventional Commits; PR e checks antes de merge; proteções de branch quando disponíveis. Backups e secrets nunca no Git.

## Passos para publicar

1. Criar repositório privado vazio via GitHub (`afflix-platform` ou o nome decidido).
2. Extrair ZIP em pasta local e revisar arquivos.
3. `git init -b main` e `git add . && git commit -m "chore: initial MVP architecture"`.
4. `git remote add origin https://github.com/SEU-USUARIO/afflix-platform.git`.
5. `git push -u origin main`.

A integração ChatGPT com GitHub permite inspecionar e modificar repositórios existentes, mas **não há ação de criação de repositório disponibilizada nesta sessão**. Não alegar criação sem execução efetiva.

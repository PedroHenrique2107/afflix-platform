# Publicação no GitHub

## Recomendações
- Criar **repositório privado** `afflix-platform` na conta ou organização escolhida pelos sócios.
- Preferir uma organização GitHub de propriedade conjunta se ambos forem administrar o negócio.
- Não subir `.env`, credenciais, vídeos sem licença ou dados financeiros pessoais.
- Proteger `main`; usar branches `feat/*`, PRs e revisões.

## Comandos
```bash
cd afflix-platform
git init
git add .
git commit -m "chore: initial architecture, roadmap and V1 scaffold"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/afflix-platform.git
git push -u origin main
```

Crie o repositório vazio no GitHub antes do `git push`. Se optar por organização, altere a URL. Verifique o conteúdo do commit antes de enviar.

# Segurança, privacidade e operação local

- Repositório privado. `.env` ignorado. Nunca registrar App Secret, token, cookie ou dados bancários.
- API e banco vinculados a localhost. Não expor portas do Docker na rede local indiscriminadamente.
- CORS apenas `http://localhost:5173` durante desenvolvimento.
- Usuário titular da conta de afiliados controla e autoriza uso das credenciais; documentar responsabilidades dos sócios.
- Backups periódicos do PostgreSQL e da mídia; testar restauração. Criptografar backups sensíveis.
- Vídeos: registrar origem, licença, titular, data e restrições de uso; evitar republicação não autorizada.
- Imagens/links externos tratados como dados não confiáveis; não executar HTML arbitrário.
- Validação de URL para impedir SSRF; limites de upload e MIME; antivírus opcional quando houver upload público.
- No acesso remoto: HTTPS, autenticação, autorização por recurso, rate limiting, sessões seguras e trilha de auditoria.
- Custos locais não são literalmente zero: energia, conexão, ferramentas opcionais e armazenamento.
- Política de retenção: remover dados pessoais desnecessários, não armazenar CPF da titular no banco de produtos.

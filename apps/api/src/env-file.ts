import { Logger } from '@nestjs/common';
import { config } from 'dotenv';

type Env = Record<string, string | undefined>;

export interface LoadEnvFileResult {
  /** Chaves do arquivo cujo valor efetivo veio da sessão do terminal, e não do arquivo. */
  divergentKeys: string[];
}

const logger = new Logger('LoadEnv');

/**
 * Carrega o .env em `env` sem sobrescrever o que já existe. A sessão continua vencendo
 * o arquivo (12-factor, e permite override como `PORT=3001`). O que muda é que a
 * divergência deixa de ser silenciosa: avisa no boot listando só os NOMES das chaves.
 * Valores nunca vão para o log, porque o .env tem segredos (SHOPEE_APP_SECRET, DATABASE_URL).
 */
export function loadEnvFile(
  path: string,
  env: Env = process.env,
  warn: (message: string) => void = (message) => logger.warn(message),
): LoadEnvFileResult {
  const { parsed } = config({ path, processEnv: env as Record<string, string>, quiet: true });
  if (!parsed) return { divergentKeys: [] };

  // Sem override, o dotenv só preenche chaves ausentes; se o valor efetivo difere do
  // arquivo, é porque a chave já estava exportada na sessão.
  const divergentKeys = Object.keys(parsed).filter((key) => env[key] !== parsed[key]);
  if (divergentKeys.length > 0) warn(divergenceMessage(divergentKeys));
  return { divergentKeys };
}

function divergenceMessage(keys: string[]): string {
  return (
    `Variáveis exportadas na sessão do terminal estão sobrepondo o .env: ${keys.join(', ')}. ` +
    'A sessão vence o arquivo. Para usar o valor do .env, remova-as da sessão ' +
    '(PowerShell: Remove-Item Env:NOME; bash: unset NOME) e reinicie a API. ' +
    'Ver docs/EXECUCAO-LOCAL-E-CLAUDE-CODE.md.'
  );
}

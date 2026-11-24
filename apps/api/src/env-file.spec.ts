import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnvFile } from './env-file';

// Usa um .env temporario e um objeto `env` falso: o process.env real do worker nao e tocado
// e o .env da raiz do repo nunca e lido.
describe('loadEnvFile', () => {
  let dir: string;
  let envPath: string;
  const writeEnv = (content: string) => writeFileSync(envPath, content);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'afflix-env-'));
    envPath = join(dir, '.env');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('avisa quando uma chave exportada na sessao diverge do arquivo', () => {
    writeEnv('SHOPEE_MOCK_MODE=false\nPORT=3000\n');
    const env: Record<string, string | undefined> = { SHOPEE_MOCK_MODE: 'true' };
    const warn = vi.fn();

    const { divergentKeys } = loadEnvFile(envPath, env, warn);

    expect(divergentKeys).toEqual(['SHOPEE_MOCK_MODE']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('SHOPEE_MOCK_MODE');
  });

  it('preserva a precedencia: a sessao continua vencendo e chaves ausentes vem do arquivo', () => {
    writeEnv('SHOPEE_MOCK_MODE=false\nPORT=3000\n');
    const env: Record<string, string | undefined> = { SHOPEE_MOCK_MODE: 'true' };

    loadEnvFile(envPath, env, vi.fn());

    expect(env).toEqual({ SHOPEE_MOCK_MODE: 'true', PORT: '3000' });
  });

  it('nao avisa quando sessao e arquivo coincidem', () => {
    writeEnv('SHOPEE_MOCK_MODE=true\n');
    const warn = vi.fn();

    const { divergentKeys } = loadEnvFile(envPath, { SHOPEE_MOCK_MODE: 'true' }, warn);

    expect(divergentKeys).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('nao avisa quando a chave so existe no arquivo', () => {
    writeEnv('SHOPEE_MOCK_MODE=false\nDATABASE_URL="postgresql://u:p@localhost:5432/db"\n');
    const warn = vi.fn();

    const { divergentKeys } = loadEnvFile(envPath, {}, warn);

    expect(divergentKeys).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('compara com o valor ja interpretado pelo dotenv (aspas nao contam como divergencia)', () => {
    writeEnv('DATABASE_URL="postgresql://u:p@localhost:5432/db?schema=public"\n');
    const warn = vi.fn();

    loadEnvFile(envPath, { DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public' }, warn);

    expect(warn).not.toHaveBeenCalled();
  });

  it('trata valor vazio exportado na sessao como divergencia', () => {
    writeEnv('SHOPEE_MOCK_MODE=false\n');
    const warn = vi.fn();

    const { divergentKeys } = loadEnvFile(envPath, { SHOPEE_MOCK_MODE: '' }, warn);

    expect(divergentKeys).toEqual(['SHOPEE_MOCK_MODE']);
  });

  it('nunca registra valores no aviso, so os nomes das chaves', () => {
    const fileSecret = 'segredo-do-arquivo-123';
    const sessionSecret = 'segredo-da-sessao-456';
    const fileUrl = 'postgresql://afflix:senha-arquivo@localhost:5432/afflix';
    const sessionUrl = 'postgresql://outro:senha-sessao@10.0.0.9:5432/prod';
    writeEnv(`SHOPEE_APP_SECRET=${fileSecret}\nDATABASE_URL="${fileUrl}"\n`);
    const warn = vi.fn();

    loadEnvFile(envPath, { SHOPEE_APP_SECRET: sessionSecret, DATABASE_URL: sessionUrl }, warn);

    const message: string = warn.mock.calls[0][0];
    expect(message).toContain('SHOPEE_APP_SECRET');
    expect(message).toContain('DATABASE_URL');
    for (const value of [fileSecret, sessionSecret, fileUrl, sessionUrl, 'senha-arquivo', 'senha-sessao', '10.0.0.9']) {
      expect(message).not.toContain(value);
    }
  });

  it('nao avisa nem falha quando o arquivo nao existe (ex.: CI sem .env)', () => {
    const warn = vi.fn();
    const env: Record<string, string | undefined> = { PORT: '3001' };

    const { divergentKeys } = loadEnvFile(join(dir, 'nao-existe.env'), env, warn);

    expect(divergentKeys).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    expect(env).toEqual({ PORT: '3001' });
  });
});

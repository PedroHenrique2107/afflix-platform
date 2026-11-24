import { resolve } from 'node:path';
import { loadEnvFile } from './env-file';

// Carrega o .env unico da raiz do monorepo (funciona em src/ via tsx e em dist/ via node).
// A sessao do terminal vence o arquivo; divergencias geram aviso no boot (SW-31).
loadEnvFile(resolve(__dirname, '../../../.env'));

import { config } from 'dotenv';
import { resolve } from 'node:path';

// Carrega o .env unico da raiz do monorepo (funciona em src/ via tsx e em dist/ via node).
config({ path: resolve(__dirname, '../../../.env') });

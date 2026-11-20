import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { extname, isAbsolute, join, resolve } from 'node:path';

// Raiz do monorepo, igual em src/ (tsx) e em dist/ (node): apps/api/{src,dist}/modules/media.
const REPO_ROOT = resolve(__dirname, '../../../../..');

// Pasta da biblioteca. Padrão data/media na raiz (data/ está no .gitignore: mídia nunca entra no Git).
export function mediaStorageRoot(): string {
  const configured = process.env.MEDIA_STORAGE_DIR?.trim();
  if (!configured) return join(REPO_ROOT, 'data', 'media');
  return isAbsolute(configured) ? configured : resolve(REPO_ROOT, configured);
}

export const mediaTempDir = (root = mediaStorageRoot()) => join(root, '.tmp');

// SHA-256 em stream: vídeo grande não precisa caber na memória.
export function sha256File(path: string): Promise<string> {
  return new Promise((done, fail) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('error', fail)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => done(hash.digest('hex')));
  });
}

// Extensão só se for curta e alfanumérica; o nome original nunca vira caminho (evita path traversal).
const safeExtension = (originalName: string) => {
  const ext = extname(originalName).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
};

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

// Adaptador de storage (ADR-006): o domínio só conhece storagePath relativo, então trocar local→cloud não muda o resto.
export interface MediaStorage {
  store(tempPath: string, sha256: string, originalName: string): Promise<string>;
  remove(storagePath: string): Promise<void>;
  discard(tempPath: string): Promise<void>;
}

export class LocalMediaStorage implements MediaStorage {
  constructor(private readonly root = mediaStorageRoot()) {}

  // Nome = hash: o mesmo conteúdo cai sempre no mesmo arquivo.
  async store(tempPath: string, sha256: string, originalName: string): Promise<string> {
    const storagePath = `${sha256}${safeExtension(originalName)}`;
    await mkdir(this.root, { recursive: true });
    await rename(tempPath, join(this.root, storagePath));
    return storagePath;
  }

  async remove(storagePath: string): Promise<void> {
    await rm(join(this.root, storagePath), { force: true });
  }

  async discard(tempPath: string): Promise<void> {
    await rm(tempPath, { force: true });
  }
}

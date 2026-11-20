import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createFakePrisma } from '../discovery/fake-prisma';
import { LocalMediaStorage, MediaStorage } from './media-storage';
import { MediaService, UploadedMedia } from './media.service';
import { ListMediaAssetsDto, UpdateMediaAssetDto } from './media.dto';

// sha256("abc")
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

let root: string;
let seq = 0;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'afflix-media-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

const upload = async (content = 'abc', originalname = 'video.mp4'): Promise<UploadedMedia> => {
  const path = join(root, `upload-${++seq}`);
  await writeFile(path, content);
  return { path, originalname, mimetype: 'video/mp4', size: content.length };
};
const setup = (storage?: MediaStorage) => {
  const fake = createFakePrisma();
  return { ...fake, service: new MediaService(fake.prisma, storage ?? new LocalMediaStorage(join(root, 'library'))) };
};
const fields = (overrides: Record<string, unknown> = {}) => ({
  title: 'Unboxing organizador', licenseType: 'ORIGINAL', rightsEvidence: 'Gravado pela equipe em 10/11/2026', ...overrides,
});

describe('MediaService.create', () => {
  it('grava o asset com sha256 calculado do arquivo e caminho nomeado pelo hash', async () => {
    const { service, media } = setup();
    const result = await service.create(fields({ sourceUrl: 'https://exemplo.com/video' }), await upload());
    expect(result.data).toMatchObject({
      title: 'Unboxing organizador', licenseType: 'ORIGINAL', sha256: ABC_SHA256,
      storagePath: `${ABC_SHA256}.mp4`, sourceUrl: 'https://exemplo.com/video', licenseStatus: 'VALID', publishable: true,
    });
    expect(media).toHaveLength(1);
    expect(existsSync(join(root, 'library', `${ABC_SHA256}.mp4`))).toBe(true);
  });

  it('asset sem tipo de licença é recusado e não deixa arquivo nem registro', async () => {
    const { service, media } = setup();
    const file = await upload();
    await expect(service.create(fields({ licenseType: undefined }), file)).rejects.toBeInstanceOf(BadRequestException);
    expect(media).toHaveLength(0);
    expect(existsSync(file.path)).toBe(false);
    expect(existsSync(join(root, 'library'))).toBe(false);
  });

  it('tipo de licença fora da lista é recusado', async () => {
    const { service, media } = setup();
    await expect(service.create(fields({ licenseType: 'QUALQUER' }), await upload())).rejects.toBeInstanceOf(BadRequestException);
    expect(media).toHaveLength(0);
  });

  it('nunca aceita sha256 nem storagePath vindos do cliente', async () => {
    const { service, media } = setup();
    await expect(service.create(fields({ sha256: 'f'.repeat(64) }), await upload())).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(fields({ storagePath: '../../etc/passwd' }), await upload())).rejects.toBeInstanceOf(BadRequestException);
    expect(media).toHaveLength(0);
  });

  it('sem prova de licença o asset é cadastrado, mas não fica publicável', async () => {
    const { service } = setup();
    const result = await service.create(fields({ rightsEvidence: '   ' }), await upload());
    expect(result.data).toMatchObject({ rightsEvidence: null, licenseStatus: 'MISSING_EVIDENCE', publishable: false });
  });

  it('licença vencida não fica publicável; data sem hora vale até o fim do dia', async () => {
    const { service } = setup();
    const expired = await service.create(fields({ licenseExpiresAt: '2020-01-31' }), await upload('a'));
    expect(expired.data).toMatchObject({ licenseExpiresAt: '2020-01-31T23:59:59.999Z', licenseStatus: 'EXPIRED', publishable: false });
    const future = await service.create(fields({ licenseExpiresAt: '2999-12-31' }), await upload('b'));
    expect(future.data.licenseStatus).toBe('VALID');
  });

  it('mesmo arquivo duas vezes vira 409 e não duplica', async () => {
    const { service, media } = setup();
    await service.create(fields(), await upload());
    const again = await upload();
    await expect(service.create(fields({ title: 'Outro título' }), again)).rejects.toBeInstanceOf(ConflictException);
    expect(media).toHaveLength(1);
    expect(existsSync(again.path)).toBe(false);
  });

  it('sem arquivo é 400', async () => {
    const { service } = setup();
    await expect(service.create(fields(), undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('falha ao gravar no banco remove o arquivo já movido', async () => {
    const { service, prisma } = setup();
    (prisma as any).mediaAsset.create = async () => { throw new Error('banco indisponível'); };
    await expect(service.create(fields(), await upload())).rejects.toThrow('banco indisponível');
    expect(await readdir(join(root, 'library'))).toEqual([]);
  });
});

describe('MediaService.list', () => {
  it('lista com origem, licença e validade, mais recente primeiro e paginada', async () => {
    const { service } = setup();
    await service.create(fields({ title: 'A', sourceUrl: 'https://exemplo.com/a' }), await upload('a'));
    await new Promise(r => setTimeout(r, 5));
    await service.create(fields({ title: 'B', rightsEvidence: undefined, licenseExpiresAt: '2999-01-01' }), await upload('b'));
    const page1 = await service.list(Object.assign(new ListMediaAssetsDto(), { page: 1, limit: 1 }));
    expect(page1.meta).toEqual({ page: 1, limit: 1, total: 2, hasNextPage: true });
    expect(page1.data[0]).toMatchObject({
      title: 'B', sourceUrl: null, licenseExpiresAt: '2999-01-01T23:59:59.999Z', licenseStatus: 'MISSING_EVIDENCE',
    });
    const page2 = await service.list(Object.assign(new ListMediaAssetsDto(), { page: 2, limit: 1 }));
    expect(page2.data[0]).toMatchObject({ title: 'A', sourceUrl: 'https://exemplo.com/a', licenseStatus: 'VALID' });
    expect(page2.meta.hasNextPage).toBe(false);
  });
});

describe('MediaService.update', () => {
  it('atualiza metadados e recalcula o status da licença; null limpa o campo', async () => {
    const { service } = setup();
    const { data } = await service.create(fields({ rightsEvidence: undefined }), await upload());
    const withProof = await service.update(data.id, Object.assign(new UpdateMediaAssetDto(), { rightsEvidence: 'Contrato #123' }));
    expect(withProof.data).toMatchObject({ rightsEvidence: 'Contrato #123', licenseStatus: 'VALID', sha256: ABC_SHA256 });
    const cleared = await service.update(data.id, Object.assign(new UpdateMediaAssetDto(), { rightsEvidence: null }));
    expect(cleared.data.licenseStatus).toBe('MISSING_EVIDENCE');
  });

  it('asset inexistente vira 404', async () => {
    const { service } = setup();
    await expect(service.update('b6f1c1a0-0000-4000-8000-000000000099', new UpdateMediaAssetDto()))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

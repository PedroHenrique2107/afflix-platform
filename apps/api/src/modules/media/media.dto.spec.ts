import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { parseDto } from '../../common/parse-dto';
import { UpdateMediaAssetDto } from './media.dto';

describe('UpdateMediaAssetDto', () => {
  it('não permite apagar tipo de licença nem título', async () => {
    await expect(parseDto(UpdateMediaAssetDto, { licenseType: null }, false)).rejects.toBeInstanceOf(BadRequestException);
    await expect(parseDto(UpdateMediaAssetDto, { title: '   ' }, false)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('vazio em campo opcional vira null (limpa); ausente fica undefined (mantém)', async () => {
    const dto = await parseDto(UpdateMediaAssetDto, { rightsEvidence: '  ', licenseExpiresAt: '' }, false);
    expect(dto.rightsEvidence).toBeNull();
    expect(dto.licenseExpiresAt).toBeNull();
    expect(dto.sourceUrl).toBeUndefined();
  });

  it('recusa hash, caminho e data inválida', async () => {
    await expect(parseDto(UpdateMediaAssetDto, { sha256: 'x' }, false)).rejects.toBeInstanceOf(BadRequestException);
    await expect(parseDto(UpdateMediaAssetDto, { storagePath: 'x' }, false)).rejects.toBeInstanceOf(BadRequestException);
    await expect(parseDto(UpdateMediaAssetDto, { licenseExpiresAt: '31/12/2026' }, false)).rejects.toBeInstanceOf(BadRequestException);
  });
});

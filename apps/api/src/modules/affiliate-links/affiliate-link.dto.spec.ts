import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { parseDto } from '../../common/parse-dto';
import { CreateAffiliateLinkDto } from './affiliate-link.dto';

const valid = { productId: 'b6f1c1a0-0000-4000-8000-000000000001', channel: 'INSTAGRAM' };
const parse = (body: unknown) => parseDto(CreateAffiliateLinkDto, body, false);

describe('CreateAffiliateLinkDto', () => {
  it('aceita o mínimo: productId e canal', async () => {
    await expect(parse(valid)).resolves.toMatchObject(valid);
  });
  it('campanha só com espaços vira ausente', async () => {
    const dto = await parse({ ...valid, campaign: '   ' });
    expect(dto.campaign).toBeUndefined();
  });
  it('recusa canal fora da lista do shared', async () => {
    await expect(parse({ ...valid, channel: 'FACEBOOK' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('recusa productId que não é UUID', async () => {
    await expect(parse({ ...valid, productId: '123' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('recusa mais de 5 subIds e subId com caractere especial', async () => {
    await expect(parse({ ...valid, subIds: ['a', 'b', 'c', 'd', 'e', 'f'] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(parse({ ...valid, subIds: ['natal-2026'] })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('recusa campo desconhecido', async () => {
    await expect(parse({ ...valid, shortUrl: 'https://evil.com' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

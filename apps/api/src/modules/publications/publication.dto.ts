import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { AFFILIATE_CHANNELS, PUBLICATION_CAPTION_MAX_LENGTH, PUBLICATION_CTA_MAX_LENGTH, PUBLICATION_STATUSES } from '@afflix/shared';
import type { AffiliateChannel, PublicationStatus } from '@afflix/shared';

const URL_OPTS = { protocols: ['http', 'https'], require_protocol: true };
const DATE_OR_ISO = { strict: true, strictSeparator: true };

// Texto só com espaços equivale a "não informado".
const trimToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};
// No PATCH, vazio limpa o campo (null); ausente mantém o valor atual (undefined).
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};
const numericQuery = ({ value }: { value: unknown }) => value === '' || value === null ? NaN : Number(value);
const present = (_: object, v: unknown) => v !== undefined;
const notNull = (_: object, v: unknown) => v !== null;

export class CreatePublicationDto {
  @IsUUID()
  productId!: string;

  @IsIn(AFFILIATE_CHANNELS, { message: `channel é obrigatório e deve ser um de: ${AFFILIATE_CHANNELS.join(', ')}` })
  channel!: AffiliateChannel;

  @IsOptional() @Transform(trimToUndefined) @IsString() @MaxLength(PUBLICATION_CAPTION_MAX_LENGTH)
  caption?: string;

  @IsOptional() @Transform(trimToUndefined) @IsString() @MaxLength(PUBLICATION_CTA_MAX_LENGTH)
  cta?: string;

  @IsOptional() @IsUUID()
  affiliateLinkId?: string;

  @IsOptional() @IsUUID()
  mediaAssetId?: string;
}

export class UpdatePublicationDto {
  // channel é obrigatório no banco: ausente mantém, null é recusado.
  @ValidateIf(present) @IsIn(AFFILIATE_CHANNELS, { message: `channel deve ser um de: ${AFFILIATE_CHANNELS.join(', ')}` })
  channel?: AffiliateChannel;

  @IsOptional() @Transform(trimToNull) @ValidateIf(notNull) @IsString() @MaxLength(PUBLICATION_CAPTION_MAX_LENGTH)
  caption?: string | null;

  @IsOptional() @Transform(trimToNull) @ValidateIf(notNull) @IsString() @MaxLength(PUBLICATION_CTA_MAX_LENGTH)
  cta?: string | null;

  @IsOptional() @ValidateIf(notNull) @IsUUID()
  affiliateLinkId?: string | null;

  @IsOptional() @ValidateIf(notNull) @IsUUID()
  mediaAssetId?: string | null;
}

export class ChangePublicationStatusDto {
  @IsIn(PUBLICATION_STATUSES, { message: `status é obrigatório e deve ser um de: ${PUBLICATION_STATUSES.join(', ')}` })
  status!: PublicationStatus;

  @IsOptional() @Transform(trimToUndefined) @IsUrl(URL_OPTS, { message: 'externalUrl deve ser uma URL http(s) completa' }) @MaxLength(2048)
  externalUrl?: string;

  @IsOptional() @Transform(trimToUndefined) @IsISO8601(DATE_OR_ISO, { message: 'publishedAt deve ser uma data ISO 8601' })
  publishedAt?: string;
}

export class ListPublicationsDto {
  @IsOptional() @Transform(numericQuery) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Transform(numericQuery) @IsInt() @Min(1) @Max(50)
  limit = 20;

  @IsOptional() @Transform(trimToUndefined) @IsIn(PUBLICATION_STATUSES)
  status?: PublicationStatus;
}

// Data sem hora vale como início daquele dia em UTC.
export function parsePublishedAt(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
}

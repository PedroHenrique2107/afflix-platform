import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { MEDIA_EVIDENCE_MAX_LENGTH, MEDIA_LICENSE_TYPES, MEDIA_TITLE_MAX_LENGTH } from '@afflix/shared';
import type { MediaLicenseType } from '@afflix/shared';

const URL_OPTS = { protocols: ['http', 'https'], require_protocol: true };
const DATE_OR_ISO = { strict: true, strictSeparator: true };

// Campo de formulário vem como texto: só espaços equivale a "não informado".
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

// Campos do multipart de POST /media. sha256 e storagePath não existem aqui: forbidNonWhitelisted recusa se vierem.
export class CreateMediaAssetDto {
  @Transform(trimToUndefined) @IsString() @MinLength(1) @MaxLength(MEDIA_TITLE_MAX_LENGTH)
  title!: string;

  @IsIn(MEDIA_LICENSE_TYPES, { message: `licenseType é obrigatório e deve ser um de: ${MEDIA_LICENSE_TYPES.join(', ')}` })
  licenseType!: MediaLicenseType;

  @IsOptional() @Transform(trimToUndefined) @IsUrl(URL_OPTS) @MaxLength(2048)
  sourceUrl?: string;

  @IsOptional() @Transform(trimToUndefined) @IsString() @MaxLength(MEDIA_EVIDENCE_MAX_LENGTH)
  rightsEvidence?: string;

  @IsOptional() @Transform(trimToUndefined) @IsISO8601(DATE_OR_ISO)
  licenseExpiresAt?: string;
}

// title e licenseType são obrigatórios no banco: ausente mantém, mas null é recusado (IsOptional aceitaria null).
const present = (_: object, v: unknown) => v !== undefined;

export class UpdateMediaAssetDto {
  @ValidateIf(present) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(MEDIA_TITLE_MAX_LENGTH)
  title?: string;

  @ValidateIf(present) @IsIn(MEDIA_LICENSE_TYPES, { message: `licenseType deve ser um de: ${MEDIA_LICENSE_TYPES.join(', ')}` })
  licenseType?: MediaLicenseType;

  @IsOptional() @Transform(trimToNull) @ValidateIf((_, v) => v !== null) @IsUrl(URL_OPTS) @MaxLength(2048)
  sourceUrl?: string | null;

  @IsOptional() @Transform(trimToNull) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(MEDIA_EVIDENCE_MAX_LENGTH)
  rightsEvidence?: string | null;

  @IsOptional() @Transform(trimToNull) @ValidateIf((_, v) => v !== null) @IsISO8601(DATE_OR_ISO)
  licenseExpiresAt?: string | null;
}

export class ListMediaAssetsDto {
  @IsOptional() @Transform(numericQuery) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Transform(numericQuery) @IsInt() @Min(1) @Max(50)
  limit = 20;
}

// Data sem hora (input date da tela) vale até o fim daquele dia em UTC.
export function parseExpiry(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59.999Z`) : new Date(value);
}

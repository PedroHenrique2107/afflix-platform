import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { AFFILIATE_CHANNELS, CAMPAIGN_MAX_LENGTH, SUB_ID_MAX_COUNT, SUB_ID_PATTERN } from '@afflix/shared';
import type { AffiliateChannel } from '@afflix/shared';

// Campanha só com espaços equivale a "sem campanha", para não gerar link distinto por acidente.
const trimToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class CreateAffiliateLinkDto {
  @IsUUID()
  productId!: string;

  @IsIn(AFFILIATE_CHANNELS)
  channel!: AffiliateChannel;

  @IsOptional() @Transform(trimToUndefined) @IsString() @MaxLength(CAMPAIGN_MAX_LENGTH)
  campaign?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(SUB_ID_MAX_COUNT)
  @IsString({ each: true }) @Matches(SUB_ID_PATTERN, { each: true, message: 'cada subId deve ter de 1 a 50 caracteres alfanuméricos' })
  subIds?: string[];
}

export class ListAffiliateLinksDto {
  @IsUUID('all', { message: 'productId é obrigatório e deve ser um UUID' })
  productId!: string;

  @IsOptional() @IsIn(AFFILIATE_CHANNELS)
  channel?: AffiliateChannel;
}

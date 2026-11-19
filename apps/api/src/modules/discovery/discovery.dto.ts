import 'reflect-metadata'; // @Type do class-transformer lê metadata no momento da importação
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsInt, IsNumber, IsOptional, IsString, IsUrl,
  Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

// Valores vazios não devem ser interpretados como zero.
const numericQuery = ({ value }: { value: unknown }) => value === '' || value === null ? NaN : Number(value);
export class SearchProductsDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(3) @MaxLength(100)
  keyword!: string;

  @IsOptional() @Transform(numericQuery) @IsNumber() @Min(0) @Max(100)
  minCommissionPercent = 8;

  @IsOptional() @Transform(numericQuery) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Transform(numericQuery) @IsInt() @Min(1) @Max(50)
  limit = 20;

  @IsOptional() @Transform(numericQuery) @IsNumber() @Min(0)
  minPrice?: number;

  @IsOptional() @Transform(numericQuery) @IsNumber() @Min(0)
  maxPrice?: number;

  @IsOptional() @Transform(numericQuery) @IsNumber() @Min(0) @Max(5)
  minRating?: number;
}

export class ListProductsDto {
  @IsOptional() @Transform(numericQuery) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Transform(numericQuery) @IsInt() @Min(1) @Max(50)
  limit = 20;
}

// Decimais trafegam como string. Regex limita o formato antes de virar Prisma.Decimal.
const MONEY = /^\d{1,10}(\.\d{1,6})?$/;
const RATE = /^(0(\.\d{1,12})?|1(\.0{1,12})?)$/; // 0 a 1 (0.08 = 8%)
const RATING = /^([0-4](\.\d{1,6})?|5(\.0{1,6})?)$/; // 0 a 5
const URL_OPTS = { protocols: ['http', 'https'], require_protocol: true };

export class ImportOfferDto {
  @Equals('SHOPEE')
  marketplace!: 'SHOPEE';

  @IsString() @MinLength(1) @MaxLength(32)
  shopId!: string;

  @IsString() @MinLength(1) @MaxLength(32)
  itemId!: string;

  @IsString() @MinLength(1) @MaxLength(500)
  name!: string;

  @IsUrl(URL_OPTS) @MaxLength(2048)
  productUrl!: string;

  @IsOptional() @IsUrl(URL_OPTS) @MaxLength(2048)
  offerUrl?: string;

  @IsOptional() @IsUrl(URL_OPTS) @MaxLength(2048)
  imageUrl?: string;

  @IsOptional() @IsString() @Matches(MONEY)
  price?: string;

  @IsOptional() @IsString() @Matches(MONEY)
  priceMax?: string;

  @IsOptional() @IsString() @Matches(RATE)
  commissionRate?: string;

  @IsOptional() @IsString() @Matches(MONEY)
  estimatedCommission?: string;

  @IsOptional() @IsString() @Matches(RATING)
  rating?: string;

  @IsOptional() @IsInt() @Min(0) @Max(2147483647)
  sales?: number;
}

export class ImportProductsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ImportOfferDto)
  offers!: ImportOfferDto[];
}

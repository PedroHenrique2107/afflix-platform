import { Transform } from 'class-transformer';

// Valores vazios não devem ser interpretados como zero.
const numericQuery = ({ value }: { value: unknown }) => value === '' || value === null ? NaN : Number(value);
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
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

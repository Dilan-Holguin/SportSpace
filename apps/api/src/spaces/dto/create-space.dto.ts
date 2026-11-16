import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { normalizeImageUrl } from '../space-image-url';

export class CreateSpaceDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  type!: string;

  @IsString()
  @MinLength(2)
  campus!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;

  @IsString()
  @MinLength(1)
  usageRules!: string;

  @Transform(({ value }) => normalizeImageUrl(value))
  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string')
  @IsString()
  @MaxLength(500)
  @Matches(/^(https?:\/\/[^\s]+|\/spaces\/[A-Za-z0-9._-]+)$/i, {
    message: 'imageUrl must be an http(s) URL or a /spaces/ path',
  })
  imageUrl?: string | null;
}

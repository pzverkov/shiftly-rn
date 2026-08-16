import { Type } from 'class-transformer';
import { IsISO8601, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class GeoPointDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

// Shared across start/finish/break/break-end - break endpoints just never read
// `location`, so reusing one DTO avoids four near-identical near-duplicates.
export class ShiftActionDto {
  @IsOptional()
  @IsISO8601()
  datetime?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location?: GeoPointDto;

  @IsOptional()
  @IsString()
  userId?: string;
}

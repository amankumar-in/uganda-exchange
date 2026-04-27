import {
  IsString,
  IsBoolean,
  IsOptional,
  Length,
  MinLength,
  MaxLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCountryDto {
  @IsString()
  @Length(2, 2)
  countryCode: string;

  @IsString()
  @MinLength(1)
  countryName: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  allowAllStates?: boolean;
}

export class UpdateCountryDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  countryName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  allowAllStates?: boolean;
}

export class CreateStateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  stateCode: string;

  @IsString()
  @MinLength(1)
  stateName: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AddStatesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStateDto)
  states: CreateStateDto[];
}

export class UpdateStateDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  stateName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class BulkToggleStatesDto {
  @IsArray()
  @IsString({ each: true })
  stateCodes: string[];

  @IsBoolean()
  isActive: boolean;
}

export class ToggleActiveDto {
  @IsBoolean()
  isActive: boolean;
}

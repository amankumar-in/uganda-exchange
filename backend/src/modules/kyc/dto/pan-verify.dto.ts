import { IsString, Matches, MinLength, MaxLength, IsDateString } from 'class-validator';

export class PanVerifyDto {
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'Invalid PAN format' })
  pan: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameAsPerPan: string;

  @IsDateString({}, { message: 'Invalid date of birth' })
  dateOfBirth: string; // YYYY-MM-DD
}

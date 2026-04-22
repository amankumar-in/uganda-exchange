import { IsBoolean, Equals } from 'class-validator';

export class ConsentDto {
  @IsBoolean()
  @Equals(true, { message: 'You must provide consent to continue' })
  consented: true;
}

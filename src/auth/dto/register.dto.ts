import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({
    description: 'Display name of the user',
    example: 'Alice',
    minLength: 2,
    maxLength: 50,
    name: 'display_name',
  })
  @IsNotEmpty()
  @IsString()
  @Length(2, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName: string;
}

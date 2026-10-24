import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({
    description: 'Username of the user',
    example: 'alice',
    minLength: 3,
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  username: string;

  @ApiProperty({
    description: 'Password of the user',
    example: 'password123',
    minLength: 4,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @Length(4, 100)
  password: string;
}

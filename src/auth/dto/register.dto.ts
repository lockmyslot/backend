import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
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

  @ApiPropertyOptional({
    description: 'Optional username for logging in',
    example: 'alice',
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  username?: string;

  @ApiPropertyOptional({
    description: 'Optional password for logging in',
    example: 'password123',
    minLength: 4,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(4, 100)
  password?: string;
}

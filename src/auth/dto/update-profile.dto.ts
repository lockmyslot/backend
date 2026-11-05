import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Updated display name of the user',
    example: 'Alice B.',
    minLength: 2,
    maxLength: 50,
    name: 'display_name',
  })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Updated username of the user',
    example: 'alice',
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  username?: string;

  @ApiPropertyOptional({
    description: 'Updated password of the user',
    example: 'password123',
    minLength: 4,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(4, 100)
  password?: string;
}


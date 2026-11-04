import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateGroupDto {
  @ApiProperty({
    description: 'Name of the group',
    example: 'Apartment 4B',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiProperty({
    description: 'Optional hex color for the group (e.g. #3B82F6)',
    example: '#3B82F6',
    required: false,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  color?: string;

  @ApiProperty({
    description: 'Optional icon key for the group',
    example: 'groups',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  icon?: string;
}

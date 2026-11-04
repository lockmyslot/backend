import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateGroupDto {
  @ApiProperty({
    description: 'Updated name of the group',
    example: 'Apartment 4B - Main',
    minLength: 2,
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiProperty({
    description: 'Updated hex color for the group',
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
    description: 'Updated icon key for the group',
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

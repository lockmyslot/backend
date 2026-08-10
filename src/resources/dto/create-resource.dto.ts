import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Length,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateResourceDto {
  @ApiProperty({
    description: 'Name of the resource',
    example: 'Washing Machine',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiProperty({
    description: 'Optional description of the resource',
    example: 'Ground floor laundry room',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @ApiProperty({
    description: 'Maximum concurrent bookings per slot',
    example: 1,
    minimum: 1,
    maximum: 100,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(100)
  capacity: number;

  @ApiProperty({
    description: 'Slot duration granularity in minutes (15 to 1080, multiple of 15)',
    example: 60,
    minimum: 15,
    maximum: 1080,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(15)
  @Max(1080)
  slotDurationMinutes: number;
}

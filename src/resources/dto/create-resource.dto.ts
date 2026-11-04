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
    description: 'Optional icon key for the resource (e.g. washing_machine, room, computer)',
    example: 'washing_machine',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  icon?: string;

  @ApiProperty({
    description: 'Optional hex color for the resource (e.g. #3B82F6)',
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
    description:
      'Slot duration granularity in minutes (15 to 43200, multiple of 15)',
    example: 60,
    required: false,
    minimum: 15,
    maximum: 43200,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(43200)
  slotDurationMinutes?: number;

  @ApiProperty({
    description:
      'Slot duration numeric value when configured with slot_duration_unit',
    example: 2,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  slotDuration?: number;

  @ApiProperty({
    description: 'Slot duration unit: minutes, hours, or days',
    example: 'hours',
    required: false,
    enum: ['minutes', 'hours', 'days'],
  })
  @IsOptional()
  @IsString()
  slotDurationUnit?: 'minutes' | 'hours' | 'days';
}

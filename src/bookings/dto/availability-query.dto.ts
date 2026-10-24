import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class AvailabilityQueryDto {
  @ApiProperty({
    description: 'Target date (YYYY-MM-DD)',
    example: '2026-08-11',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

  @ApiProperty({
    description: 'Optional booking ID to exclude when calculating availability (e.g. during reschedule)',
    required: false,
    name: 'exclude_booking_id',
  })
  @IsOptional()
  @IsString()
  excludeBookingId?: string;
}

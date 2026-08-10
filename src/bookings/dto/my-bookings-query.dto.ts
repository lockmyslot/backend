import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, Matches } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class MyBookingsQueryDto {
  @ApiPropertyOptional({
    description: 'Start date (YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be in YYYY-MM-DD format' })
  from?: string;

  @ApiPropertyOptional({
    description: 'End date (YYYY-MM-DD)',
    example: '2026-08-31',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be in YYYY-MM-DD format' })
  to?: string;

  @ApiPropertyOptional({
    enum: BookingStatus,
    description: 'Booking status filter (CONFIRMED or CANCELLED)',
    default: BookingStatus.CONFIRMED,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}

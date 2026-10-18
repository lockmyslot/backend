import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Matches,
} from 'class-validator';
import { DayScope } from '@prisma/client';

export class BookingRuleItemDto {
  @ApiProperty({
    enum: DayScope,
    description: 'Day scope for the booking rule',
    example: DayScope.WEEKDAY,
    name: 'day_scope',
  })
  @IsNotEmpty()
  @IsEnum(DayScope)
  dayScope: DayScope;

  @ApiProperty({
    description: 'Maximum bookings allowed per day for a user',
    required: false,
    example: 2,
    minimum: 1,
    name: 'max_bookings_per_day',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxBookingsPerDay?: number;

  @ApiProperty({
    description: 'Maximum total booked hours allowed per day for a user',
    required: false,
    example: 3,
    minimum: 1,
    name: 'max_hours_per_day',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxHoursPerDay?: number;

  @ApiProperty({
    description:
      'Required cooldown period in minutes between bookings for a user',
    required: false,
    example: 60,
    minimum: 0,
    name: 'cooldown_minutes',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownMinutes?: number;

  @ApiProperty({
    description: 'Minimum duration of a single booking in minutes',
    required: false,
    example: 30,
    minimum: 1,
    name: 'min_duration_minutes',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  minDurationMinutes?: number;

  @ApiProperty({
    description: 'Maximum duration of a single booking in minutes',
    required: false,
    example: 120,
    minimum: 1,
    name: 'max_duration_minutes',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDurationMinutes?: number;

  @ApiProperty({
    description: 'Maximum days in advance a booking can be made',
    required: false,
    example: 7,
    minimum: 1,
    name: 'max_advance_booking_days',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAdvanceBookingDays?: number;

  @ApiProperty({
    description: 'Available start time (HH:mm format, 24-hour)',
    required: false,
    example: '08:00',
    name: 'available_from',
  })
  @IsOptional()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'available_from must be in HH:mm format (24-hour)',
  })
  availableFrom?: string;

  @ApiProperty({
    description: 'Available end time (HH:mm format, 24-hour)',
    required: false,
    example: '22:00',
    name: 'available_until',
  })
  @IsOptional()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'available_until must be in HH:mm format (24-hour)',
  })
  availableUntil?: string;
}

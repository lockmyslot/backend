import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Length,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsISO8601,
  Matches,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { RecurrenceType } from '@prisma/client';

export class CreateMaintenanceDto {
  @ApiProperty({
    description: 'Title of the maintenance task',
    example: 'Deep Cleaning',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  title: string;

  @ApiProperty({
    description: 'Optional description of the maintenance task',
    example: 'Quarterly sanitization and filter change',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  description?: string;

  @ApiProperty({
    description: 'Recurrence type (NONE, DAILY, WEEKLY)',
    enum: RecurrenceType,
    default: RecurrenceType.NONE,
    required: false,
  })
  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrenceType?: RecurrenceType = RecurrenceType.NONE;

  @ApiProperty({
    description: 'Day of week for WEEKLY recurrence (0=Sun, 1=Mon, ..., 6=Sat)',
    example: 1,
    required: false,
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiProperty({
    description: 'Start time of day in UTC (HH:mm) for recurring tasks',
    example: '14:00',
    required: false,
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'start_time_of_day must be in HH:mm format',
  })
  startTimeOfDay?: string;

  @ApiProperty({
    description: 'End time of day in UTC (HH:mm) for recurring tasks',
    example: '16:00',
    required: false,
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'end_time_of_day must be in HH:mm format',
  })
  endTimeOfDay?: string;

  @ApiProperty({
    description:
      'Start datetime (ISO 8601). Exact start for one-off; start of recurrence window for recurring.',
    example: '2026-10-20T08:00:00Z',
  })
  @IsNotEmpty()
  @IsISO8601()
  startTime: string;

  @ApiProperty({
    description:
      'End datetime (ISO 8601). Exact end for one-off; end of recurrence window for recurring.',
    example: '2026-10-20T12:00:00Z',
  })
  @IsNotEmpty()
  @IsISO8601()
  endTime: string;

  @ApiProperty({
    description:
      'If true, automatically cancels any confirmed bookings that overlap with this maintenance schedule',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  cancelConflictingBookings?: boolean = false;

  @ApiProperty({
    description: 'UUID of user assigned to this maintenance task',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

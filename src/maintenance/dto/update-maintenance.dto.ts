import { ApiProperty } from '@nestjs/swagger';
import {
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
  ValidateIf,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MaintenanceStatus, RecurrenceType } from '@prisma/client';

export class UpdateMaintenanceDto {
  @ApiProperty({
    description: 'Title of the maintenance task',
    example: 'Deep Cleaning',
    minLength: 2,
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  title?: string;

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
    description: 'Status of the maintenance task',
    enum: MaintenanceStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @ApiProperty({
    description: 'Recurrence type (NONE, DAILY, WEEKLY)',
    enum: RecurrenceType,
    required: false,
  })
  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrenceType?: RecurrenceType;

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
    description: 'Start time of day in UTC (HH:mm)',
    example: '14:00',
    required: false,
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'start_time_of_day must be in HH:mm format',
  })
  startTimeOfDay?: string;

  @ApiProperty({
    description: 'End time of day in UTC (HH:mm)',
    example: '16:00',
    required: false,
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'end_time_of_day must be in HH:mm format',
  })
  endTimeOfDay?: string;

  @ApiProperty({
    description: 'Start datetime (ISO 8601)',
    example: '2026-10-20T08:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @ApiProperty({
    description: 'End datetime (ISO 8601)',
    example: '2026-10-20T12:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @ApiProperty({
    description:
      'If true, automatically cancels any confirmed bookings that overlap with the updated schedule',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  cancelConflictingBookings?: boolean = false;

  @ApiProperty({
    description: 'UUID of user assigned to this maintenance task, or null to unassign',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  assignedToId?: string | null;
}

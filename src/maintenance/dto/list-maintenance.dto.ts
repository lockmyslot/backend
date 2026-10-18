import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsISO8601, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { MaintenanceStatus } from '@prisma/client';

export class ListMaintenanceDto {
  @ApiProperty({
    description: 'Filter by maintenance status',
    enum: MaintenanceStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @ApiProperty({
    description:
      'Filter tasks starting or active on or after this ISO datetime',
    required: false,
    example: '2026-10-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiProperty({
    description: 'Filter tasks ending or active on or before this ISO datetime',
    required: false,
    example: '2026-10-31T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiProperty({
    description: 'Filter tasks assigned to a specific user',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiProperty({
    description: 'Filter tasks assigned to the current authenticated user',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  assignedToMe?: boolean;
}

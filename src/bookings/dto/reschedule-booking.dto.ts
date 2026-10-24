import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsISO8601 } from 'class-validator';

export class RescheduleBookingDto {
  @ApiProperty({
    description: 'New booking start time in ISO 8601 format (UTC)',
    example: '2026-08-11T11:00:00Z',
    name: 'start_time',
  })
  @IsNotEmpty()
  @IsISO8601()
  startTime: string;

  @ApiProperty({
    description: 'New booking end time in ISO 8601 format (UTC)',
    example: '2026-08-11T12:00:00Z',
    name: 'end_time',
  })
  @IsNotEmpty()
  @IsISO8601()
  endTime: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsISO8601 } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Booking start time in ISO 8601 format (UTC)',
    example: '2026-08-11T09:00:00Z',
    name: 'start_time',
  })
  @IsNotEmpty()
  @IsISO8601()
  startTime: string;

  @ApiProperty({
    description: 'Booking end time in ISO 8601 format (UTC)',
    example: '2026-08-11T10:00:00Z',
    name: 'end_time',
  })
  @IsNotEmpty()
  @IsISO8601()
  endTime: string;
}

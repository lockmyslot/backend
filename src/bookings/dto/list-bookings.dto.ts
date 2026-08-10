import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class ListBookingsDto {
  @ApiPropertyOptional({
    description: 'Specific date (YYYY-MM-DD)',
    example: '2026-08-11',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;

  @ApiPropertyOptional({
    description: 'Start of date range (YYYY-MM-DD)',
    example: '2026-08-11',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be in YYYY-MM-DD format' })
  from?: string;

  @ApiPropertyOptional({
    description: 'End of date range (YYYY-MM-DD)',
    example: '2026-08-18',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be in YYYY-MM-DD format' })
  to?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class PinGroupDto {
  @ApiPropertyOptional({ description: 'Whether the group is pinned to the top' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

import { IsEnum, IsOptional, IsISO8601 } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GroupRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: GroupRole, example: GroupRole.MODERATOR })
  @IsEnum(GroupRole)
  role: GroupRole;

  @ApiPropertyOptional({
    description:
      'ISO 8601 date string for when guest access expires. Required when role is GUEST.',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

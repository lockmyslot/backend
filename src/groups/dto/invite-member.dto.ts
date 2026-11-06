import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Length,
  IsEnum,
  IsOptional,
  IsISO8601,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { GroupRole } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Username of the user to invite to the group',
    example: 'alice',
    minLength: 1,
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  @Length(1, 50, { message: 'Username must be between 1 and 50 characters' })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().replace(/^@/, '').toLowerCase()
      : value,
  )
  username: string;

  @ApiPropertyOptional({
    enum: GroupRole,
    description: 'Role to assign the invited user. Defaults to GUEST.',
    example: GroupRole.GUEST,
    default: GroupRole.GUEST,
  })
  @IsOptional()
  @IsEnum(GroupRole)
  role?: GroupRole;

  @ApiPropertyOptional({
    description:
      'ISO 8601 date string for when guest access expires. If not provided for GUEST, defaults to 7 days from now.',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

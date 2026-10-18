import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class JoinGroupDto {
  @ApiProperty({
    description: '6-character uppercase alphanumeric invite code',
    example: 'X7K9M2',
    minLength: 6,
    maxLength: 6,
    name: 'invite_code',
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Z0-9]{6}$/, {
    message: 'invite_code must be a 6-character uppercase alphanumeric string',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  inviteCode: string;
}

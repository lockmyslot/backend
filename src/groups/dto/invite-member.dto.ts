import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

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
}

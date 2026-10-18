import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GroupMember } from '@prisma/client';

export const CurrentMember = createParamDecorator(
  (data: keyof GroupMember | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const member = request.groupMember;

    return data ? member?.[data] : member;
  },
);

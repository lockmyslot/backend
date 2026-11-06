import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { GroupRole, BookingStatus } from '@prisma/client';

@Injectable()
export class GroupMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    const params = request.params;
    const groupId = params.group_id || params.groupId || params.id;

    if (!groupId) {
      throw new ForbiddenException('Group ID parameter missing');
    }

    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      const groupExists = await this.prisma.group.findUnique({
        where: { id: groupId },
      });
      if (!groupExists) {
        throw new NotFoundException('Group not found');
      }
      throw new ForbiddenException('You are not a member of this group');
    }

    if (
      membership.role === GroupRole.GUEST &&
      membership.expiresAt &&
      membership.expiresAt <= new Date()
    ) {
      await this.prisma.groupMember.delete({
        where: {
          groupId_userId: {
            groupId,
            userId: user.id,
          },
        },
      });

      await this.prisma.booking.updateMany({
        where: {
          groupId,
          userId: user.id,
          status: BookingStatus.CONFIRMED,
          startTime: {
            gt: new Date(),
          },
        },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });

      throw new ForbiddenException('Membership has expired');
    }

    request.groupMember = membership;

    const requiredRoles = this.reflector.getAllAndOverride<GroupRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(membership.role);
      if (!hasRole) {
        throw new ForbiddenException(
          `Insufficient permissions. Required role: ${requiredRoles.join(', ')}`,
        );
      }
    }

    return true;
  }
}

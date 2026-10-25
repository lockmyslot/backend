import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteStatus, GroupRole } from '@prisma/client';

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyPendingInvites(userId: string) {
    const invites = await this.prisma.groupInvite.findMany({
      where: {
        invitedUserId: userId,
        status: InviteStatus.PENDING,
      },
      include: {
        group: true,
        invitedBy: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return invites.map((invite) => ({
      id: invite.id,
      groupId: invite.groupId,
      groupName: invite.group.name,
      invitedById: invite.invitedById,
      invitedByName: invite.invitedBy.displayName,
      invitedByUsername: invite.invitedBy.username,
      status: invite.status,
      createdAt: invite.createdAt,
    }));
  }

  async acceptInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.groupInvite.findUnique({
      where: { id: inviteId },
      include: { group: true },
    });

    if (!invite) {
      throw new NotFoundException('invite_not_found');
    }

    if (invite.invitedUserId !== userId) {
      throw new ForbiddenException('forbidden');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('invite_not_pending');
    }

    // Add user as group member if not already
    const existingMember = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: invite.groupId,
          userId,
        },
      },
    });

    if (!existingMember) {
      await this.prisma.groupMember.create({
        data: {
          groupId: invite.groupId,
          userId,
          role: GroupRole.MEMBER,
        },
      });
    }

    const updatedInvite = await this.prisma.groupInvite.update({
      where: { id: inviteId },
      data: { status: InviteStatus.ACCEPTED },
    });

    return {
      id: updatedInvite.id,
      groupId: invite.groupId,
      groupName: invite.group.name,
      status: updatedInvite.status,
    };
  }

  async declineInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.groupInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('invite_not_found');
    }

    if (invite.invitedUserId !== userId) {
      throw new ForbiddenException('forbidden');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('invite_not_pending');
    }

    const updatedInvite = await this.prisma.groupInvite.update({
      where: { id: inviteId },
      data: { status: InviteStatus.DECLINED },
    });

    return {
      id: updatedInvite.id,
      groupId: invite.groupId,
      status: updatedInvite.status,
    };
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { GroupRole, BookingStatus, InviteStatus } from '@prisma/client';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateUniqueInviteCode(): Promise<string> {
    let code = generateInviteCode();
    let exists = await this.prisma.group.findUnique({
      where: { inviteCode: code },
    });

    while (exists) {
      code = generateInviteCode();
      exists = await this.prisma.group.findUnique({
        where: { inviteCode: code },
      });
    }

    return code;
  }

  async createGroup(userId: string, dto: CreateGroupDto) {
    const inviteCode = await this.generateUniqueInviteCode();

    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        inviteCode,
        color: dto.color ? dto.color.trim() : null,
        icon: dto.icon ? dto.icon.trim() : null,
        createdById: userId,
        members: {
          create: {
            userId,
            role: GroupRole.ADMIN,
          },
        },
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      color: group.color,
      icon: group.icon,
      role: GroupRole.ADMIN,
      memberCount: group._count.members,
      createdAt: group.createdAt,
      isPinned: false,
    };
  }

  async cleanupExpiredMemberships(groupId?: string) {
    const now = new Date();
    const expiredMembers = await this.prisma.groupMember.findMany({
      where: {
        role: GroupRole.GUEST,
        expiresAt: { lte: now },
        ...(groupId ? { groupId } : {}),
      },
    });

    if (!Array.isArray(expiredMembers) || expiredMembers.length === 0) {
      return;
    }

    for (const member of expiredMembers) {
      await this.prisma.groupMember.delete({
        where: {
          groupId_userId: {
            groupId: member.groupId,
            userId: member.userId,
          },
        },
      });

      await this.prisma.booking.updateMany({
        where: {
          groupId: member.groupId,
          userId: member.userId,
          status: BookingStatus.CONFIRMED,
          startTime: {
            gt: now,
          },
        },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });
    }
  }

  async getUserGroups(userId: string) {
    await this.cleanupExpiredMemberships();

    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { joinedAt: 'desc' }],
    });

    return memberships.map((m) => {
      const isAdmin = m.role === GroupRole.ADMIN;
      return {
        id: m.group.id,
        name: m.group.name,
        color: m.group.color,
        icon: m.group.icon,
        role: m.role,
        expiresAt: m.expiresAt,
        ...(isAdmin ? { inviteCode: m.group.inviteCode } : {}),
        memberCount: m.group._count.members,
        createdAt: m.group.createdAt,
        isPinned: m.isPinned,
      };
    });
  }

  async getGroupDetails(groupId: string, userId: string) {
    await this.cleanupExpiredMemberships(groupId);

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { userId },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const membership = group.members[0];
    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const isAdmin = membership.role === GroupRole.ADMIN;

    return {
      id: group.id,
      name: group.name,
      color: group.color,
      icon: group.icon,
      role: membership.role,
      expiresAt: membership.expiresAt,
      ...(isAdmin ? { inviteCode: group.inviteCode } : {}),
      memberCount: group._count.members,
      createdAt: group.createdAt,
      isPinned: membership.isPinned,
    };
  }

  async togglePinGroup(groupId: string, userId: string, isPinned?: boolean) {
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Group membership not found');
    }

    const nextPinned = isPinned !== undefined ? isPinned : !membership.isPinned;

    const updated = await this.prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      data: {
        isPinned: nextPinned,
      },
    });

    return {
      id: groupId,
      isPinned: updated.isPinned,
    };
  }

  async joinGroup(userId: string, dto: JoinGroupDto) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode: dto.inviteCode },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('invalid_invite_code');
    }

    const existingMember = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('already_a_member');
    }

    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: GroupRole.MEMBER,
      },
    });

    // Mark any existing pending invite for this user and group as ACCEPTED
    await this.prisma.groupInvite.updateMany({
      where: {
        groupId: group.id,
        invitedUserId: userId,
        status: InviteStatus.PENDING,
      },
      data: {
        status: InviteStatus.ACCEPTED,
      },
    });

    return {
      id: group.id,
      name: group.name,
      role: GroupRole.MEMBER,
      memberCount: group._count.members + 1,
      createdAt: group.createdAt,
      isPinned: false,
    };
  }

  async updateGroup(groupId: string, dto: UpdateGroupDto, userId: string) {
    const dataToUpdate: any = {};
    if (dto.name !== undefined) dataToUpdate.name = dto.name;
    if (dto.color !== undefined)
      dataToUpdate.color = dto.color ? dto.color.trim() : null;
    if (dto.icon !== undefined)
      dataToUpdate.icon = dto.icon ? dto.icon.trim() : null;

    const group = await this.prisma.group.update({
      where: { id: groupId },
      data: dataToUpdate,
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      color: group.color,
      icon: group.icon,
      role: GroupRole.ADMIN,
      memberCount: group._count.members,
      createdAt: group.createdAt,
    };
  }

  async getMembers(groupId: string) {
    await this.cleanupExpiredMemberships(groupId);

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: true,
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    return members.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      username: m.user.username,
      role: m.role,
      expiresAt: m.expiresAt,
      joinedAt: m.joinedAt,
    }));
  }

  async inviteMemberByUsername(
    groupId: string,
    currentUserId: string,
    dto: InviteMemberDto,
  ) {
    const normalizedUsername = dto.username
      .trim()
      .replace(/^@/, '')
      .toLowerCase();

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('group_not_found');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: {
        username: { equals: normalizedUsername, mode: 'insensitive' },
      },
    });

    if (!targetUser) {
      throw new NotFoundException('user_not_found');
    }

    if (targetUser.id === currentUserId) {
      throw new BadRequestException('cannot_invite_self');
    }

    const existingMember = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('already_a_member');
    }

    const existingInvite = await this.prisma.groupInvite.findUnique({
      where: {
        groupId_invitedUserId: {
          groupId,
          invitedUserId: targetUser.id,
        },
      },
    });

    if (existingInvite && existingInvite.status === InviteStatus.PENDING) {
      throw new ConflictException('invite_already_pending');
    }

    let invite;
    if (existingInvite) {
      invite = await this.prisma.groupInvite.update({
        where: { id: existingInvite.id },
        data: {
          status: InviteStatus.PENDING,
          invitedById: currentUserId,
        },
      });
    } else {
      invite = await this.prisma.groupInvite.create({
        data: {
          groupId,
          invitedUserId: targetUser.id,
          invitedById: currentUserId,
          status: InviteStatus.PENDING,
        },
      });
    }

    return {
      id: invite.id,
      inviteId: invite.id,
      groupId,
      groupName: group.name,
      userId: targetUser.id,
      invitedUserId: targetUser.id,
      displayName: targetUser.displayName,
      username: targetUser.username,
      status: invite.status,
      createdAt: invite.createdAt,
    };
  }

  async removeMember(
    groupId: string,
    currentUserId: string,
    targetUserId: string,
  ) {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('cannot_remove_self');
    }

    const targetMembership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in this group');
    }

    if (targetMembership.role === GroupRole.ADMIN) {
      throw new ForbiddenException('cannot_remove_admin');
    }

    const currentMembership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: currentUserId,
        },
      },
    });

    if (currentMembership) {
      if (currentMembership.role === GroupRole.MODERATOR) {
        if (targetMembership.role !== GroupRole.GUEST) {
          throw new ForbiddenException('Moderators can only remove guests');
        }
      } else if (currentMembership.role !== GroupRole.ADMIN) {
        throw new ForbiddenException(
          'Insufficient permissions to remove member',
        );
      }
    }

    // Delete membership
    await this.prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
    });

    // Cancel all future CONFIRMED bookings for this user in this group
    await this.prisma.booking.updateMany({
      where: {
        groupId,
        userId: targetUserId,
        status: BookingStatus.CONFIRMED,
        startTime: {
          gt: new Date(),
        },
      },
      data: {
        status: BookingStatus.CANCELLED,
      },
    });
  }

  async updateMemberRole(
    groupId: string,
    currentUserId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const targetMembership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
      include: {
        user: true,
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in this group');
    }

    // Check if demoting the sole admin
    if (
      targetMembership.role === GroupRole.ADMIN &&
      dto.role !== GroupRole.ADMIN
    ) {
      const adminCount = await this.prisma.groupMember.count({
        where: {
          groupId,
          role: GroupRole.ADMIN,
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('sole_admin_cannot_change_role');
      }
    }

    let expiresAt: Date | null = null;
    if (dto.role === GroupRole.GUEST) {
      if (!dto.expiresAt) {
        throw new BadRequestException(
          'Guest members must have an expiration date',
        );
      }
      const expDate = new Date(dto.expiresAt);
      if (isNaN(expDate.getTime()) || expDate <= new Date()) {
        throw new BadRequestException(
          'Expiration date must be a valid future date',
        );
      }
      expiresAt = expDate;
    }

    const updated = await this.prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
      data: {
        role: dto.role,
        expiresAt,
      },
      include: {
        user: true,
      },
    });

    return {
      id: updated.user.id,
      displayName: updated.user.displayName,
      username: updated.user.username,
      role: updated.role,
      expiresAt: updated.expiresAt,
      joinedAt: updated.joinedAt,
    };
  }

  async leaveGroup(groupId: string, userId: string) {
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('You are not a member of this group');
    }

    if (membership.role === GroupRole.ADMIN) {
      const adminCount = await this.prisma.groupMember.count({
        where: {
          groupId,
          role: GroupRole.ADMIN,
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('sole_admin_cannot_leave');
      }
    }

    // Delete membership
    await this.prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    // Cancel all future CONFIRMED bookings for this user in this group
    await this.prisma.booking.updateMany({
      where: {
        groupId,
        userId,
        status: BookingStatus.CONFIRMED,
        startTime: {
          gt: new Date(),
        },
      },
      data: {
        status: BookingStatus.CANCELLED,
      },
    });
  }

  async regenerateInviteCode(groupId: string) {
    const newInviteCode = await this.generateUniqueInviteCode();

    await this.prisma.group.update({
      where: { id: groupId },
      data: {
        inviteCode: newInviteCode,
      },
    });

    return {
      inviteCode: newInviteCode,
    };
  }
}

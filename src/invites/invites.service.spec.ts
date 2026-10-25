import { Test, TestingModule } from '@nestjs/testing';
import { InvitesService } from './invites.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InviteStatus, GroupRole } from '@prisma/client';

describe('InvitesService', () => {
  let service: InvitesService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      groupInvite: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      groupMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<InvitesService>(InvitesService);
    prismaService = module.get(PrismaService);
  });

  describe('getMyPendingInvites', () => {
    it('should return mapped pending invites for user', async () => {
      const mockInvites = [
        {
          id: 'invite-1',
          groupId: 'group-1',
          group: { name: 'Basketball Team' },
          invitedById: 'admin-1',
          invitedBy: { displayName: 'Coach John', username: 'john' },
          status: InviteStatus.PENDING,
          createdAt: new Date('2026-10-25T10:00:00Z'),
        },
      ];
      (prismaService.groupInvite.findMany as jest.Mock).mockResolvedValue(mockInvites);

      const result = await service.getMyPendingInvites('user-1');

      expect(prismaService.groupInvite.findMany).toHaveBeenCalledWith({
        where: {
          invitedUserId: 'user-1',
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
      expect(result).toEqual([
        {
          id: 'invite-1',
          groupId: 'group-1',
          groupName: 'Basketball Team',
          invitedById: 'admin-1',
          invitedByName: 'Coach John',
          invitedByUsername: 'john',
          status: InviteStatus.PENDING,
          createdAt: new Date('2026-10-25T10:00:00Z'),
        },
      ]);
    });
  });

  describe('acceptInvite', () => {
    it('should throw NotFoundException if invite does not exist', async () => {
      (prismaService.groupInvite.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.acceptInvite('invite-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if invite belongs to someone else', async () => {
      (prismaService.groupInvite.findUnique as jest.Mock).mockResolvedValue({
        id: 'invite-1',
        invitedUserId: 'user-other',
        group: { name: 'Team' },
      });

      await expect(service.acceptInvite('invite-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if invite is not PENDING', async () => {
      (prismaService.groupInvite.findUnique as jest.Mock).mockResolvedValue({
        id: 'invite-1',
        invitedUserId: 'user-1',
        status: InviteStatus.ACCEPTED,
        group: { name: 'Team' },
      });

      await expect(service.acceptInvite('invite-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept invite, create group member, and update status', async () => {
      (prismaService.groupInvite.findUnique as jest.Mock).mockResolvedValue({
        id: 'invite-1',
        groupId: 'group-1',
        invitedUserId: 'user-1',
        status: InviteStatus.PENDING,
        group: { name: 'Soccer Club' },
      });
      (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.groupInvite.update as jest.Mock).mockResolvedValue({
        id: 'invite-1',
        status: InviteStatus.ACCEPTED,
      });

      const result = await service.acceptInvite('invite-1', 'user-1');

      expect(prismaService.groupMember.create).toHaveBeenCalledWith({
        data: {
          groupId: 'group-1',
          userId: 'user-1',
          role: GroupRole.MEMBER,
        },
      });
      expect(prismaService.groupInvite.update).toHaveBeenCalledWith({
        where: { id: 'invite-1' },
        data: { status: InviteStatus.ACCEPTED },
      });
      expect(result).toEqual({
        id: 'invite-1',
        groupId: 'group-1',
        groupName: 'Soccer Club',
        status: InviteStatus.ACCEPTED,
      });
    });
  });

  describe('declineInvite', () => {
    it('should decline invite and update status', async () => {
      (prismaService.groupInvite.findUnique as jest.Mock).mockResolvedValue({
        id: 'invite-1',
        groupId: 'group-1',
        invitedUserId: 'user-1',
        status: InviteStatus.PENDING,
      });
      (prismaService.groupInvite.update as jest.Mock).mockResolvedValue({
        id: 'invite-1',
        status: InviteStatus.DECLINED,
      });

      const result = await service.declineInvite('invite-1', 'user-1');

      expect(prismaService.groupInvite.update).toHaveBeenCalledWith({
        where: { id: 'invite-1' },
        data: { status: InviteStatus.DECLINED },
      });
      expect(result).toEqual({
        id: 'invite-1',
        groupId: 'group-1',
        status: InviteStatus.DECLINED,
      });
    });
  });
});

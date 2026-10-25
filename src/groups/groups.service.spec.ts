import { Test, TestingModule } from '@nestjs/testing';
import { GroupsService } from './groups.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { GroupRole } from '@prisma/client';

describe('GroupsService', () => {
  let service: GroupsService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      group: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      groupMember: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      booking: {
        updateMany: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
    prismaService = module.get(PrismaService);
  });

  it('should create group with creator as ADMIN and invite code', async () => {
    (prismaService.group.findUnique as jest.Mock).mockResolvedValue(null);
    (prismaService.group.create as jest.Mock).mockResolvedValue({
      id: 'group-1',
      name: 'Apartment 4B',
      inviteCode: 'X7K9M2',
      createdById: 'user-1',
      createdAt: new Date(),
      _count: { members: 1 },
    });

    const result = await service.createGroup('user-1', {
      name: 'Apartment 4B',
    });
    expect(result).toHaveProperty('id', 'group-1');
    expect(result).toHaveProperty('role', GroupRole.ADMIN);
    expect(result).toHaveProperty('inviteCode', 'X7K9M2');
  });

  it('should throw NotFoundException on invalid invite code when joining', async () => {
    (prismaService.group.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.joinGroup('user-2', { inviteCode: 'INVALID' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException if already a member when joining', async () => {
    (prismaService.group.findUnique as jest.Mock).mockResolvedValue({
      id: 'group-1',
      name: 'Apartment 4B',
      inviteCode: 'X7K9M2',
      _count: { members: 1 },
    });
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      groupId: 'group-1',
      userId: 'user-1',
      role: GroupRole.ADMIN,
    });

    await expect(
      service.joinGroup('user-1', { inviteCode: 'X7K9M2' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw BadRequestException if sole admin attempts to leave group', async () => {
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      groupId: 'group-1',
      userId: 'user-1',
      role: GroupRole.ADMIN,
    });
    (prismaService.groupMember.count as jest.Mock).mockResolvedValue(1);

    await expect(service.leaveGroup('group-1', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException if trying to remove self via removeMember', async () => {
    await expect(
      service.removeMember('group-1', 'user-1', 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw ForbiddenException if trying to remove another ADMIN', async () => {
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-2',
      groupId: 'group-1',
      userId: 'user-2',
      role: GroupRole.ADMIN,
    });

    await expect(
      service.removeMember('group-1', 'admin-1', 'user-2'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should retry invite code generation when the first code collides', async () => {
    (prismaService.group.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'existing-group' })
      .mockResolvedValueOnce(null);
    (prismaService.group.create as jest.Mock).mockResolvedValue({
      id: 'group-1',
      name: 'Apartment 4B',
      inviteCode: 'ABCDEF',
      createdById: 'user-1',
      createdAt: new Date(),
      _count: { members: 1 },
    });

    const result = await service.createGroup('user-1', {
      name: 'Apartment 4B',
    });
    expect(result).toHaveProperty('inviteCode', 'ABCDEF');
  });

  it('should list user groups including invite code for ADMIN', async () => {
    (prismaService.groupMember.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'member-1',
        userId: 'user-1',
        role: GroupRole.ADMIN,
        joinedAt: new Date(),
        group: {
          id: 'group-1',
          name: 'Apartment 4B',
          inviteCode: 'X7K9M2',
          createdAt: new Date(),
          _count: { members: 3 },
        },
      },
      {
        id: 'member-2',
        userId: 'user-1',
        role: GroupRole.MEMBER,
        joinedAt: new Date(),
        group: {
          id: 'group-2',
          name: 'Office',
          inviteCode: 'SECRET',
          createdAt: new Date(),
          _count: { members: 5 },
        },
      },
    ]);

    const result = await service.getUserGroups('user-1');
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('inviteCode', 'X7K9M2');
    expect(result[1]).not.toHaveProperty('inviteCode');
    expect(result[1]).toHaveProperty('memberCount', 5);
  });

  it('should throw NotFoundException if group not found in getGroupDetails', async () => {
    (prismaService.group.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getGroupDetails('group-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw ForbiddenException if user is not a member in getGroupDetails', async () => {
    (prismaService.group.findUnique as jest.Mock).mockResolvedValue({
      id: 'group-1',
      name: 'Apartment 4B',
      inviteCode: 'X7K9M2',
      createdAt: new Date(),
      members: [],
      _count: { members: 1 },
    });

    await expect(service.getGroupDetails('group-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should return group details for a member', async () => {
    (prismaService.group.findUnique as jest.Mock).mockResolvedValue({
      id: 'group-1',
      name: 'Apartment 4B',
      inviteCode: 'X7K9M2',
      createdAt: new Date(),
      members: [{ role: GroupRole.ADMIN }],
      _count: { members: 2 },
    });

    const result = await service.getGroupDetails('group-1', 'user-1');
    expect(result).toHaveProperty('inviteCode', 'X7K9M2');
    expect(result).toHaveProperty('role', GroupRole.ADMIN);
  });

  it('should join a group successfully', async () => {
    (prismaService.group.findUnique as jest.Mock).mockResolvedValue({
      id: 'group-1',
      name: 'Apartment 4B',
      inviteCode: 'X7K9M2',
      createdAt: new Date(),
      _count: { members: 2 },
    });
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(null);
    (prismaService.groupMember.create as jest.Mock).mockResolvedValue({});

    const result = await service.joinGroup('user-3', { inviteCode: 'X7K9M2' });
    expect(result).toHaveProperty('role', GroupRole.MEMBER);
    expect(result).toHaveProperty('memberCount', 3);
  });

  it('should update a group name', async () => {
    (prismaService.group.update as jest.Mock).mockResolvedValue({
      id: 'group-1',
      name: 'Renamed',
      inviteCode: 'X7K9M2',
      createdAt: new Date(),
      _count: { members: 2 },
    });

    const result = await service.updateGroup(
      'group-1',
      { name: 'Renamed' },
      'user-1',
    );
    expect(result).toHaveProperty('name', 'Renamed');
    expect(result).toHaveProperty('role', GroupRole.ADMIN);
  });

  it('should list group members', async () => {
    (prismaService.groupMember.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'member-1',
        role: GroupRole.ADMIN,
        joinedAt: new Date(),
        user: { id: 'user-1', displayName: 'Alice' },
      },
    ]);

    const result = await service.getMembers('group-1');
    expect(result[0]).toHaveProperty('displayName', 'Alice');
    expect(result[0]).toHaveProperty('role', GroupRole.ADMIN);
  });

  it('should throw NotFoundException if target member not found in removeMember', async () => {
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.removeMember('group-1', 'admin-1', 'user-2'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should remove a member and cancel their future bookings', async () => {
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-2',
      groupId: 'group-1',
      userId: 'user-2',
      role: GroupRole.MEMBER,
    });
    (prismaService.groupMember.delete as jest.Mock).mockResolvedValue({});
    (prismaService.booking.updateMany as jest.Mock).mockResolvedValue({});

    await service.removeMember('group-1', 'admin-1', 'user-2');
    expect(prismaService.groupMember.delete).toHaveBeenCalled();
    expect(prismaService.booking.updateMany).toHaveBeenCalled();
  });

  it('should throw NotFoundException when leaving a group you are not in', async () => {
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.leaveGroup('group-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should allow a non-admin member to leave the group', async () => {
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-2',
      groupId: 'group-1',
      userId: 'user-2',
      role: GroupRole.MEMBER,
    });
    (prismaService.groupMember.delete as jest.Mock).mockResolvedValue({});
    (prismaService.booking.updateMany as jest.Mock).mockResolvedValue({});

    await service.leaveGroup('group-1', 'user-2');
    expect(prismaService.groupMember.delete).toHaveBeenCalled();
    expect(prismaService.booking.updateMany).toHaveBeenCalled();
  });

  it('should regenerate invite code', async () => {
    (prismaService.group.findUnique as jest.Mock).mockResolvedValue(null);
    (prismaService.group.update as jest.Mock).mockResolvedValue({});

    const result = await service.regenerateInviteCode('group-1');
    expect(result).toHaveProperty('inviteCode');
    expect(prismaService.group.update).toHaveBeenCalled();
  });

  describe('togglePinGroup', () => {
    it('should throw NotFoundException if membership does not exist', async () => {
      (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.togglePinGroup('group-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should toggle pin status when isPinned is not provided', async () => {
      (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-1',
        groupId: 'group-1',
        userId: 'user-1',
        isPinned: false,
      });
      (prismaService.groupMember.update as jest.Mock).mockResolvedValue({
        id: 'member-1',
        groupId: 'group-1',
        userId: 'user-1',
        isPinned: true,
      });

      const result = await service.togglePinGroup('group-1', 'user-1');
      expect(prismaService.groupMember.update).toHaveBeenCalledWith({
        where: {
          groupId_userId: {
            groupId: 'group-1',
            userId: 'user-1',
          },
        },
        data: {
          isPinned: true,
        },
      });
      expect(result).toEqual({ id: 'group-1', isPinned: true });
    });

    it('should set explicit isPinned status when provided', async () => {
      (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-1',
        groupId: 'group-1',
        userId: 'user-1',
        isPinned: true,
      });
      (prismaService.groupMember.update as jest.Mock).mockResolvedValue({
        id: 'member-1',
        groupId: 'group-1',
        userId: 'user-1',
        isPinned: false,
      });

      const result = await service.togglePinGroup('group-1', 'user-1', false);
      expect(prismaService.groupMember.update).toHaveBeenCalledWith({
        where: {
          groupId_userId: {
            groupId: 'group-1',
            userId: 'user-1',
          },
        },
        data: {
          isPinned: false,
        },
      });
      expect(result).toEqual({ id: 'group-1', isPinned: false });
    });
  });

  describe('inviteMemberByUsername', () => {
    it('should throw NotFoundException if group does not exist', async () => {
      (prismaService.group.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.inviteMemberByUsername('group-1', 'admin-1', {
          username: 'charlie',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user with username does not exist', async () => {
      (prismaService.group.findUnique as jest.Mock).mockResolvedValue({
        id: 'group-1',
      });
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.inviteMemberByUsername('group-1', 'admin-1', {
          username: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if admin tries to invite themselves', async () => {
      (prismaService.group.findUnique as jest.Mock).mockResolvedValue({
        id: 'group-1',
      });
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'admin-1',
        username: 'admin',
      });

      await expect(
        service.inviteMemberByUsername('group-1', 'admin-1', {
          username: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if user is already a member', async () => {
      (prismaService.group.findUnique as jest.Mock).mockResolvedValue({
        id: 'group-1',
      });
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-2',
        username: 'bob',
      });
      (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-2',
        groupId: 'group-1',
        userId: 'user-2',
      });

      await expect(
        service.inviteMemberByUsername('group-1', 'admin-1', {
          username: 'bob',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should add the user to group successfully', async () => {
      (prismaService.group.findUnique as jest.Mock).mockResolvedValue({
        id: 'group-1',
      });
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-2',
        username: 'bob',
        displayName: 'Bob Builder',
      });
      (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prismaService.groupMember.create as jest.Mock).mockResolvedValue({
        id: 'member-new',
        groupId: 'group-1',
        userId: 'user-2',
        role: GroupRole.MEMBER,
        joinedAt: new Date('2026-10-25T12:00:00Z'),
      });

      const result = await service.inviteMemberByUsername(
        'group-1',
        'admin-1',
        { username: '@bob' },
      );

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          username: { equals: 'bob', mode: 'insensitive' },
        },
      });
      expect(prismaService.groupMember.create).toHaveBeenCalledWith({
        data: {
          groupId: 'group-1',
          userId: 'user-2',
          role: GroupRole.MEMBER,
        },
      });
      expect(result).toEqual({
        id: 'user-2',
        userId: 'user-2',
        groupId: 'group-1',
        displayName: 'Bob Builder',
        username: 'bob',
        role: GroupRole.MEMBER,
        joinedAt: new Date('2026-10-25T12:00:00Z'),
      });
    });
  });
});

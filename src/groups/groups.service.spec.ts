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
      },
      booking: {
        updateMany: jest.fn(),
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

    const result = await service.createGroup('user-1', { name: 'Apartment 4B' });
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
});

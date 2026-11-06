import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GroupMemberGuard } from './group-member.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupRole } from '@prisma/client';

describe('GroupMemberGuard', () => {
  let guard: GroupMemberGuard;
  let prismaService: jest.Mocked<PrismaService>;
  let reflector: jest.Mocked<Reflector>;

  const createContext = (request: any): any => ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  });

  beforeEach(() => {
    prismaService = {
      groupMember: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      booking: {
        updateMany: jest.fn(),
      },
      group: {
        findUnique: jest.fn(),
      },
    } as any;
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    guard = new GroupMemberGuard(prismaService, reflector);
  });

  it('should throw ForbiddenException if no user is present', async () => {
    const ctx = createContext({ user: null, params: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if group id param is missing', async () => {
    const ctx = createContext({ user: { id: 'user-1' }, params: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException if group does not exist and user is not a member', async () => {
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(null);
    (prismaService.group.findUnique as jest.Mock).mockResolvedValue(null);

    const ctx = createContext({
      user: { id: 'user-1' },
      params: { group_id: 'group-1' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if user is not a member of an existing group', async () => {
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(null);
    (prismaService.group.findUnique as jest.Mock).mockResolvedValue({
      id: 'group-1',
    });

    const ctx = createContext({
      user: { id: 'user-1' },
      params: { group_id: 'group-1' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should set groupMember and allow when no roles required', async () => {
    const membership = { id: 'member-1', role: GroupRole.MEMBER };
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(
      membership,
    );
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const request = { user: { id: 'user-1' }, params: { groupId: 'group-1' } };
    const result = await guard.canActivate(createContext(request));
    expect(result).toBe(true);
    expect(request.groupMember).toEqual(membership);
  });

  it('should allow when user has a required role', async () => {
    const membership = { id: 'member-1', role: GroupRole.ADMIN };
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(
      membership,
    );
    reflector.getAllAndOverride.mockReturnValue([GroupRole.ADMIN]);

    const request = { user: { id: 'user-1' }, params: { id: 'group-1' } };
    const result = await guard.canActivate(createContext(request));
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user lacks the required role', async () => {
    const membership = { id: 'member-1', role: GroupRole.MEMBER };
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(
      membership,
    );
    reflector.getAllAndOverride.mockReturnValue([GroupRole.ADMIN]);

    const request = { user: { id: 'user-1' }, params: { group_id: 'group-1' } };
    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should auto-remove expired guest membership and cancel bookings', async () => {
    const expiredGuest = {
      id: 'member-1',
      role: GroupRole.GUEST,
      expiresAt: new Date(Date.now() - 10000), // 10s ago
    };
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(
      expiredGuest,
    );
    (prismaService.groupMember.delete as jest.Mock).mockResolvedValue({});
    (prismaService.booking.updateMany as jest.Mock).mockResolvedValue({});

    const request = { user: { id: 'user-guest' }, params: { id: 'group-1' } };
    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      new ForbiddenException('Membership has expired'),
    );

    expect(prismaService.groupMember.delete).toHaveBeenCalledWith({
      where: {
        groupId_userId: {
          groupId: 'group-1',
          userId: 'user-guest',
        },
      },
    });
    expect(prismaService.booking.updateMany).toHaveBeenCalled();
  });

  it('should allow active guest membership', async () => {
    const activeGuest = {
      id: 'member-1',
      role: GroupRole.GUEST,
      expiresAt: new Date(Date.now() + 86400000), // tomorrow
    };
    (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(
      activeGuest,
    );
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const request = { user: { id: 'user-guest' }, params: { id: 'group-1' } };
    const result = await guard.canActivate(createContext(request));
    expect(result).toBe(true);
  });
});

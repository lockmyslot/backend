import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
  });

  it('should register a new user with an auth token', async () => {
    const mockUser = {
      id: 'user-uuid-1',
      username: 'alice',
      passwordHash: 'hashed',
      displayName: 'Alice',
      authToken: 'token-uuid-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaService.user.create as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.register({
      displayName: 'Alice',
      username: 'alice',
      password: 'password123',
    });
    expect(result).toHaveProperty('id', 'user-uuid-1');
    expect(result).toHaveProperty('displayName', 'Alice');
    expect(result).toHaveProperty('username', 'alice');
    expect(result).toHaveProperty('authToken', 'token-uuid-1');
  });

  it('should throw ConflictException if username already taken on register', async () => {
    (prismaService.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'existing-id',
      username: 'alice',
    });

    await expect(
      service.register({
        displayName: 'Alice Two',
        username: 'alice',
        password: 'password123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should login successfully with valid username and password', async () => {
    const hash = await bcrypt.hash('secret123', 10);
    const mockUser = {
      id: 'user-uuid-1',
      username: 'alice',
      passwordHash: hash,
      displayName: 'Alice',
      authToken: 'token-uuid-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.login({
      username: 'alice',
      password: 'secret123',
    });

    expect(result).toHaveProperty('id', 'user-uuid-1');
    expect(result).toHaveProperty('username', 'alice');
    expect(result).toHaveProperty('authToken', 'token-uuid-1');
  });

  it('should throw UnauthorizedException if username not found on login', async () => {
    (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.login({
        username: 'unknown',
        password: 'secret123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if password does not match on login', async () => {
    const hash = await bcrypt.hash('secret123', 10);
    const mockUser = {
      id: 'user-uuid-1',
      username: 'alice',
      passwordHash: hash,
      displayName: 'Alice',
      authToken: 'token-uuid-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

    await expect(
      service.login({
        username: 'alice',
        password: 'wrongpassword',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should get profile without returning auth_token or passwordHash', async () => {
    const mockUser = {
      id: 'user-uuid-1',
      username: 'alice',
      passwordHash: 'secret-hash',
      displayName: 'Alice',
      authToken: 'secret-token',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
      mockUser,
    );

    const result = await service.getProfile('user-uuid-1');
    expect(result).toHaveProperty('id', 'user-uuid-1');
    expect(result).toHaveProperty('displayName', 'Alice');
    expect(result).toHaveProperty('username', 'alice');
    expect(result).not.toHaveProperty('authToken');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('should update profile display_name', async () => {
    const mockUser = {
      id: 'user-uuid-1',
      username: 'alice',
      displayName: 'Alice B.',
      authToken: 'secret-token',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.updateProfile('user-uuid-1', {
      displayName: 'Alice B.',
    });
    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: 'user-uuid-1' },
      data: { displayName: 'Alice B.' },
    });
    expect(result).toHaveProperty('displayName', 'Alice B.');
    expect(result).toHaveProperty('username', 'alice');
  });

  it('should update profile username if available', async () => {
    const mockUser = {
      id: 'user-uuid-1',
      username: 'alice_new',
      displayName: 'Alice',
      authToken: 'secret-token',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.updateProfile('user-uuid-1', {
      username: 'alice_new',
    });
    expect(prismaService.user.findFirst).toHaveBeenCalledWith({
      where: {
        username: { equals: 'alice_new', mode: 'insensitive' },
        id: { not: 'user-uuid-1' },
      },
    });
    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: 'user-uuid-1' },
      data: { username: 'alice_new' },
    });
    expect(result.username).toBe('alice_new');
  });

  it('should throw ConflictException if updating to an existing username', async () => {
    (prismaService.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'other-user',
      username: 'taken_user',
    });

    await expect(
      service.updateProfile('user-uuid-1', {
        username: 'taken_user',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should update profile password and hash it', async () => {
    const mockUser = {
      id: 'user-uuid-1',
      username: 'alice',
      displayName: 'Alice',
      passwordHash: 'new-hashed-password',
      authToken: 'secret-token',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.updateProfile('user-uuid-1', {
      password: 'newSecretPassword123',
    });
    expect(prismaService.user.update).toHaveBeenCalled();
    const updateCall = (prismaService.user.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.passwordHash).toBeDefined();
    expect(updateCall.data.passwordHash).not.toBe('newSecretPassword123');
    expect(result).toHaveProperty('id', 'user-uuid-1');
  });

  it('should return profile directly if no fields were updated', async () => {
    const mockUser = {
      id: 'user-uuid-1',
      username: 'alice',
      displayName: 'Alice',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.updateProfile('user-uuid-1', {});
    expect(result).toHaveProperty('displayName', 'Alice');
    expect(prismaService.user.update).not.toHaveBeenCalled();
  });
});


import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
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
      displayName: 'Alice',
      authToken: 'token-uuid-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.user.create as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.register({ displayName: 'Alice' });
    expect(result).toHaveProperty('id', 'user-uuid-1');
    expect(result).toHaveProperty('displayName', 'Alice');
    expect(result).toHaveProperty('authToken', 'token-uuid-1');
  });

  it('should get profile without returning auth_token', async () => {
    const mockUser = {
      id: 'user-uuid-1',
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
    expect(result).not.toHaveProperty('authToken');
  });

  it('should update profile display_name', async () => {
    const mockUser = {
      id: 'user-uuid-1',
      displayName: 'Alice B.',
      authToken: 'secret-token',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.updateProfile('user-uuid-1', {
      displayName: 'Alice B.',
    });
    expect(result).toHaveProperty('displayName', 'Alice B.');
  });
});

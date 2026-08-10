import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
      },
    } as any;
    guard = new AuthGuard(prismaService);
  });

  const createMockContext = (authHeader?: string): ExecutionContext => {
    const request = {
      headers: {
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      user: null,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  it('should throw UnauthorizedException if authorization header is missing', async () => {
    const ctx = createMockContext();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if header is not Bearer', async () => {
    const ctx = createMockContext('Basic token123');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if token does not match a user', async () => {
    const ctx = createMockContext('Bearer invalid-token');
    (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should attach user to request and return true for valid token', async () => {
    const ctx = createMockContext('Bearer valid-token');
    const mockUser = { id: 'user-1', displayName: 'Alice', authToken: 'valid-token' };
    (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toEqual(mockUser);
  });
});

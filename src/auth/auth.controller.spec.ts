import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    } as any;
    controller = new AuthController(authService);
  });

  it('should delegate register to the service', async () => {
    const dto = { displayName: 'Alice' };
    authService.register.mockResolvedValue({ id: 'user-1' } as any);

    const result = await controller.register(dto);
    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toHaveProperty('id', 'user-1');
  });

  it('should delegate getProfile using the current user id', async () => {
    authService.getProfile.mockResolvedValue({ id: 'user-1' } as any);

    const result = await controller.getProfile({ id: 'user-1' } as any);
    expect(authService.getProfile).toHaveBeenCalledWith('user-1');
    expect(result).toHaveProperty('id', 'user-1');
  });

  it('should delegate updateProfile using the current user id and dto', async () => {
    const dto = { displayName: 'Alice B.' };
    authService.updateProfile.mockResolvedValue({ id: 'user-1' } as any);

    const result = await controller.updateProfile({ id: 'user-1' } as any, dto);
    expect(authService.updateProfile).toHaveBeenCalledWith('user-1', dto);
    expect(result).toHaveProperty('id', 'user-1');
  });
});

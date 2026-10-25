import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

describe('InvitesController', () => {
  let controller: InvitesController;
  let invitesService: jest.Mocked<InvitesService>;

  beforeEach(() => {
    invitesService = {
      getMyPendingInvites: jest.fn(),
      acceptInvite: jest.fn(),
      declineInvite: jest.fn(),
    } as any;
    controller = new InvitesController(invitesService);
  });

  it('should delegate getMyPendingInvites', async () => {
    invitesService.getMyPendingInvites.mockResolvedValue([]);

    const result = await controller.getMyPendingInvites({ id: 'user-1' } as any);
    expect(invitesService.getMyPendingInvites).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([]);
  });

  it('should delegate acceptInvite', async () => {
    const mockRes = { id: 'inv-1', groupId: 'g1', groupName: 'Team', status: 'ACCEPTED' as any };
    invitesService.acceptInvite.mockResolvedValue(mockRes);

    const result = await controller.acceptInvite('inv-1', { id: 'user-1' } as any);
    expect(invitesService.acceptInvite).toHaveBeenCalledWith('inv-1', 'user-1');
    expect(result).toEqual(mockRes);
  });

  it('should delegate declineInvite', async () => {
    const mockRes = { id: 'inv-1', groupId: 'g1', status: 'DECLINED' as any };
    invitesService.declineInvite.mockResolvedValue(mockRes);

    const result = await controller.declineInvite('inv-1', { id: 'user-1' } as any);
    expect(invitesService.declineInvite).toHaveBeenCalledWith('inv-1', 'user-1');
    expect(result).toEqual(mockRes);
  });
});

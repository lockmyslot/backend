import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

describe('GroupsController', () => {
  let controller: GroupsController;
  let groupsService: jest.Mocked<GroupsService>;

  beforeEach(() => {
    groupsService = {
      createGroup: jest.fn(),
      getUserGroups: jest.fn(),
      joinGroup: jest.fn(),
      getGroupDetails: jest.fn(),
      updateGroup: jest.fn(),
      togglePinGroup: jest.fn(),
      getMembers: jest.fn(),
      removeMember: jest.fn(),
      leaveGroup: jest.fn(),
      regenerateInviteCode: jest.fn(),
      inviteMemberByUsername: jest.fn(),
    } as any;
    controller = new GroupsController(groupsService);
  });

  it('should delegate createGroup', async () => {
    const dto = { name: 'Apartment 4B' };
    groupsService.createGroup.mockResolvedValue({ id: 'group-1' } as any);

    const result = await controller.createGroup({ id: 'user-1' } as any, dto);
    expect(groupsService.createGroup).toHaveBeenCalledWith('user-1', dto);
    expect(result).toHaveProperty('id', 'group-1');
  });

  it('should delegate getUserGroups', async () => {
    groupsService.getUserGroups.mockResolvedValue([]);

    const result = await controller.getUserGroups({ id: 'user-1' } as any);
    expect(groupsService.getUserGroups).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([]);
  });

  it('should delegate joinGroup', async () => {
    const dto = { inviteCode: 'X7K9M2' };
    groupsService.joinGroup.mockResolvedValue({ id: 'group-1' } as any);

    const result = await controller.joinGroup({ id: 'user-1' } as any, dto);
    expect(groupsService.joinGroup).toHaveBeenCalledWith('user-1', dto);
    expect(result).toHaveProperty('id', 'group-1');
  });

  it('should delegate getGroupDetails', async () => {
    groupsService.getGroupDetails.mockResolvedValue({ id: 'group-1' } as any);

    const result = await controller.getGroupDetails('group-1', {
      id: 'user-1',
    } as any);
    expect(groupsService.getGroupDetails).toHaveBeenCalledWith(
      'group-1',
      'user-1',
    );
    expect(result).toHaveProperty('id', 'group-1');
  });

  it('should delegate updateGroup', async () => {
    const dto = { name: 'Renamed' };
    groupsService.updateGroup.mockResolvedValue({ id: 'group-1' } as any);

    const result = await controller.updateGroup(
      'group-1',
      { id: 'user-1' } as any,
      dto,
    );
    expect(groupsService.updateGroup).toHaveBeenCalledWith(
      'group-1',
      dto,
      'user-1',
    );
    expect(result).toHaveProperty('id', 'group-1');
  });

  it('should delegate togglePinGroup', async () => {
    groupsService.togglePinGroup.mockResolvedValue({
      id: 'group-1',
      isPinned: true,
    });

    const result = await controller.togglePinGroup(
      'group-1',
      { id: 'user-1' } as any,
      { isPinned: true },
    );
    expect(groupsService.togglePinGroup).toHaveBeenCalledWith(
      'group-1',
      'user-1',
      true,
    );
    expect(result).toEqual({ id: 'group-1', isPinned: true });
  });

  it('should delegate getMembers', async () => {
    groupsService.getMembers.mockResolvedValue([]);

    const result = await controller.getMembers('group-1');
    expect(groupsService.getMembers).toHaveBeenCalledWith('group-1');
    expect(result).toEqual([]);
  });

  it('should delegate removeMember', async () => {
    groupsService.removeMember.mockResolvedValue(undefined);

    await controller.removeMember('group-1', 'user-2', { id: 'user-1' } as any);
    expect(groupsService.removeMember).toHaveBeenCalledWith(
      'group-1',
      'user-1',
      'user-2',
    );
  });

  it('should delegate leaveGroup', async () => {
    groupsService.leaveGroup.mockResolvedValue(undefined);

    await controller.leaveGroup('group-1', { id: 'user-1' } as any);
    expect(groupsService.leaveGroup).toHaveBeenCalledWith('group-1', 'user-1');
  });

  it('should delegate regenerateInviteCode', async () => {
    groupsService.regenerateInviteCode.mockResolvedValue({
      inviteCode: 'NEW',
    });

    const result = await controller.regenerateInviteCode('group-1');
    expect(groupsService.regenerateInviteCode).toHaveBeenCalledWith('group-1');
    expect(result).toHaveProperty('inviteCode', 'NEW');
  });

  it('should delegate inviteMember and addMember', async () => {
    const dto = { username: 'bob' };
    const memberData = {
      id: 'user-2',
      userId: 'user-2',
      groupId: 'group-1',
      displayName: 'Bob',
      username: 'bob',
      role: 'MEMBER',
      joinedAt: new Date(),
    };
    groupsService.inviteMemberByUsername.mockResolvedValue(memberData as any);

    const inviteResult = await controller.inviteMember(
      'group-1',
      { id: 'user-1' } as any,
      dto,
    );
    expect(groupsService.inviteMemberByUsername).toHaveBeenCalledWith(
      'group-1',
      'user-1',
      dto,
    );
    expect(inviteResult).toEqual(memberData);

    const addResult = await controller.addMember(
      'group-1',
      { id: 'user-1' } as any,
      dto,
    );
    expect(addResult).toEqual(memberData);
  });
});

import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

describe('ResourcesController', () => {
  let controller: ResourcesController;
  let resourcesService: jest.Mocked<ResourcesService>;

  beforeEach(() => {
    resourcesService = {
      createResource: jest.fn(),
      getResources: jest.fn(),
      getResourceDetails: jest.fn(),
      updateResource: jest.fn(),
      deleteResource: jest.fn(),
    } as any;
    controller = new ResourcesController(resourcesService);
  });

  it('should delegate createResource', async () => {
    const dto = {
      name: 'Washing Machine',
      capacity: 1,
      slotDurationMinutes: 60,
    };
    resourcesService.createResource.mockResolvedValue({ id: 'res-1' } as any);

    const result = await controller.createResource('group-1', dto);
    expect(resourcesService.createResource).toHaveBeenCalledWith(
      'group-1',
      dto,
    );
    expect(result).toHaveProperty('id', 'res-1');
  });

  it('should delegate getResources with include_inactive false and member role', async () => {
    resourcesService.getResources.mockResolvedValue([]);

    const result = await controller.getResources('group-1', undefined, {
      groupMember: { role: 'MEMBER' },
    } as any);
    expect(resourcesService.getResources).toHaveBeenCalledWith(
      'group-1',
      false,
      'MEMBER',
    );
    expect(result).toEqual([]);
  });

  it('should delegate getResources with include_inactive true', async () => {
    resourcesService.getResources.mockResolvedValue([]);

    await controller.getResources('group-1', 'true', {
      groupMember: { role: 'ADMIN' },
    } as any);
    expect(resourcesService.getResources).toHaveBeenCalledWith(
      'group-1',
      true,
      'ADMIN',
    );
  });

  it('should delegate getResourceDetails', async () => {
    resourcesService.getResourceDetails.mockResolvedValue({
      id: 'res-1',
    } as any);

    const result = await controller.getResourceDetails('group-1', 'res-1');
    expect(resourcesService.getResourceDetails).toHaveBeenCalledWith(
      'group-1',
      'res-1',
    );
    expect(result).toHaveProperty('id', 'res-1');
  });

  it('should delegate updateResource', async () => {
    const dto = { name: 'Updated' };
    resourcesService.updateResource.mockResolvedValue({ id: 'res-1' } as any);

    const result = await controller.updateResource('group-1', 'res-1', dto);
    expect(resourcesService.updateResource).toHaveBeenCalledWith(
      'group-1',
      'res-1',
      dto,
    );
    expect(result).toHaveProperty('id', 'res-1');
  });

  it('should delegate deleteResource', async () => {
    resourcesService.deleteResource.mockResolvedValue(undefined);

    await controller.deleteResource('group-1', 'res-1');
    expect(resourcesService.deleteResource).toHaveBeenCalledWith(
      'group-1',
      'res-1',
    );
  });
});

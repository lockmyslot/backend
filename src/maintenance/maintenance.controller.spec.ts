import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../prisma/prisma.service';
import { Reflector } from '@nestjs/core';
import { MaintenanceStatus, GroupRole } from '@prisma/client';

describe('MaintenanceController', () => {
  let controller: MaintenanceController;
  let service: jest.Mocked<MaintenanceService>;

  const mockTask = {
    id: 'task-1',
    resourceId: 'res-1',
    resourceName: 'Room A',
    groupId: 'group-1',
    title: 'Cleaning',
    description: null,
    status: MaintenanceStatus.SCHEDULED,
    recurrenceType: 'NONE' as any,
    dayOfWeek: null,
    startTimeOfDay: null,
    endTimeOfDay: null,
    startTime: new Date('2026-10-25T10:00:00Z'),
    endTime: new Date('2026-10-25T12:00:00Z'),
    createdById: 'user-1',
    createdByName: 'Admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      createMaintenanceTask: jest.fn(),
      listMaintenanceTasks: jest.fn(),
      getMaintenanceTask: jest.fn(),
      updateMaintenanceTask: jest.fn(),
      deleteMaintenanceTask: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceController],
      providers: [
        {
          provide: MaintenanceService,
          useValue: mockService,
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<MaintenanceController>(MaintenanceController);
    service = module.get(MaintenanceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create maintenance task', async () => {
    service.createMaintenanceTask.mockResolvedValue(mockTask as any);

    const dto = {
      title: 'Cleaning',
      startTime: '2026-10-25T10:00:00Z',
      endTime: '2026-10-25T12:00:00Z',
    };
    const req = { user: { id: 'user-1' } };

    const result = await controller.createMaintenanceTask(
      'group-1',
      'res-1',
      dto,
      'user-1',
    );
    expect(result).toEqual(mockTask);
    expect(service.createMaintenanceTask).toHaveBeenCalledWith(
      'group-1',
      'res-1',
      'user-1',
      dto,
    );
  });

  it('should list resource maintenance tasks', async () => {
    service.listMaintenanceTasks.mockResolvedValue([mockTask]);

    const result = await controller.getResourceMaintenance(
      'group-1',
      'res-1',
      {},
      'user-1',
    );
    expect(result).toEqual([mockTask]);
    expect(service.listMaintenanceTasks).toHaveBeenCalledWith(
      'group-1',
      'res-1',
      {},
      'user-1',
    );
  });

  it('should list group maintenance tasks', async () => {
    service.listMaintenanceTasks.mockResolvedValue([mockTask]);

    const result = await controller.getGroupMaintenance('group-1', {}, 'user-1');
    expect(result).toEqual([mockTask]);
    expect(service.listMaintenanceTasks).toHaveBeenCalledWith(
      'group-1',
      undefined,
      {},
      'user-1',
    );
  });

  it('should get single maintenance task', async () => {
    service.getMaintenanceTask.mockResolvedValue(mockTask);

    const result = await controller.getMaintenanceTask(
      'group-1',
      'res-1',
      'task-1',
    );
    expect(result).toEqual(mockTask);
  });

  it('should update maintenance task', async () => {
    service.updateMaintenanceTask.mockResolvedValue({
      ...mockTask,
      status: MaintenanceStatus.COMPLETED,
    } as any);

    const result = await controller.updateMaintenanceTask(
      'group-1',
      'res-1',
      'task-1',
      { status: MaintenanceStatus.COMPLETED },
      'user-1',
      GroupRole.ADMIN,
    );
    expect(result.status).toBe(MaintenanceStatus.COMPLETED);
    expect(service.updateMaintenanceTask).toHaveBeenCalledWith(
      'group-1',
      'res-1',
      'task-1',
      { status: MaintenanceStatus.COMPLETED },
      'user-1',
      GroupRole.ADMIN,
    );
  });

  it('should delete maintenance task', async () => {
    service.deleteMaintenanceTask.mockResolvedValue({ success: true });

    const result = await controller.deleteMaintenanceTask(
      'group-1',
      'res-1',
      'task-1',
    );
    expect(result).toEqual({ success: true });
  });
});

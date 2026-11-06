import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  MaintenanceStatus,
  RecurrenceType,
  BookingStatus,
  GroupRole,
} from '@prisma/client';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockResource = {
    id: 'res-1',
    groupId: 'group-1',
    name: 'Conference Room A',
    description: 'Main Room',
    capacity: 1,
    slotDurationMinutes: 60,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTask = {
    id: 'task-1',
    resourceId: 'res-1',
    groupId: 'group-1',
    title: 'AC Servicing',
    description: 'Annual servicing',
    status: MaintenanceStatus.SCHEDULED,
    recurrenceType: RecurrenceType.NONE,
    dayOfWeek: null,
    startTimeOfDay: null,
    endTimeOfDay: null,
    startTime: new Date('2026-10-25T10:00:00.000Z'),
    endTime: new Date('2026-10-25T14:00:00.000Z'),
    createdById: 'user-admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    resource: { name: 'Conference Room A' },
    createdBy: { displayName: 'Admin User' },
  };

  beforeEach(async () => {
    const mockPrisma = {
      resource: {
        findFirst: jest.fn(),
      },
      booking: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      groupMember: {
        findUnique: jest.fn(),
      },
      maintenanceTask: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
    prismaService = module.get(PrismaService);
  });

  describe('createMaintenanceTask', () => {
    it('should throw NotFoundException if resource does not exist', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createMaintenanceTask('group-1', 'res-1', 'user-1', {
          title: 'Cleaning',
          startTime: '2026-10-25T10:00:00.000Z',
          endTime: '2026-10-25T12:00:00.000Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if endTime <= startTime', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );

      await expect(
        service.createMaintenanceTask('group-1', 'res-1', 'user-1', {
          title: 'Cleaning',
          startTime: '2026-10-25T12:00:00.000Z',
          endTime: '2026-10-25T10:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if conflicting bookings exist and cancelConflictingBookings is false', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'booking-1',
          resourceId: 'res-1',
          userId: 'user-2',
          startTime: new Date('2026-10-25T11:00:00.000Z'),
          endTime: new Date('2026-10-25T12:00:00.000Z'),
          status: BookingStatus.CONFIRMED,
          user: { displayName: 'John Doe' },
        },
      ]);

      await expect(
        service.createMaintenanceTask('group-1', 'res-1', 'user-1', {
          title: 'AC Servicing',
          startTime: '2026-10-25T10:00:00.000Z',
          endTime: '2026-10-25T14:00:00.000Z',
          cancelConflictingBookings: false,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should cancel conflicting bookings and create task if cancelConflictingBookings is true', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'booking-1',
          resourceId: 'res-1',
          userId: 'user-2',
          startTime: new Date('2026-10-25T11:00:00.000Z'),
          endTime: new Date('2026-10-25T12:00:00.000Z'),
          status: BookingStatus.CONFIRMED,
          user: { displayName: 'John Doe' },
        },
      ]);

      const tx = {
        booking: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        maintenanceTask: {
          create: jest.fn().mockResolvedValue(mockTask),
        },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(tx),
      );

      const result = await service.createMaintenanceTask(
        'group-1',
        'res-1',
        'user-admin',
        {
          title: 'AC Servicing',
          startTime: '2026-10-25T10:00:00.000Z',
          endTime: '2026-10-25T14:00:00.000Z',
          cancelConflictingBookings: true,
        },
      );

      expect(tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['booking-1'] } },
        data: { status: BookingStatus.CANCELLED },
      });
      expect(result.cancelledBookingsCount).toBe(1);
      expect(result.id).toBe('task-1');
    });

    it('should create recurring weekly maintenance task when no conflicts', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);

      const weeklyTask = {
        ...mockTask,
        id: 'task-weekly',
        recurrenceType: RecurrenceType.WEEKLY,
        dayOfWeek: 1, // Monday
        startTimeOfDay: '09:00',
        endTimeOfDay: '11:00',
      };

      const tx = {
        booking: { updateMany: jest.fn() },
        maintenanceTask: { create: jest.fn().mockResolvedValue(weeklyTask) },
      };
      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(tx),
      );

      const result = await service.createMaintenanceTask(
        'group-1',
        'res-1',
        'user-admin',
        {
          title: 'Weekly Monday Clean',
          recurrenceType: RecurrenceType.WEEKLY,
          dayOfWeek: 1,
          startTimeOfDay: '09:00',
          endTimeOfDay: '11:00',
          startTime: '2026-10-01T00:00:00.000Z',
          endTime: '2026-12-31T23:59:59.000Z',
        },
      );

      expect(result.recurrenceType).toBe(RecurrenceType.WEEKLY);
      expect(result.dayOfWeek).toBe(1);
    });
  });

  describe('listMaintenanceTasks', () => {
    it('should list tasks filtered by resource and groupId', async () => {
      (prismaService.maintenanceTask.findMany as jest.Mock).mockResolvedValue([
        mockTask,
      ]);

      const tasks = await service.listMaintenanceTasks('group-1', 'res-1');
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-1');
      expect(tasks[0].resourceName).toBe('Conference Room A');
    });
  });

  describe('getMaintenanceTask', () => {
    it('should return task detail when found', async () => {
      (prismaService.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(
        mockTask,
      );

      const task = await service.getMaintenanceTask(
        'group-1',
        'res-1',
        'task-1',
      );
      expect(task.id).toBe('task-1');
      expect(task.title).toBe('AC Servicing');
    });

    it('should throw NotFoundException when task not found', async () => {
      (prismaService.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.getMaintenanceTask('group-1', 'res-1', 'unknown'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMaintenanceTask', () => {
    it('should update task details', async () => {
      (prismaService.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(
        mockTask,
      );
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.maintenanceTask.update as jest.Mock).mockResolvedValue({
        ...mockTask,
        status: MaintenanceStatus.IN_PROGRESS,
      });

      const updated = await service.updateMaintenanceTask(
        'group-1',
        'res-1',
        'task-1',
        {
          status: MaintenanceStatus.IN_PROGRESS,
        },
        'user-admin',
        GroupRole.ADMIN,
      );

      expect(updated.status).toBe(MaintenanceStatus.IN_PROGRESS);
    });

    it('should throw ForbiddenException if non-admin tries to update task assigned to someone else', async () => {
      (prismaService.maintenanceTask.findFirst as jest.Mock).mockResolvedValue({
        ...mockTask,
        assignedToId: 'user-bob',
      });

      await expect(
        service.updateMaintenanceTask(
          'group-1',
          'res-1',
          'task-1',
          { status: MaintenanceStatus.IN_PROGRESS },
          'user-charlie',
          GroupRole.MEMBER,
        ),
      ).rejects.toThrow();
    });

    it('should allow assigned non-admin member to update task status', async () => {
      (prismaService.maintenanceTask.findFirst as jest.Mock).mockResolvedValue({
        ...mockTask,
        assignedToId: 'user-bob',
      });
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.maintenanceTask.update as jest.Mock).mockResolvedValue({
        ...mockTask,
        assignedToId: 'user-bob',
        status: MaintenanceStatus.IN_PROGRESS,
      });

      const updated = await service.updateMaintenanceTask(
        'group-1',
        'res-1',
        'task-1',
        { status: MaintenanceStatus.IN_PROGRESS },
        'user-bob',
        GroupRole.MEMBER,
      );

      expect(updated.status).toBe(MaintenanceStatus.IN_PROGRESS);
    });

    it('should throw ForbiddenException if assigned non-admin member tries to edit fields other than status', async () => {
      (prismaService.maintenanceTask.findFirst as jest.Mock).mockResolvedValue({
        ...mockTask,
        assignedToId: 'user-bob',
      });

      await expect(
        service.updateMaintenanceTask(
          'group-1',
          'res-1',
          'task-1',
          { title: 'New Title' },
          'user-bob',
          GroupRole.MEMBER,
        ),
      ).rejects.toThrow();
    });

    it('should throw BadRequestException if new assignedToId is not a group member', async () => {
      (prismaService.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(
        mockTask,
      );
      (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.updateMaintenanceTask(
          'group-1',
          'res-1',
          'task-1',
          { assignedToId: 'non-member-user' },
          'user-admin',
          GroupRole.ADMIN,
        ),
      ).rejects.toThrow();
    });

    it('should throw BadRequestException if new assignedToId is a GUEST', async () => {
      (prismaService.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(
        mockTask,
      );
      (prismaService.groupMember.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-guest',
        role: GroupRole.GUEST,
      });

      await expect(
        service.updateMaintenanceTask(
          'group-1',
          'res-1',
          'task-1',
          { assignedToId: 'guest-user' },
          'user-admin',
          GroupRole.ADMIN,
        ),
      ).rejects.toThrow(new BadRequestException('cannot_assign_to_guest'));
    });
  });

  describe('deleteMaintenanceTask', () => {
    it('should delete task when found', async () => {
      (prismaService.maintenanceTask.findFirst as jest.Mock).mockResolvedValue(
        mockTask,
      );
      (prismaService.maintenanceTask.delete as jest.Mock).mockResolvedValue(
        mockTask,
      );

      const res = await service.deleteMaintenanceTask(
        'group-1',
        'res-1',
        'task-1',
      );
      expect(res.success).toBe(true);
    });
  });
});

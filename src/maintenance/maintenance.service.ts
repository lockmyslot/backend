import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { ListMaintenanceDto } from './dto/list-maintenance.dto';
import {
  MaintenanceStatus,
  RecurrenceType,
  BookingStatus,
  GroupRole,
  Prisma,
} from '@prisma/client';

export function formatUTCTime(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function isIntervalOverlappingMaintenance(
  intervalStart: Date,
  intervalEnd: Date,
  task: {
    recurrenceType: RecurrenceType;
    startTime: Date;
    endTime: Date;
    dayOfWeek?: number | null;
    startTimeOfDay?: string | null;
    endTimeOfDay?: string | null;
  },
): boolean {
  if (intervalStart >= task.endTime || intervalEnd <= task.startTime) {
    return false;
  }

  if (task.recurrenceType === RecurrenceType.NONE) {
    return true;
  }

  const day = intervalStart.getUTCDay();
  if (
    task.recurrenceType === RecurrenceType.WEEKLY &&
    task.dayOfWeek !== null &&
    task.dayOfWeek !== undefined &&
    day !== task.dayOfWeek
  ) {
    return false;
  }

  if (task.startTimeOfDay && task.endTimeOfDay) {
    const startStr = formatUTCTime(intervalStart);
    const endStr = formatUTCTime(intervalEnd);
    return startStr < task.endTimeOfDay && endStr > task.startTimeOfDay;
  }

  return true;
}

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createMaintenanceTask(
    groupId: string,
    resourceId: string,
    userId: string,
    dto: CreateMaintenanceDto,
  ) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, groupId },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found in this group');
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (endTime <= startTime) {
      throw new BadRequestException('end_time must be after start_time');
    }

    const recurrenceType = dto.recurrenceType ?? RecurrenceType.NONE;

    if (recurrenceType !== RecurrenceType.NONE) {
      if (!dto.startTimeOfDay || !dto.endTimeOfDay) {
        throw new BadRequestException(
          'start_time_of_day and end_time_of_day are required for recurring maintenance',
        );
      }
      if (dto.startTimeOfDay >= dto.endTimeOfDay) {
        throw new BadRequestException(
          'end_time_of_day must be after start_time_of_day',
        );
      }
      if (
        recurrenceType === RecurrenceType.WEEKLY &&
        dto.dayOfWeek === undefined
      ) {
        throw new BadRequestException(
          'day_of_week (0-6) is required for weekly recurrence',
        );
      }
    }

    if (dto.assignedToId) {
      const isMember = await this.prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: dto.assignedToId,
          },
        },
      });
      if (!isMember) {
        throw new BadRequestException(
          'Assigned user must be a member of this group',
        );
      }
    }

    // Check for conflicting confirmed bookings
    const potentialBookings = await this.prisma.booking.findMany({
      where: {
        resourceId,
        groupId,
        status: BookingStatus.CONFIRMED,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      include: {
        user: {
          select: { displayName: true },
        },
      },
    });

    const conflictingBookings = potentialBookings.filter((b) =>
      isIntervalOverlappingMaintenance(b.startTime, b.endTime, {
        recurrenceType,
        startTime,
        endTime,
        dayOfWeek: dto.dayOfWeek,
        startTimeOfDay: dto.startTimeOfDay,
        endTimeOfDay: dto.endTimeOfDay,
      }),
    );

    if (conflictingBookings.length > 0 && !dto.cancelConflictingBookings) {
      throw new ConflictException({
        message: 'conflicting_bookings_exist',
        details: conflictingBookings.map((b) => ({
          id: b.id,
          userId: b.userId,
          userName: b.user.displayName,
          startTime: b.startTime.toISOString(),
          endTime: b.endTime.toISOString(),
        })),
      });
    }

    return this.prisma.$transaction(async (tx) => {
      let cancelledBookingsCount = 0;
      if (conflictingBookings.length > 0 && dto.cancelConflictingBookings) {
        const conflictIds = conflictingBookings.map((b) => b.id);
        const updateResult = await tx.booking.updateMany({
          where: { id: { in: conflictIds } },
          data: { status: BookingStatus.CANCELLED },
        });
        cancelledBookingsCount = updateResult.count;
      }

      const task = await tx.maintenanceTask.create({
        data: {
          groupId,
          resourceId,
          title: dto.title,
          description: dto.description,
          status: MaintenanceStatus.SCHEDULED,
          recurrenceType,
          dayOfWeek: dto.dayOfWeek,
          startTimeOfDay: dto.startTimeOfDay,
          endTimeOfDay: dto.endTimeOfDay,
          startTime,
          endTime,
          createdById: userId,
          assignedToId: dto.assignedToId,
        },
        include: {
          resource: {
            select: { name: true },
          },
          createdBy: {
            select: { displayName: true },
          },
          assignedTo: {
            select: { id: true, displayName: true },
          },
        },
      });

      return {
        id: task.id,
        resourceId: task.resourceId,
        resourceName: task.resource.name,
        groupId: task.groupId,
        title: task.title,
        description: task.description,
        status: task.status,
        recurrenceType: task.recurrenceType,
        dayOfWeek: task.dayOfWeek,
        startTimeOfDay: task.startTimeOfDay,
        endTimeOfDay: task.endTimeOfDay,
        startTime: task.startTime,
        endTime: task.endTime,
        createdById: task.createdById,
        createdByName: task.createdBy.displayName,
        assignedToId: task.assignedToId,
        assignedToName: task.assignedTo?.displayName ?? null,
        assignedTo: task.assignedTo
          ? { id: task.assignedTo.id, displayName: task.assignedTo.displayName }
          : null,
        createdAt: task.createdAt,
        cancelledBookingsCount,
        cancelledBookings: conflictingBookings.map((b) => ({
          id: b.id,
          userName: b.user.displayName,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
      };
    });
  }

  async listMaintenanceTasks(
    groupId: string,
    resourceId?: string,
    query?: ListMaintenanceDto,
    currentUserId?: string,
  ) {
    const where: Prisma.MaintenanceTaskWhereInput = { groupId };

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.from) {
      where.endTime = { gte: new Date(query.from) };
    }

    if (query?.to) {
      where.startTime = { lte: new Date(query.to) };
    }

    if (query?.assignedToId) {
      where.assignedToId = query.assignedToId;
    } else if (query?.assignedToMe && currentUserId) {
      where.assignedToId = currentUserId;
    }

    const tasks = await this.prisma.maintenanceTask.findMany({
      where,
      include: {
        resource: {
          select: { name: true },
        },
        createdBy: {
          select: { displayName: true },
        },
        assignedTo: {
          select: { id: true, displayName: true },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return tasks.map((t) => ({
      id: t.id,
      resourceId: t.resourceId,
      resourceName: t.resource.name,
      groupId: t.groupId,
      title: t.title,
      description: t.description,
      status: t.status,
      recurrenceType: t.recurrenceType,
      dayOfWeek: t.dayOfWeek,
      startTimeOfDay: t.startTimeOfDay,
      endTimeOfDay: t.endTimeOfDay,
      startTime: t.startTime,
      endTime: t.endTime,
      createdById: t.createdById,
      createdByName: t.createdBy.displayName,
      assignedToId: t.assignedToId,
      assignedToName: t.assignedTo?.displayName ?? null,
      assignedTo: t.assignedTo
        ? { id: t.assignedTo.id, displayName: t.assignedTo.displayName }
        : null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async getMaintenanceTask(
    groupId: string,
    resourceId: string,
    taskId: string,
  ) {
    const task = await this.prisma.maintenanceTask.findFirst({
      where: { id: taskId, resourceId, groupId },
      include: {
        resource: {
          select: { name: true },
        },
        createdBy: {
          select: { displayName: true },
        },
        assignedTo: {
          select: { id: true, displayName: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Maintenance task not found');
    }

    return {
      id: task.id,
      resourceId: task.resourceId,
      resourceName: task.resource.name,
      groupId: task.groupId,
      title: task.title,
      description: task.description,
      status: task.status,
      recurrenceType: task.recurrenceType,
      dayOfWeek: task.dayOfWeek,
      startTimeOfDay: task.startTimeOfDay,
      endTimeOfDay: task.endTimeOfDay,
      startTime: task.startTime,
      endTime: task.endTime,
      createdById: task.createdById,
      createdByName: task.createdBy.displayName,
      assignedToId: task.assignedToId,
      assignedToName: task.assignedTo?.displayName ?? null,
      assignedTo: task.assignedTo
        ? { id: task.assignedTo.id, displayName: task.assignedTo.displayName }
        : null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  async updateMaintenanceTask(
    groupId: string,
    resourceId: string,
    taskId: string,
    dto: UpdateMaintenanceDto,
    currentUserId?: string,
    userRole?: GroupRole,
  ) {
    const existing = await this.prisma.maintenanceTask.findFirst({
      where: { id: taskId, resourceId, groupId },
    });

    if (!existing) {
      throw new NotFoundException('Maintenance task not found');
    }

    if (userRole && userRole !== GroupRole.ADMIN) {
      if (existing.assignedToId !== currentUserId) {
        throw new ForbiddenException(
          'Only admins or the assigned user can update this task',
        );
      }

      const hasOtherFields =
        dto.title !== undefined ||
        dto.description !== undefined ||
        dto.recurrenceType !== undefined ||
        dto.dayOfWeek !== undefined ||
        dto.startTimeOfDay !== undefined ||
        dto.endTimeOfDay !== undefined ||
        dto.startTime !== undefined ||
        dto.endTime !== undefined ||
        dto.assignedToId !== undefined;

      if (hasOtherFields) {
        throw new ForbiddenException(
          'Assigned members can only update task status',
        );
      }
    }

    let newAssignedToId = existing.assignedToId;
    if (dto.assignedToId !== undefined) {
      if (dto.assignedToId !== null) {
        const isMember = await this.prisma.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: dto.assignedToId,
            },
          },
        });
        if (!isMember) {
          throw new BadRequestException(
            'Assigned user must be a member of this group',
          );
        }
        newAssignedToId = dto.assignedToId;
      } else {
        newAssignedToId = null;
      }
    }

    const newStartTime = dto.startTime
      ? new Date(dto.startTime)
      : existing.startTime;
    const newEndTime = dto.endTime ? new Date(dto.endTime) : existing.endTime;

    if (newEndTime <= newStartTime) {
      throw new BadRequestException('end_time must be after start_time');
    }

    const recurrenceType = dto.recurrenceType ?? existing.recurrenceType;
    const dayOfWeek =
      dto.dayOfWeek !== undefined ? dto.dayOfWeek : existing.dayOfWeek;
    const startTimeOfDay =
      dto.startTimeOfDay !== undefined
        ? dto.startTimeOfDay
        : existing.startTimeOfDay;
    const endTimeOfDay =
      dto.endTimeOfDay !== undefined ? dto.endTimeOfDay : existing.endTimeOfDay;

    if (recurrenceType !== RecurrenceType.NONE) {
      if (!startTimeOfDay || !endTimeOfDay) {
        throw new BadRequestException(
          'start_time_of_day and end_time_of_day are required for recurring maintenance',
        );
      }
      if (startTimeOfDay >= endTimeOfDay) {
        throw new BadRequestException(
          'end_time_of_day must be after start_time_of_day',
        );
      }
      if (
        recurrenceType === RecurrenceType.WEEKLY &&
        dayOfWeek === null &&
        dayOfWeek === undefined
      ) {
        throw new BadRequestException(
          'day_of_week (0-6) is required for weekly recurrence',
        );
      }
    }

    // Check for conflicting confirmed bookings if active status
    const status = dto.status ?? existing.status;
    let cancelledBookingsCount = 0;

    if (
      status === MaintenanceStatus.SCHEDULED ||
      status === MaintenanceStatus.IN_PROGRESS
    ) {
      const potentialBookings = await this.prisma.booking.findMany({
        where: {
          resourceId,
          groupId,
          status: BookingStatus.CONFIRMED,
          startTime: { lt: newEndTime },
          endTime: { gt: newStartTime },
        },
        include: {
          user: {
            select: { displayName: true },
          },
        },
      });

      const conflictingBookings = potentialBookings.filter((b) =>
        isIntervalOverlappingMaintenance(b.startTime, b.endTime, {
          recurrenceType,
          startTime: newStartTime,
          endTime: newEndTime,
          dayOfWeek,
          startTimeOfDay,
          endTimeOfDay,
        }),
      );

      if (conflictingBookings.length > 0) {
        if (!dto.cancelConflictingBookings) {
          throw new ConflictException({
            message: 'conflicting_bookings_exist',
            details: conflictingBookings.map((b) => ({
              id: b.id,
              userId: b.userId,
              userName: b.user.displayName,
              startTime: b.startTime.toISOString(),
              endTime: b.endTime.toISOString(),
            })),
          });
        }

        const conflictIds = conflictingBookings.map((b) => b.id);
        const updateResult = await this.prisma.booking.updateMany({
          where: { id: { in: conflictIds } },
          data: { status: BookingStatus.CANCELLED },
        });
        cancelledBookingsCount = updateResult.count;
      }
    }

    const updated = await this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        title: dto.title ?? existing.title,
        description:
          dto.description !== undefined
            ? dto.description
            : existing.description,
        status,
        recurrenceType,
        dayOfWeek,
        startTimeOfDay,
        endTimeOfDay,
        startTime: newStartTime,
        endTime: newEndTime,
        assignedToId: newAssignedToId,
      },
      include: {
        resource: {
          select: { name: true },
        },
        createdBy: {
          select: { displayName: true },
        },
        assignedTo: {
          select: { id: true, displayName: true },
        },
      },
    });

    return {
      id: updated.id,
      resourceId: updated.resourceId,
      resourceName: updated.resource.name,
      groupId: updated.groupId,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      recurrenceType: updated.recurrenceType,
      dayOfWeek: updated.dayOfWeek,
      startTimeOfDay: updated.startTimeOfDay,
      endTimeOfDay: updated.endTimeOfDay,
      startTime: updated.startTime,
      endTime: updated.endTime,
      createdById: updated.createdById,
      createdByName: updated.createdBy.displayName,
      assignedToId: updated.assignedToId,
      assignedToName: updated.assignedTo?.displayName ?? null,
      assignedTo: updated.assignedTo
        ? { id: updated.assignedTo.id, displayName: updated.assignedTo.displayName }
        : null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      cancelledBookingsCount,
    };
  }

  async deleteMaintenanceTask(
    groupId: string,
    resourceId: string,
    taskId: string,
  ) {
    const existing = await this.prisma.maintenanceTask.findFirst({
      where: { id: taskId, resourceId, groupId },
    });

    if (!existing) {
      throw new NotFoundException('Maintenance task not found');
    }

    await this.prisma.maintenanceTask.delete({
      where: { id: taskId },
    });

    return { success: true };
  }
}

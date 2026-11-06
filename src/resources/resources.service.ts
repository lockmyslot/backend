import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { BookingStatus, GroupRole } from '@prisma/client';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveSlotDuration(dto: {
    slotDurationMinutes?: number;
    slotDuration?: number;
    slotDurationUnit?: 'minutes' | 'hours' | 'days';
  }): number | undefined {
    if (dto.slotDuration !== undefined && dto.slotDurationUnit !== undefined) {
      switch (dto.slotDurationUnit) {
        case 'hours':
          return dto.slotDuration * 60;
        case 'days':
          return dto.slotDuration * 1440;
        case 'minutes':
        default:
          return dto.slotDuration;
      }
    }
    return dto.slotDurationMinutes;
  }

  async createResource(groupId: string, dto: CreateResourceDto) {
    const slotDurationMinutes = this.resolveSlotDuration(dto);
    if (slotDurationMinutes === undefined) {
      throw new BadRequestException(
        'slot_duration_minutes or slot_duration and slot_duration_unit is required',
      );
    }

    if (slotDurationMinutes % 15 !== 0) {
      throw new BadRequestException(
        'slot_duration_minutes must be a multiple of 15',
      );
    }

    if (slotDurationMinutes < 15 || slotDurationMinutes > 43200) {
      throw new BadRequestException(
        'slot duration must be between 15 minutes and 30 days (43200 minutes)',
      );
    }

    const resource = await this.prisma.resource.create({
      data: {
        groupId,
        name: dto.name,
        description: dto.description,
        icon: dto.icon ? dto.icon.trim() : null,
        color: dto.color ? dto.color.trim() : null,
        capacity: dto.capacity,
        slotDurationMinutes,
        isActive: true,
      },
    });

    return {
      id: resource.id,
      groupId: resource.groupId,
      name: resource.name,
      description: resource.description,
      icon: resource.icon,
      color: resource.color,
      capacity: resource.capacity,
      slotDurationMinutes: resource.slotDurationMinutes,
      isActive: resource.isActive,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    };
  }

  async getResources(
    groupId: string,
    includeInactive = false,
    role?: GroupRole,
  ) {
    const allowInactive =
      includeInactive &&
      (role === GroupRole.ADMIN || role === GroupRole.MODERATOR);

    const resources = await this.prisma.resource.findMany({
      where: {
        groupId,
        ...(allowInactive ? {} : { isActive: true }),
      },
      include: {
        _count: {
          select: { bookingRules: true },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return resources.map((r) => ({
      id: r.id,
      groupId: r.groupId,
      name: r.name,
      description: r.description,
      icon: r.icon,
      color: r.color,
      capacity: r.capacity,
      slotDurationMinutes: r.slotDurationMinutes,
      isActive: r.isActive,
      rulesConfigured: r._count.bookingRules > 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getResourceDetails(groupId: string, resourceId: string) {
    const resource = await this.prisma.resource.findFirst({
      where: {
        id: resourceId,
        groupId,
      },
      include: {
        bookingRules: true,
      },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found in this group');
    }

    return {
      id: resource.id,
      groupId: resource.groupId,
      name: resource.name,
      description: resource.description,
      icon: resource.icon,
      color: resource.color,
      capacity: resource.capacity,
      slotDurationMinutes: resource.slotDurationMinutes,
      isActive: resource.isActive,
      bookingRules: resource.bookingRules.map((rule) => ({
        id: rule.id,
        dayScope: rule.dayScope,
        maxBookingsPerDay: rule.maxBookingsPerDay,
        maxHoursPerDay: rule.maxHoursPerDay,
        cooldownMinutes: rule.cooldownMinutes,
        minDurationMinutes: rule.minDurationMinutes,
        maxDurationMinutes: rule.maxDurationMinutes,
        maxAdvanceBookingDays: rule.maxAdvanceBookingDays,
        availableFrom: rule.availableFrom,
        availableUntil: rule.availableUntil,
      })),
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    };
  }

  async updateResource(
    groupId: string,
    resourceId: string,
    dto: UpdateResourceDto,
  ) {
    const slotDurationMinutes = this.resolveSlotDuration(dto);
    if (slotDurationMinutes !== undefined) {
      if (slotDurationMinutes % 15 !== 0) {
        throw new BadRequestException(
          'slot_duration_minutes must be a multiple of 15',
        );
      }
      if (slotDurationMinutes < 15 || slotDurationMinutes > 43200) {
        throw new BadRequestException(
          'slot duration must be between 15 minutes and 30 days (43200 minutes)',
        );
      }
    }

    const resourceExists = await this.prisma.resource.findFirst({
      where: { id: resourceId, groupId },
    });

    if (!resourceExists) {
      throw new NotFoundException('Resource not found in this group');
    }

    const updated = await this.prisma.resource.update({
      where: { id: resourceId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.icon !== undefined
          ? { icon: dto.icon && dto.icon.trim() ? dto.icon.trim() : null }
          : {}),
        ...(dto.color !== undefined
          ? { color: dto.color && dto.color.trim() ? dto.color.trim() : null }
          : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(slotDurationMinutes !== undefined ? { slotDurationMinutes } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return {
      id: updated.id,
      groupId: updated.groupId,
      name: updated.name,
      description: updated.description,
      icon: updated.icon,
      color: updated.color,
      capacity: updated.capacity,
      slotDurationMinutes: updated.slotDurationMinutes,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteResource(groupId: string, resourceId: string) {
    const resourceExists = await this.prisma.resource.findFirst({
      where: { id: resourceId, groupId },
    });

    if (!resourceExists) {
      throw new NotFoundException('Resource not found in this group');
    }

    // Soft-delete resource
    await this.prisma.resource.update({
      where: { id: resourceId },
      data: { isActive: false },
    });

    // Cancel all future CONFIRMED bookings on this resource
    await this.prisma.booking.updateMany({
      where: {
        resourceId,
        status: BookingStatus.CONFIRMED,
        startTime: {
          gt: new Date(),
        },
      },
      data: {
        status: BookingStatus.CANCELLED,
      },
    });
  }
}

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

  async createResource(groupId: string, dto: CreateResourceDto) {
    if (dto.slotDurationMinutes % 15 !== 0) {
      throw new BadRequestException(
        'slot_duration_minutes must be a multiple of 15',
      );
    }

    const resource = await this.prisma.resource.create({
      data: {
        groupId,
        name: dto.name,
        description: dto.description,
        capacity: dto.capacity,
        slotDurationMinutes: dto.slotDurationMinutes,
        isActive: true,
      },
    });

    return {
      id: resource.id,
      groupId: resource.groupId,
      name: resource.name,
      description: resource.description,
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
    const allowInactive = includeInactive && role === GroupRole.ADMIN;

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
    if (
      dto.slotDurationMinutes !== undefined &&
      dto.slotDurationMinutes % 15 !== 0
    ) {
      throw new BadRequestException(
        'slot_duration_minutes must be a multiple of 15',
      );
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
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.slotDurationMinutes !== undefined
          ? { slotDurationMinutes: dto.slotDurationMinutes }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return {
      id: updated.id,
      groupId: updated.groupId,
      name: updated.name,
      description: updated.description,
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

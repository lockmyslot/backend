import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from './rules.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { MyBookingsQueryDto } from './dto/my-bookings-query.dto';
import {
  BookingStatus,
  GroupRole,
  DayScope,
  MaintenanceStatus,
} from '@prisma/client';
import { isIntervalOverlappingMaintenance } from '../maintenance/maintenance.service';

const DAY_SCOPE_MAP: Record<number, DayScope> = {
  0: DayScope.SUNDAY,
  1: DayScope.MONDAY,
  2: DayScope.TUESDAY,
  3: DayScope.WEDNESDAY,
  4: DayScope.THURSDAY,
  5: DayScope.FRIDAY,
  6: DayScope.SATURDAY,
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesService: RulesService,
  ) {}

  async createBooking(
    groupId: string,
    resourceId: string,
    userId: string,
    dto: CreateBookingDto,
  ) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, groupId },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found in this group');
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    const membership = await this.prisma.groupMember?.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (membership?.role === GroupRole.GUEST && membership.expiresAt) {
      if (endTime > membership.expiresAt) {
        throw new BadRequestException('guest_booking_exceeds_expiration');
      }
    }

    // Validate rules
    const valResult = await this.rulesService.validate(
      resource,
      userId,
      groupId,
      startTime,
      endTime,
    );

    if (!valResult.allowed) {
      if (valResult.isCapacityError) {
        throw new ConflictException({
          message: 'slot_full',
          details: valResult.violations,
        });
      }
      throw new BadRequestException({
        message: 'booking_rule_violation',
        details: valResult.violations,
      });
    }

    // Atomic creation with capacity and maintenance re-verification
    return this.prisma.$transaction(async (tx) => {
      const activeMaintenance = await tx.maintenanceTask.findMany({
        where: {
          resourceId: resource.id,
          status: {
            in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS],
          },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      const isUnderMaintenance = activeMaintenance.some((task) =>
        isIntervalOverlappingMaintenance(startTime, endTime, task),
      );

      if (isUnderMaintenance) {
        throw new ConflictException({
          message: 'resource_under_maintenance',
          details: [
            'resource is under scheduled maintenance during this time slot',
          ],
        });
      }

      const overlapCount = await tx.booking.count({
        where: {
          resourceId: resource.id,
          status: BookingStatus.CONFIRMED,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      if (overlapCount >= resource.capacity) {
        throw new ConflictException({
          message: 'slot_full',
          details: [
            `resource capacity reached for this time slot (capacity: ${resource.capacity}, booked: ${overlapCount})`,
          ],
        });
      }

      const booking = await tx.booking.create({
        data: {
          resourceId: resource.id,
          userId,
          groupId,
          startTime,
          endTime,
          status: BookingStatus.CONFIRMED,
        },
      });

      return {
        id: booking.id,
        resourceId: booking.resourceId,
        resourceName: resource.name,
        resourceIcon: resource.icon,
        resourceColor: resource.color,
        userId: booking.userId,
        groupId: booking.groupId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        createdAt: booking.createdAt,
      };
    });
  }

  async getResourceBookings(
    groupId: string,
    resourceId: string,
    query: ListBookingsDto,
  ) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, groupId },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found in this group');
    }

    let fromDate: Date;
    let toDate: Date;

    if (query.date) {
      fromDate = new Date(`${query.date}T00:00:00.000Z`);
      toDate = new Date(`${query.date}T23:59:59.999Z`);
    } else {
      fromDate = query.from
        ? new Date(`${query.from}T00:00:00.000Z`)
        : new Date();
      if (query.to) {
        toDate = new Date(`${query.to}T23:59:59.999Z`);
      } else {
        toDate = new Date(fromDate);
        toDate.setUTCDate(toDate.getUTCDate() + 7);
        toDate.setUTCHours(23, 59, 59, 999);
      }
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        resourceId,
        status: BookingStatus.CONFIRMED,
        startTime: { gte: fromDate },
        endTime: { lte: toDate },
      },
      include: {
        user: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return bookings.map((b) => ({
      id: b.id,
      resourceId: b.resourceId,
      userId: b.userId,
      userDisplayName: b.user.displayName,
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      createdAt: b.createdAt,
    }));
  }

  async getAvailability(
    groupId: string,
    resourceId: string,
    userId: string,
    dateStr: string,
    excludeBookingId?: string,
  ) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, groupId },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found in this group');
    }

    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
    const utcDay = targetDate.getUTCDay();
    const dayName = DAY_SCOPE_MAP[utcDay];
    const dayGroup =
      utcDay === 0 || utcDay === 6 ? DayScope.WEEKEND : DayScope.WEEKDAY;

    const rule =
      (await this.prisma.bookingRule.findFirst({
        where: { resourceId: resource.id, dayScope: dayName },
      })) ??
      (await this.prisma.bookingRule.findFirst({
        where: { resourceId: resource.id, dayScope: dayGroup },
      }));

    const availableFrom = rule?.availableFrom ?? '00:00';
    const availableUntil = rule?.availableUntil ?? '24:00';

    const [fromH, fromM] = availableFrom.split(':').map(Number);
    let [untilH, untilM] = availableUntil.split(':').map(Number);
    if (availableUntil === '24:00') {
      untilH = 24;
      untilM = 0;
    }

    const startMinutes = fromH * 60 + fromM;
    const endMinutes = untilH * 60 + untilM;
    const slotDuration = resource.slotDurationMinutes;

    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(
      slotDuration >= 1440
        ? startOfDay.getTime() + slotDuration * 60 * 1000
        : `${dateStr}T23:59:59.999Z`,
    );

    // Existing bookings for resource on target date
    const dayBookings = await this.prisma.booking.findMany({
      where: {
        resourceId,
        status: BookingStatus.CONFIRMED,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        startTime: { lt: endOfDay },
        endTime: { gt: startOfDay },
      },
    });

    // Active maintenance tasks for resource on target date
    const dayMaintenanceTasks = await this.prisma.maintenanceTask.findMany({
      where: {
        resourceId,
        status: {
          in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS],
        },
        startTime: { lte: endOfDay },
        endTime: { gte: startOfDay },
      },
    });

    // User's bookings on target date
    const userDayBookings = dayBookings.filter((b) => b.userId === userId);
    const userHoursToday = userDayBookings.reduce(
      (sum, b) =>
        sum + (b.endTime.getTime() - b.startTime.getTime()) / (1000 * 60 * 60),
      0,
    );

    let lastBookingEnd: string | null = null;
    if (userDayBookings.length > 0) {
      const sorted = [...userDayBookings].sort(
        (a, b) => b.endTime.getTime() - a.endTime.getTime(),
      );
      lastBookingEnd = sorted[0].endTime.toISOString();
    }

    const slots: Array<{
      startTime: string;
      endTime: string;
      status: string;
      booked: number;
      capacity: number;
    }> = [];

    if (slotDuration >= 1440) {
      const sH = fromH.toString().padStart(2, '0');
      const sM = fromM.toString().padStart(2, '0');
      const slotStart = new Date(`${dateStr}T${sH}:${sM}:00.000Z`);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000);
      const slotStartISO = slotStart.toISOString();
      const slotEndISO = slotEnd.toISOString();

      const bookedCount = dayBookings.filter(
        (b) => b.startTime < slotEnd && b.endTime > slotStart,
      ).length;

      const isMaintenance = dayMaintenanceTasks.some((task) =>
        isIntervalOverlappingMaintenance(slotStart, slotEnd, task),
      );

      let status = 'available';

      if (isMaintenance) {
        status = 'maintenance';
      } else if (bookedCount >= resource.capacity) {
        status = 'full';
      } else if (rule?.cooldownMinutes && userDayBookings.length > 0) {
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        const violatesCooldown = userDayBookings.some((b) => {
          const gapAfterPrev = slotStart.getTime() - b.endTime.getTime();
          const gapBeforeNext = b.startTime.getTime() - slotEnd.getTime();

          return (
            (gapAfterPrev >= 0 && gapAfterPrev < cooldownMs) ||
            (gapBeforeNext >= 0 && gapBeforeNext < cooldownMs)
          );
        });

        if (violatesCooldown) {
          status = 'cooldown';
        }
      }

      slots.push({
        startTime: slotStartISO,
        endTime: slotEndISO,
        status,
        booked: bookedCount,
        capacity: resource.capacity,
      });
    } else {
      for (
        let m = startMinutes;
        m + slotDuration <= endMinutes;
        m += slotDuration
      ) {
        const sH = Math.floor(m / 60)
          .toString()
          .padStart(2, '0');
        const sM = (m % 60).toString().padStart(2, '0');
        const slotStart = new Date(`${dateStr}T${sH}:${sM}:00.000Z`);
        const slotEnd = new Date(
          slotStart.getTime() + slotDuration * 60 * 1000,
        );
        const slotStartISO = slotStart.toISOString();
        const slotEndISO = slotEnd.toISOString();

        const bookedCount = dayBookings.filter(
          (b) => b.startTime < slotEnd && b.endTime > slotStart,
        ).length;

        const isMaintenance = dayMaintenanceTasks.some((task) =>
          isIntervalOverlappingMaintenance(slotStart, slotEnd, task),
        );

        let status = 'available';

        if (isMaintenance) {
          status = 'maintenance';
        } else if (bookedCount >= resource.capacity) {
          status = 'full';
        } else if (rule?.cooldownMinutes && userDayBookings.length > 0) {
          const cooldownMs = rule.cooldownMinutes * 60 * 1000;
          const violatesCooldown = userDayBookings.some((b) => {
            const gapAfterPrev = slotStart.getTime() - b.endTime.getTime();
            const gapBeforeNext = b.startTime.getTime() - slotEnd.getTime();

            return (
              (gapAfterPrev >= 0 && gapAfterPrev < cooldownMs) ||
              (gapBeforeNext >= 0 && gapBeforeNext < cooldownMs)
            );
          });

          if (violatesCooldown) {
            status = 'cooldown';
          }
        }

        slots.push({
          startTime: slotStartISO,
          endTime: slotEndISO,
          status,
          booked: bookedCount,
          capacity: resource.capacity,
        });
      }
    }

    return {
      date: dateStr,
      resourceId: resource.id,
      slotDurationMinutes: resource.slotDurationMinutes,
      availableFrom,
      availableUntil,
      userStats: {
        bookingsToday: userDayBookings.length,
        hoursToday: userHoursToday,
        maxBookingsPerDay: rule?.maxBookingsPerDay ?? null,
        maxHoursPerDay: rule?.maxHoursPerDay ?? null,
        cooldownMinutes: rule?.cooldownMinutes ?? null,
        lastBookingEnd,
      },
      slots,
    };
  }

  async cancelBooking(
    groupId: string,
    bookingId: string,
    userId: string,
    userRole: GroupRole,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, groupId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found in this group');
    }

    if (
      booking.userId !== userId &&
      userRole !== GroupRole.ADMIN &&
      userRole !== GroupRole.MODERATOR
    ) {
      throw new ForbiddenException('Not authorized to cancel this booking');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('booking_already_cancelled');
    }

    if (booking.startTime.getTime() <= new Date().getTime()) {
      throw new BadRequestException('cannot_cancel_past_booking');
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  async rescheduleBooking(
    groupId: string,
    bookingId: string,
    userId: string,
    userRole: GroupRole,
    dto: RescheduleBookingDto,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, groupId },
      include: { resource: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found in this group');
    }

    if (booking.userId !== userId && userRole !== GroupRole.ADMIN) {
      throw new ForbiddenException('Not authorized to reschedule this booking');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('cannot_reschedule_cancelled_booking');
    }

    if (booking.startTime.getTime() <= new Date().getTime()) {
      throw new BadRequestException('cannot_reschedule_past_booking');
    }

    const resource = booking.resource;
    if (!resource || !resource.isActive) {
      throw new BadRequestException('resource is inactive');
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    const membership = await this.prisma.groupMember?.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (membership?.role === GroupRole.GUEST && membership.expiresAt) {
      if (endTime > membership.expiresAt) {
        throw new BadRequestException('guest_booking_exceeds_expiration');
      }
    }

    // Validate rules, excluding this booking from counts/cooldown/overlap
    const valResult = await this.rulesService.validate(
      resource,
      booking.userId,
      groupId,
      startTime,
      endTime,
      booking.id,
    );

    if (!valResult.allowed) {
      if (valResult.isCapacityError) {
        throw new ConflictException({
          message: 'slot_full',
          details: valResult.violations,
        });
      }
      throw new BadRequestException({
        message: 'booking_rule_violation',
        details: valResult.violations,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const activeMaintenance = await tx.maintenanceTask.findMany({
        where: {
          resourceId: resource.id,
          status: {
            in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS],
          },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      const isUnderMaintenance = activeMaintenance.some((task) =>
        isIntervalOverlappingMaintenance(startTime, endTime, task),
      );

      if (isUnderMaintenance) {
        throw new ConflictException({
          message: 'resource_under_maintenance',
          details: [
            'resource is under scheduled maintenance during this time slot',
          ],
        });
      }

      const overlapCount = await tx.booking.count({
        where: {
          resourceId: resource.id,
          id: { not: booking.id },
          status: BookingStatus.CONFIRMED,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      if (overlapCount >= resource.capacity) {
        throw new ConflictException({
          message: 'slot_full',
          details: [
            `resource capacity reached for this time slot (capacity: ${resource.capacity}, booked: ${overlapCount})`,
          ],
        });
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          startTime,
          endTime,
          status: BookingStatus.CONFIRMED,
        },
        include: {
          resource: true,
          user: true,
        },
      });

      return {
        id: updated.id,
        resourceId: updated.resourceId,
        resourceName: updated.resource.name,
        resourceIcon: updated.resource.icon,
        resourceColor: updated.resource.color,
        userId: updated.userId,
        userDisplayName: updated.user?.displayName,
        groupId: updated.groupId,
        startTime: updated.startTime,
        endTime: updated.endTime,
        status: updated.status,
        createdAt: updated.createdAt,
      };
    });
  }

  async getMyBookings(
    groupId: string,
    userId: string,
    query: MyBookingsQueryDto,
  ) {
    const fromDate = query.from
      ? new Date(`${query.from}T00:00:00.000Z`)
      : new Date();
    let toDate: Date;

    if (query.to) {
      toDate = new Date(`${query.to}T23:59:59.999Z`);
    } else {
      toDate = new Date(fromDate);
      toDate.setUTCDate(toDate.getUTCDate() + 30);
      toDate.setUTCHours(23, 59, 59, 999);
    }

    const statusFilter = query.status || BookingStatus.CONFIRMED;

    const bookings = await this.prisma.booking.findMany({
      where: {
        groupId,
        userId,
        status: statusFilter,
        startTime: { gte: fromDate, lte: toDate },
      },
      include: {
        resource: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return bookings.map((b) => ({
      id: b.id,
      resourceId: b.resourceId,
      resourceName: b.resource.name,
      resourceIcon: b.resource.icon,
      resourceColor: b.resource.color,
      userId: b.userId,
      groupId: b.groupId,
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      createdAt: b.createdAt,
    }));
  }
}

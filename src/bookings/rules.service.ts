import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Resource,
  DayScope,
  BookingStatus,
  MaintenanceStatus,
} from '@prisma/client';
import { isIntervalOverlappingMaintenance } from '../maintenance/maintenance.service';

export interface ValidationResult {
  allowed: boolean;
  violations: string[];
  isCapacityError: boolean;
}

const DAY_SCOPE_MAP: Record<number, DayScope> = {
  0: DayScope.SUNDAY,
  1: DayScope.MONDAY,
  2: DayScope.TUESDAY,
  3: DayScope.WEDNESDAY,
  4: DayScope.THURSDAY,
  5: DayScope.FRIDAY,
  6: DayScope.SATURDAY,
};

function formatUTCTime(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(
    resource: Resource,
    userId: string,
    groupId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string,
  ): Promise<ValidationResult> {
    const violations: string[] = [];
    const now = new Date();

    const duration = Math.round(
      (endTime.getTime() - startTime.getTime()) / (1000 * 60),
    );

    // ── 1. BASIC CHECKS ──
    if (duration <= 0) {
      return {
        allowed: false,
        violations: ['end_time must be after start_time'],
        isCapacityError: false,
      };
    }

    if (!resource.isActive) {
      return {
        allowed: false,
        violations: ['resource is inactive'],
        isCapacityError: false,
      };
    }

    if (startTime.getTime() <= now.getTime()) {
      violations.push('start_time must be in the future');
    }

    if (duration % resource.slotDurationMinutes !== 0) {
      violations.push(
        `duration must be a multiple of slot_duration_minutes (${resource.slotDurationMinutes})`,
      );
    }

    // ── Check Maintenance ──
    const maintenanceTasks = await this.prisma.maintenanceTask.findMany({
      where: {
        resourceId: resource.id,
        status: {
          in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS],
        },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    const isUnderMaintenance = maintenanceTasks.some((task) =>
      isIntervalOverlappingMaintenance(startTime, endTime, task),
    );

    if (isUnderMaintenance) {
      violations.push('resource_under_maintenance');
    }

    // ── 2. RULE RESOLUTION ──
    const utcDay = startTime.getUTCDay();
    const dayName = DAY_SCOPE_MAP[utcDay];
    const dayGroup =
      utcDay === 0 || utcDay === 6 ? DayScope.WEEKEND : DayScope.WEEKDAY;

    // Day-specific rule takes precedence over Day-group rule
    const rule =
      (await this.prisma.bookingRule.findFirst({
        where: { resourceId: resource.id, dayScope: dayName },
      })) ??
      (await this.prisma.bookingRule.findFirst({
        where: { resourceId: resource.id, dayScope: dayGroup },
      }));

    if (rule) {
      // ── 3. AVAILABILITY WINDOW ──
      if (rule.availableFrom && rule.availableUntil) {
        const [fromH, fromM] = rule.availableFrom.split(':').map(Number);
        let [untilH, untilM] = rule.availableUntil.split(':').map(Number);
        if (rule.availableUntil === '24:00') {
          untilH = 24;
          untilM = 0;
        }
        const availStart = fromH * 60 + fromM;
        const availEnd = untilH * 60 + untilM;

        const bookingStartM =
          startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
        let bookingEndM =
          endTime.getUTCHours() * 60 + endTime.getUTCMinutes();
        if (
          bookingEndM === 0 &&
          endTime.getUTCDate() !== startTime.getUTCDate()
        ) {
          bookingEndM = 1440;
        }

        if (bookingStartM < availStart) {
          violations.push(
            `starts before available_from (${rule.availableFrom})`,
          );
        }
        if (bookingEndM > availEnd) {
          violations.push(
            `ends after available_until (${rule.availableUntil})`,
          );
        }
      }

      // ── 4. DURATION LIMITS ──
      if (rule.minDurationMinutes && duration < rule.minDurationMinutes) {
        violations.push(
          `duration ${duration}min < min_duration ${rule.minDurationMinutes}min`,
        );
      }

      if (rule.maxDurationMinutes && duration > rule.maxDurationMinutes) {
        violations.push(
          `duration ${duration}min > max_duration ${rule.maxDurationMinutes}min`,
        );
      }

      // ── 5. ADVANCE BOOKING ──
      if (rule.maxAdvanceBookingDays) {
        const diffMs = startTime.getTime() - now.getTime();
        const daysAhead = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (daysAhead > rule.maxAdvanceBookingDays) {
          violations.push(
            `booking is ${daysAhead} days ahead, max allowed is ${rule.maxAdvanceBookingDays}`,
          );
        }
      }

      // ── 6. DAILY BOOKING COUNT ──
      const startOfDay = new Date(startTime);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const endOfDay = new Date(startTime);
      endOfDay.setUTCHours(23, 59, 59, 999);

      if (rule.maxBookingsPerDay) {
        const todayBookings = await this.prisma.booking.count({
          where: {
            resourceId: resource.id,
            userId,
            status: BookingStatus.CONFIRMED,
            ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
            startTime: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });

        if (todayBookings >= rule.maxBookingsPerDay) {
          violations.push(
            `exceeds max_bookings_per_day (limit: ${rule.maxBookingsPerDay}, current: ${todayBookings})`,
          );
        }
      }

      // ── 7. DAILY HOURS ──
      if (rule.maxHoursPerDay) {
        const todayConfirmedBookings = await this.prisma.booking.findMany({
          where: {
            resourceId: resource.id,
            userId,
            status: BookingStatus.CONFIRMED,
            ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
            startTime: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });

        const todayHours = todayConfirmedBookings.reduce((sum, b) => {
          const bDuration =
            (b.endTime.getTime() - b.startTime.getTime()) / (1000 * 60 * 60);
          return sum + bDuration;
        }, 0);

        if (todayHours + duration / 60 > rule.maxHoursPerDay) {
          violations.push(
            `max_hours_per_day would be exceeded (${
              todayHours + duration / 60
            } > ${rule.maxHoursPerDay})`,
          );
        }
      }

      // ── 8. COOLDOWN ──
      if (rule.cooldownMinutes) {
        const nearestBefore = await this.prisma.booking.findFirst({
          where: {
            resourceId: resource.id,
            userId,
            status: BookingStatus.CONFIRMED,
            ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
            endTime: {
              lte: startTime,
            },
          },
          orderBy: {
            endTime: 'desc',
          },
        });

        const nearestAfter = await this.prisma.booking.findFirst({
          where: {
            resourceId: resource.id,
            userId,
            status: BookingStatus.CONFIRMED,
            ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
            startTime: {
              gte: endTime,
            },
          },
          orderBy: {
            startTime: 'asc',
          },
        });

        if (nearestBefore) {
          const diffMin = Math.round(
            (startTime.getTime() - nearestBefore.endTime.getTime()) /
              (1000 * 60),
          );
          if (diffMin < rule.cooldownMinutes) {
            violations.push(
              `cooldown: ${rule.cooldownMinutes}min required after previous booking ending at ${nearestBefore.endTime.toISOString()}`,
            );
          }
        }

        if (nearestAfter) {
          const diffMin = Math.round(
            (nearestAfter.startTime.getTime() - endTime.getTime()) /
              (1000 * 60),
          );
          if (diffMin < rule.cooldownMinutes) {
            violations.push(
              `cooldown: ${rule.cooldownMinutes}min required before next booking starting at ${nearestAfter.startTime.toISOString()}`,
            );
          }
        }
      }
    }

    // ── 9. CAPACITY CHECK ──
    const overlappingCount = await this.prisma.booking.count({
      where: {
        resourceId: resource.id,
        status: BookingStatus.CONFIRMED,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        startTime: {
          lt: endTime,
        },
        endTime: {
          gt: startTime,
        },
      },
    });

    if (overlappingCount >= resource.capacity) {
      if (violations.length === 0) {
        return {
          allowed: false,
          violations: [
            `resource capacity reached for this time slot (capacity: ${resource.capacity}, booked: ${overlappingCount})`,
          ],
          isCapacityError: true,
        };
      }
      violations.push('slot_full');
    }

    return {
      allowed: violations.length === 0,
      violations,
      isCapacityError: false,
    };
  }
}

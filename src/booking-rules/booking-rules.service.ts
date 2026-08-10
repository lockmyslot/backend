import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingRuleItemDto } from './dto/booking-rule-item.dto';

@Injectable()
export class BookingRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async getRules(groupId: string, resourceId: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, groupId },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found in this group');
    }

    const rules = await this.prisma.bookingRule.findMany({
      where: { resourceId },
      orderBy: { dayScope: 'asc' },
    });

    return rules.map((r) => ({
      id: r.id,
      dayScope: r.dayScope,
      maxBookingsPerDay: r.maxBookingsPerDay,
      maxHoursPerDay: r.maxHoursPerDay,
      cooldownMinutes: r.cooldownMinutes,
      minDurationMinutes: r.minDurationMinutes,
      maxDurationMinutes: r.maxDurationMinutes,
      maxAdvanceBookingDays: r.maxAdvanceBookingDays,
      availableFrom: r.availableFrom,
      availableUntil: r.availableUntil,
    }));
  }

  async upsertRules(
    groupId: string,
    resourceId: string,
    rules: BookingRuleItemDto[],
  ) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, groupId },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found in this group');
    }

    // Validation
    const seenScopes = new Set<string>();
    for (const rule of rules) {
      if (seenScopes.has(rule.dayScope)) {
        throw new BadRequestException(`duplicate_day_scope: ${rule.dayScope}`);
      }
      seenScopes.add(rule.dayScope);

      if (rule.availableFrom && rule.availableUntil) {
        if (rule.availableFrom >= rule.availableUntil) {
          throw new BadRequestException(
            'available_until must be after available_from',
          );
        }
      }

      if (
        rule.minDurationMinutes !== undefined &&
        rule.maxDurationMinutes !== undefined
      ) {
        if (rule.minDurationMinutes > rule.maxDurationMinutes) {
          throw new BadRequestException(
            'min_duration_minutes must be less than or equal to max_duration_minutes',
          );
        }
      }

      if (
        rule.minDurationMinutes !== undefined &&
        rule.minDurationMinutes < resource.slotDurationMinutes
      ) {
        throw new BadRequestException(
          `min_duration_minutes must be greater than or equal to resource slot_duration_minutes (${resource.slotDurationMinutes})`,
        );
      }
    }

    // Transaction: replace all existing rules atomically
    const createdRules = await this.prisma.$transaction(async (tx) => {
      await tx.bookingRule.deleteMany({
        where: { resourceId },
      });

      if (rules.length === 0) {
        return [];
      }

      await tx.bookingRule.createMany({
        data: rules.map((r) => ({
          resourceId,
          dayScope: r.dayScope,
          maxBookingsPerDay: r.maxBookingsPerDay ?? null,
          maxHoursPerDay: r.maxHoursPerDay ?? null,
          cooldownMinutes: r.cooldownMinutes ?? null,
          minDurationMinutes: r.minDurationMinutes ?? null,
          maxDurationMinutes: r.maxDurationMinutes ?? null,
          maxAdvanceBookingDays: r.maxAdvanceBookingDays ?? null,
          availableFrom: r.availableFrom ?? null,
          availableUntil: r.availableUntil ?? null,
        })),
      });

      return tx.bookingRule.findMany({
        where: { resourceId },
        orderBy: { dayScope: 'asc' },
      });
    });

    return createdRules.map((r) => ({
      id: r.id,
      dayScope: r.dayScope,
      maxBookingsPerDay: r.maxBookingsPerDay,
      maxHoursPerDay: r.maxHoursPerDay,
      cooldownMinutes: r.cooldownMinutes,
      minDurationMinutes: r.minDurationMinutes,
      maxDurationMinutes: r.maxDurationMinutes,
      maxAdvanceBookingDays: r.maxAdvanceBookingDays,
      availableFrom: r.availableFrom,
      availableUntil: r.availableUntil,
    }));
  }
}

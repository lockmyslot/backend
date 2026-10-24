import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaClient, GroupRole, DayScope, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.booking.deleteMany();
  await prisma.bookingRule.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const defaultPasswordHash = bcrypt.hashSync('password123', 10);

  const alice = await prisma.user.create({
    data: {
      id: '11111111-1111-4111-a111-111111111111',
      username: 'alice',
      passwordHash: defaultPasswordHash,
      displayName: 'Alice',
      authToken: '11111111-1111-1111-1111-111111111111',
    },
  });

  const bob = await prisma.user.create({
    data: {
      id: '22222222-2222-4222-a222-222222222222',
      username: 'bob',
      passwordHash: defaultPasswordHash,
      displayName: 'Bob',
      authToken: '22222222-2222-2222-2222-222222222222',
    },
  });

  console.log(`Created users: ${alice.displayName} (@${alice.username}), ${bob.displayName} (@${bob.username})`);

  // Create Group
  const group = await prisma.group.create({
    data: {
      id: '33333333-3333-4333-a333-333333333333',
      name: 'Roommates',
      inviteCode: 'ROOM12',
      createdById: alice.id,
      members: {
        create: [
          {
            userId: alice.id,
            role: GroupRole.ADMIN,
          },
          {
            userId: bob.id,
            role: GroupRole.MEMBER,
          },
        ],
      },
    },
  });

  console.log(`Created group: ${group.name} (${group.inviteCode})`);

  // Create Resources
  const washingMachine = await prisma.resource.create({
    data: {
      id: '44444444-4444-4444-a444-444444444444',
      groupId: group.id,
      name: 'Washing Machine',
      description: 'Shared laundry washing machine',
      capacity: 1,
      slotDurationMinutes: 60,
      isActive: true,
      bookingRules: {
        create: [
          {
            dayScope: DayScope.WEEKDAY,
            maxBookingsPerDay: 2,
            maxHoursPerDay: 3,
            cooldownMinutes: 60,
            minDurationMinutes: 60,
            maxDurationMinutes: 120,
            maxAdvanceBookingDays: 7,
            availableFrom: '08:00',
            availableUntil: '22:00',
          },
          {
            dayScope: DayScope.WEEKEND,
            maxBookingsPerDay: 3,
            maxHoursPerDay: 4,
            cooldownMinutes: 30,
            minDurationMinutes: 60,
            maxDurationMinutes: 180,
            maxAdvanceBookingDays: 3,
            availableFrom: '09:00',
            availableUntil: '23:00',
          },
        ],
      },
    },
  });

  const kitchen = await prisma.resource.create({
    data: {
      id: '55555555-5555-4555-a555-555555555555',
      groupId: group.id,
      name: 'Kitchen',
      description: 'Main kitchen stove & oven',
      capacity: 2,
      slotDurationMinutes: 30,
      isActive: true,
      bookingRules: {
        create: [
          {
            dayScope: DayScope.WEEKDAY,
            maxBookingsPerDay: 2,
            maxHoursPerDay: 2,
            availableFrom: '07:00',
            availableUntil: '22:00',
          },
          {
            dayScope: DayScope.WEEKEND,
            maxBookingsPerDay: 3,
            maxHoursPerDay: 3,
            availableFrom: '08:00',
            availableUntil: '23:00',
          },
        ],
      },
    },
  });

  console.log(`Created resources: ${washingMachine.name}, ${kitchen.name}`);

  // Create sample booking for tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(11, 0, 0, 0);

  const booking = await prisma.booking.create({
    data: {
      id: '66666666-6666-4666-a666-666666666666',
      resourceId: washingMachine.id,
      userId: alice.id,
      groupId: group.id,
      startTime: tomorrow,
      endTime: tomorrowEnd,
      status: BookingStatus.CONFIRMED,
    },
  });

  console.log(`Created sample booking: ${booking.id}`);
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

describe('BookingsController', () => {
  let controller: BookingsController;
  let bookingsService: jest.Mocked<BookingsService>;

  beforeEach(() => {
    bookingsService = {
      createBooking: jest.fn(),
      getResourceBookings: jest.fn(),
      getAvailability: jest.fn(),
      getMyBookings: jest.fn(),
      cancelBooking: jest.fn(),
      rescheduleBooking: jest.fn(),
    } as any;
    controller = new BookingsController(bookingsService);
  });

  it('should delegate createBooking', async () => {
    const dto = {
      startTime: '2026-08-11T09:00:00Z',
      endTime: '2026-08-11T10:00:00Z',
    };
    bookingsService.createBooking.mockResolvedValue({ id: 'booking-1' } as any);

    const result = await controller.createBooking(
      'group-1',
      'res-1',
      { id: 'user-1' } as any,
      dto,
    );
    expect(bookingsService.createBooking).toHaveBeenCalledWith(
      'group-1',
      'res-1',
      'user-1',
      dto,
    );
    expect(result).toHaveProperty('id', 'booking-1');
  });

  it('should delegate getResourceBookings', async () => {
    bookingsService.getResourceBookings.mockResolvedValue([]);

    const result = await controller.getResourceBookings('group-1', 'res-1', {});
    expect(bookingsService.getResourceBookings).toHaveBeenCalledWith(
      'group-1',
      'res-1',
      {},
    );
    expect(result).toEqual([]);
  });

  it('should delegate getAvailability with user id and date', async () => {
    bookingsService.getAvailability.mockResolvedValue({ slots: [] } as any);

    const result = await controller.getAvailability(
      'group-1',
      'res-1',
      { id: 'user-1' } as any,
      { date: '2026-08-11', excludeBookingId: 'booking-1' },
    );
    expect(bookingsService.getAvailability).toHaveBeenCalledWith(
      'group-1',
      'res-1',
      'user-1',
      '2026-08-11',
      'booking-1',
    );
    expect(result).toHaveProperty('slots');
  });

  it('should delegate getMyBookings', async () => {
    bookingsService.getMyBookings.mockResolvedValue([]);

    const result = await controller.getMyBookings(
      'group-1',
      { id: 'user-1' } as any,
      {},
    );
    expect(bookingsService.getMyBookings).toHaveBeenCalledWith(
      'group-1',
      'user-1',
      {},
    );
    expect(result).toEqual([]);
  });

  it('should delegate rescheduleBooking with role and dto', async () => {
    const dto = {
      startTime: '2026-08-12T10:00:00Z',
      endTime: '2026-08-12T11:00:00Z',
    };
    bookingsService.rescheduleBooking.mockResolvedValue({
      id: 'booking-1',
      startTime: new Date('2026-08-12T10:00:00Z'),
    } as any);

    const result = await controller.rescheduleBooking(
      'group-1',
      'booking-1',
      { id: 'user-1' } as any,
      { groupMember: { role: 'ADMIN' } } as any,
      dto,
    );
    expect(bookingsService.rescheduleBooking).toHaveBeenCalledWith(
      'group-1',
      'booking-1',
      'user-1',
      'ADMIN',
      dto,
    );
    expect(result).toHaveProperty('id', 'booking-1');
  });

  it('should delegate cancelBooking with the group member role', async () => {
    bookingsService.cancelBooking.mockResolvedValue(undefined);

    await controller.cancelBooking(
      'group-1',
      'booking-1',
      { id: 'user-1' } as any,
      { groupMember: { role: 'ADMIN' } } as any,
    );
    expect(bookingsService.cancelBooking).toHaveBeenCalledWith(
      'group-1',
      'booking-1',
      'user-1',
      'ADMIN',
    );
  });
});

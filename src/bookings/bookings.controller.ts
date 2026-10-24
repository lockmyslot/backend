import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { MyBookingsQueryDto } from './dto/my-bookings-query.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { GroupMemberGuard } from '../groups/guards/group-member.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Bookings')
@Controller('groups/:group_id')
@UseGuards(AuthGuard, GroupMemberGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('resources/:resource_id/bookings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new booking after rule and capacity validation',
  })
  @ApiResponse({ status: 201, description: 'Booking created' })
  @ApiResponse({ status: 400, description: 'booking_rule_violation' })
  @ApiResponse({ status: 409, description: 'slot_full' })
  async createBooking(
    @Param('group_id') groupId: string,
    @Param('resource_id') resourceId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(
      groupId,
      resourceId,
      user.id,
      dto,
    );
  }

  @Get('resources/:resource_id/bookings')
  @ApiOperation({ summary: 'List bookings for a resource' })
  @ApiResponse({ status: 200, description: 'List of bookings' })
  async getResourceBookings(
    @Param('group_id') groupId: string,
    @Param('resource_id') resourceId: string,
    @Query() query: ListBookingsDto,
  ) {
    return this.bookingsService.getResourceBookings(groupId, resourceId, query);
  }

  @Get('resources/:resource_id/availability')
  @ApiOperation({
    summary: 'Get available time slots for a resource on a specific date',
  })
  @ApiResponse({ status: 200, description: 'Time slots and user statistics' })
  async getAvailability(
    @Param('group_id') groupId: string,
    @Param('resource_id') resourceId: string,
    @CurrentUser() user: any,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.bookingsService.getAvailability(
      groupId,
      resourceId,
      user.id,
      query.date,
      query.excludeBookingId,
    );
  }

  @Get('my_bookings')
  @ApiOperation({ summary: 'List current user bookings in this group' })
  @ApiResponse({ status: 200, description: 'List of my bookings' })
  async getMyBookings(
    @Param('group_id') groupId: string,
    @CurrentUser() user: any,
    @Query() query: MyBookingsQueryDto,
  ) {
    return this.bookingsService.getMyBookings(groupId, user.id, query);
  }

  @Patch(['bookings/:id', 'bookings/:id/reschedule'])
  @Post('bookings/:id/reschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reschedule an existing booking (Owner or ADMIN)' })
  @ApiResponse({ status: 200, description: 'Booking rescheduled' })
  @ApiResponse({
    status: 400,
    description:
      'cannot_reschedule_cancelled_booking, cannot_reschedule_past_booking, or booking_rule_violation',
  })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({
    status: 409,
    description: 'slot_full or resource_under_maintenance',
  })
  async rescheduleBooking(
    @Param('group_id') groupId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: any,
    @Body() dto: RescheduleBookingDto,
  ) {
    const role = req?.groupMember?.role;
    return this.bookingsService.rescheduleBooking(
      groupId,
      id,
      user.id,
      role,
      dto,
    );
  }

  @Delete('bookings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a booking (Owner or ADMIN)' })
  @ApiResponse({ status: 204, description: 'Booking cancelled' })
  @ApiResponse({
    status: 400,
    description: 'booking_already_cancelled or cannot_cancel_past_booking',
  })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async cancelBooking(
    @Param('group_id') groupId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const role = req?.groupMember?.role;
    return this.bookingsService.cancelBooking(groupId, id, user.id, role);
  }
}

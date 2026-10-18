import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  ParseArrayPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { BookingRulesService } from './booking-rules.service';
import { BookingRuleItemDto } from './dto/booking-rule-item.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { GroupMemberGuard } from '../groups/guards/group-member.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GroupRole } from '@prisma/client';

@ApiTags('Booking Rules')
@Controller('groups/:group_id/resources/:resource_id/rules')
@UseGuards(AuthGuard, GroupMemberGuard)
@ApiBearerAuth()
export class BookingRulesController {
  constructor(private readonly bookingRulesService: BookingRulesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all booking rules for a resource' })
  @ApiResponse({ status: 200, description: 'List of booking rules' })
  async getRules(
    @Param('group_id') groupId: string,
    @Param('resource_id') resourceId: string,
  ) {
    return this.bookingRulesService.getRules(groupId, resourceId);
  }

  @Put()
  @Roles(GroupRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Bulk replace/upsert all booking rules for a resource (ADMIN only)',
  })
  @ApiBody({ type: [BookingRuleItemDto] })
  @ApiResponse({ status: 200, description: 'Updated rules array' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or duplicate_day_scope',
  })
  async upsertRules(
    @Param('group_id') groupId: string,
    @Param('resource_id') resourceId: string,
    @Body(new ParseArrayPipe({ items: BookingRuleItemDto, optional: true }))
    rules: BookingRuleItemDto[] = [],
  ) {
    return this.bookingRulesService.upsertRules(
      groupId,
      resourceId,
      rules || [],
    );
  }
}

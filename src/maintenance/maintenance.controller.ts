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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { ListMaintenanceDto } from './dto/list-maintenance.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { GroupMemberGuard } from '../groups/guards/group-member.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentMember } from '../common/decorators/current-member.decorator';
import { GroupRole } from '@prisma/client';

@ApiTags('Maintenance')
@Controller('groups/:group_id')
@UseGuards(AuthGuard, GroupMemberGuard)
@ApiBearerAuth()
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('resources/:resource_id/maintenance')
  @Roles(GroupRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Schedule a maintenance task for a resource (ADMIN only)',
  })
  @ApiResponse({ status: 201, description: 'Maintenance task created' })
  @ApiResponse({
    status: 409,
    description: 'Conflicting confirmed bookings exist without override flag',
  })
  async createMaintenanceTask(
    @Param('group_id') groupId: string,
    @Param('resource_id') resourceId: string,
    @Body() dto: CreateMaintenanceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.maintenanceService.createMaintenanceTask(
      groupId,
      resourceId,
      userId,
      dto,
    );
  }

  @Get('resources/:resource_id/maintenance')
  @ApiOperation({
    summary: 'List maintenance tasks for a specific resource',
  })
  @ApiResponse({ status: 200, description: 'List of maintenance tasks' })
  async getResourceMaintenance(
    @Param('group_id') groupId: string,
    @Param('resource_id') resourceId: string,
    @Query() query: ListMaintenanceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.maintenanceService.listMaintenanceTasks(
      groupId,
      resourceId,
      query,
      userId,
    );
  }

  @Get('maintenance')
  @ApiOperation({
    summary: 'List all maintenance tasks across the group',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all maintenance tasks for the group',
  })
  async getGroupMaintenance(
    @Param('group_id') groupId: string,
    @Query() query: ListMaintenanceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.maintenanceService.listMaintenanceTasks(
      groupId,
      undefined,
      query,
      userId,
    );
  }

  @Get('resources/:resource_id/maintenance/:task_id')
  @ApiOperation({
    summary: 'Get details of a specific maintenance task',
  })
  @ApiResponse({ status: 200, description: 'Maintenance task details' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getMaintenanceTask(
    @Param('group_id') groupId: string,
    @Param('resource_id') resourceId: string,
    @Param('task_id') taskId: string,
  ) {
    return this.maintenanceService.getMaintenanceTask(
      groupId,
      resourceId,
      taskId,
    );
  }

  @Patch('resources/:resource_id/maintenance/:task_id')
  @ApiOperation({
    summary: 'Update a maintenance task (ADMIN or assigned member)',
  })
  @ApiResponse({ status: 200, description: 'Maintenance task updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({
    status: 409,
    description: 'Conflicting confirmed bookings exist without override flag',
  })
  async updateMaintenanceTask(
    @Param('group_id') groupId: string,
    @Param('resource_id') resourceId: string,
    @Param('task_id') taskId: string,
    @Body() dto: UpdateMaintenanceDto,
    @CurrentUser('id') userId: string,
    @CurrentMember('role') role: GroupRole,
  ) {
    return this.maintenanceService.updateMaintenanceTask(
      groupId,
      resourceId,
      taskId,
      dto,
      userId,
      role,
    );
  }

  @Delete('resources/:resource_id/maintenance/:task_id')
  @Roles(GroupRole.ADMIN)
  @ApiOperation({
    summary: 'Delete or cancel a maintenance task (ADMIN only)',
  })
  @ApiResponse({ status: 200, description: 'Maintenance task deleted' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async deleteMaintenanceTask(
    @Param('group_id') groupId: string,
    @Param('resource_id') resourceId: string,
    @Param('task_id') taskId: string,
  ) {
    return this.maintenanceService.deleteMaintenanceTask(
      groupId,
      resourceId,
      taskId,
    );
  }
}

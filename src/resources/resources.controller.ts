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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { GroupMemberGuard } from '../groups/guards/group-member.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GroupRole } from '@prisma/client';

@ApiTags('Resources')
@Controller('groups/:group_id/resources')
@UseGuards(AuthGuard, GroupMemberGuard)
@ApiBearerAuth()
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  @Roles(GroupRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a resource in group (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Resource created' })
  async createResource(
    @Param('group_id') groupId: string,
    @Body() dto: CreateResourceDto,
  ) {
    return this.resourcesService.createResource(groupId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List resources in group' })
  @ApiQuery({
    name: 'include_inactive',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted resources (ADMIN only)',
  })
  @ApiResponse({ status: 200, description: 'List of resources' })
  async getResources(
    @Param('group_id') groupId: string,
    @Query('include_inactive') includeInactive?: string,
    @Req() req?: any,
  ) {
    const isIncludeInactive = includeInactive === 'true';
    const role = req?.groupMember?.role;
    return this.resourcesService.getResources(groupId, isIncludeInactive, role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get resource details with booking rules' })
  @ApiResponse({ status: 200, description: 'Resource details' })
  async getResourceDetails(
    @Param('group_id') groupId: string,
    @Param('id') id: string,
  ) {
    return this.resourcesService.getResourceDetails(groupId, id);
  }

  @Patch(':id')
  @Roles(GroupRole.ADMIN)
  @ApiOperation({ summary: 'Update resource (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Resource updated' })
  async updateResource(
    @Param('group_id') groupId: string,
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourcesService.updateResource(groupId, id, dto);
  }

  @Delete(':id')
  @Roles(GroupRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete resource (ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Resource soft-deleted' })
  async deleteResource(
    @Param('group_id') groupId: string,
    @Param('id') id: string,
  ) {
    return this.resourcesService.deleteResource(groupId, id);
  }
}

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { GroupMemberGuard } from './guards/group-member.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { GroupRole } from '@prisma/client';

@ApiTags('Groups')
@Controller('groups')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new group (creator becomes ADMIN)' })
  @ApiResponse({ status: 201, description: 'Group created' })
  async createGroup(
    @CurrentUser() user: any,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupsService.createGroup(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all groups current user belongs to' })
  @ApiResponse({ status: 200, description: 'List of groups' })
  async getUserGroups(@CurrentUser() user: any) {
    return this.groupsService.getUserGroups(user.id);
  }

  @Post('join')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Join a group using invite code' })
  @ApiResponse({ status: 201, description: 'Joined group successfully' })
  @ApiResponse({ status: 404, description: 'invalid_invite_code' })
  @ApiResponse({ status: 409, description: 'already_a_member' })
  async joinGroup(
    @CurrentUser() user: any,
    @Body() dto: JoinGroupDto,
  ) {
    return this.groupsService.joinGroup(user.id, dto);
  }

  @Get(':id')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Get group details' })
  @ApiResponse({ status: 200, description: 'Group details' })
  @ApiResponse({ status: 403, description: 'Not a group member' })
  async getGroupDetails(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.groupsService.getGroupDetails(id, user.id);
  }

  @Patch(':id')
  @UseGuards(GroupMemberGuard)
  @Roles(GroupRole.ADMIN)
  @ApiOperation({ summary: 'Update group name (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Group updated' })
  @ApiResponse({ status: 403, description: 'Forbidden / Not ADMIN' })
  async updateGroup(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.updateGroup(id, dto, user.id);
  }

  @Get(':id/members')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'List group members' })
  @ApiResponse({ status: 200, description: 'List of members' })
  async getMembers(@Param('id') id: string) {
    return this.groupsService.getMembers(id);
  }

  @Delete(':id/members/:user_id')
  @UseGuards(GroupMemberGuard)
  @Roles(GroupRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from group (ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiResponse({ status: 400, description: 'cannot_remove_self' })
  @ApiResponse({ status: 403, description: 'cannot_remove_admin' })
  async removeMember(
    @Param('id') id: string,
    @Param('user_id') targetUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.groupsService.removeMember(id, user.id, targetUserId);
  }

  @Post(':id/leave')
  @UseGuards(GroupMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a group voluntarily' })
  @ApiResponse({ status: 204, description: 'Left group' })
  @ApiResponse({ status: 400, description: 'sole_admin_cannot_leave' })
  async leaveGroup(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.groupsService.leaveGroup(id, user.id);
  }

  @Post(':id/regenerate_invite')
  @UseGuards(GroupMemberGuard)
  @Roles(GroupRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate group invite code (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'New invite code generated' })
  async regenerateInviteCode(@Param('id') id: string) {
    return this.groupsService.regenerateInviteCode(id);
  }
}
